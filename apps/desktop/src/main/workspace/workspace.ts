import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

import type { MoodleFileRef, MoodleLink } from "../../shared/moodle";
import {
  projectFileSchema,
  sidecarFileSchema,
  subjectFileSchema,
  workspaceFileSchema,
  type BinaryKind,
  type FolderInfo,
  type ProjectInfo,
  type ResourceInfo,
  type SaveNoteResult,
  type SidecarFile,
  type SubjectColorValue,
  type SubjectFile,
  type SubjectInfo,
  type WorkspaceFile,
  type WorkspaceIssue,
  type WorkspaceSnapshot,
} from "../../shared/workspace";
import {
  assertInsideWorkspace,
  exists,
  folderName,
  isDirectory,
  readJson,
  sha256,
  slugify,
  splitExtension,
  toPosix,
  uniquePath,
  writeFileAtomic,
  writeJson,
} from "./files";
import { noteRevision, parseNote, serializeNote } from "./frontmatter";

export const WORKSPACE_FORMAT_VERSION = 1;
const SIDECAR_SUFFIX = ".resource.json";
/** A subject's Moodle activities, beside `subject.json`. */
const ACTIVITIES_FILE = "activities.json";

interface SubjectEntry {
  info: SubjectInfo;
  dir: string;
}

export interface ProjectEntry {
  info: ProjectInfo;
  path: string;
}

interface ResourceEntry {
  info: ResourceInfo;
  absPath: string;
  sidecarPath?: string;
}

/**
 * One folder as the student sees it. Notes, documents, and images each keep
 * their own area on disk, so the same folder can be more than one directory.
 */
interface FolderEntry {
  info: FolderInfo;
  dirs: string[];
}

/** Areas inside a subject. The folder a student sees sits below one of them. */
const AREAS = ["notes", "documents", "images"];
/** Directories in a subject that hold resit's records rather than files. */
const RESERVED_DIRS = new Set(["annotations", "practice"]);

function folderKey(subjectId: string, path: string): string {
  return `${subjectId}/${path}`;
}

/** Where a directory sits inside its subject, with the area stripped off. */
function folderPath(subjectDir: string, dir: string): string {
  const segments = toPosix(relative(subjectDir, dir))
    .split("/")
    .filter(Boolean);
  if (AREAS.includes(segments[0] ?? "")) segments.shift();
  return segments.join("/");
}

/** A folder path split into the folder it sits in and its own name. */
function splitFolder(path: string): { parent: string; name: string } {
  const at = path.lastIndexOf("/");
  return at === -1
    ? { parent: "", name: path }
    : { parent: path.slice(0, at), name: path.slice(at + 1) };
}

/** The area directory a resource of this kind lives in. */
function areaFor(kind: ResourceInfo["kind"]): string {
  if (kind === "note") return "notes";
  return kind === "image" ? "images" : "documents";
}

export interface OpenWorkspace {
  root: string;
  file: WorkspaceFile;
  subjects: Map<string, SubjectEntry>;
  projects: Map<string, ProjectEntry>;
  folders: Map<string, FolderEntry>;
  resources: Map<string, ResourceEntry>;
  issues: WorkspaceIssue[];
  locks: Map<string, Promise<unknown>>;
}

const now = () => new Date().toISOString();

export class WorkspaceError extends Error {}

function binaryKind(filename: string): BinaryKind {
  const extension = splitExtension(filename).extension.toLowerCase();
  if (extension === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(extension))
    return "image";
  return "attachment";
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path))
    hash.update(chunk as Buffer);
  return `sha256:${hash.digest("hex")}`;
}

/** Runs mutations of one resource one at a time. */
export function withLock<T>(
  workspace: OpenWorkspace,
  key: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = workspace.locks.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  workspace.locks.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

export async function createWorkspace(input: {
  folder: string;
  name: string;
  subject: { name: string; color: SubjectColorValue };
}): Promise<OpenWorkspace> {
  const root = input.folder;
  if (await exists(join(root, "workspace.json")))
    throw new WorkspaceError(
      "This folder already contains a workspace. Open it instead.",
    );
  await mkdir(root, { recursive: true });
  const at = now();
  const file: WorkspaceFile = {
    format: "resit-workspace",
    formatVersion: WORKSPACE_FORMAT_VERSION,
    id: randomUUID(),
    name: input.name,
    createdAt: at,
    updatedAt: at,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  await writeJson(join(root, "workspace.json"), file);
  const workspace = await openWorkspace(root);
  await createSubject(workspace, input.subject);
  return workspace;
}

export async function openWorkspace(folder: string): Promise<OpenWorkspace> {
  const workspace: OpenWorkspace = {
    root: folder,
    file: await readWorkspaceFile(folder),
    subjects: new Map(),
    projects: new Map(),
    folders: new Map(),
    resources: new Map(),
    issues: [],
    locks: new Map(),
  };
  await scanWorkspace(workspace);
  return workspace;
}

/** Reads and checks `workspace.json`, without touching anything else. */
export async function readWorkspaceFile(
  folder: string,
): Promise<WorkspaceFile> {
  const manifest = join(folder, "workspace.json");
  if (!(await exists(manifest)))
    throw new WorkspaceError(
      "This folder is not a resit workspace. Choose a folder with a workspace.json file, or create a new workspace.",
    );
  let raw: unknown;
  try {
    raw = await readJson(manifest);
  } catch {
    throw new WorkspaceError("workspace.json is not valid JSON.");
  }
  const parsed = workspaceFileSchema.safeParse(raw);
  if (!parsed.success)
    throw new WorkspaceError(
      `workspace.json is not a valid resit workspace: ${parsed.error.issues[0]?.message ?? "unknown problem"}.`,
    );
  if (parsed.data.formatVersion > WORKSPACE_FORMAT_VERSION)
    throw new WorkspaceError(
      "This workspace was created by a newer version of resit. Update resit to open it.",
    );
  return parsed.data;
}

/** Rebuilds the in-memory index of subjects, folders, and files from disk. */
export async function scanWorkspace(workspace: OpenWorkspace): Promise<void> {
  const subjects = new Map<string, SubjectEntry>();
  const resources = new Map<string, ResourceEntry>();
  const folders = new Map<string, FolderEntry>();
  const issues: WorkspaceIssue[] = [];
  const subjectsDir = join(workspace.root, "subjects");
  const rel = (path: string) => toPosix(relative(workspace.root, path));

  const subjectDirs = (await isDirectory(subjectsDir))
    ? await readdir(subjectsDir, { withFileTypes: true })
    : [];
  for (const folder of subjectDirs) {
    if (!folder.isDirectory() || folder.name.startsWith(".")) continue;
    const dir = join(subjectsDir, folder.name);
    const subjectPath = join(dir, "subject.json");
    if (!(await exists(subjectPath))) continue;
    let subject: SubjectFile;
    try {
      subject = subjectFileSchema.parse(await readJson(subjectPath));
    } catch {
      issues.push({
        kind: "invalid-file",
        path: rel(subjectPath),
        message: "subject.json could not be read.",
      });
      continue;
    }
    if (subjects.has(subject.id)) {
      issues.push({
        kind: "duplicate-id",
        path: rel(subjectPath),
        message: `Another subject already uses the ID ${subject.id}.`,
      });
      continue;
    }
    subjects.set(subject.id, {
      dir,
      info: {
        id: subject.id,
        name: subject.name,
        color: subject.color,
        sortOrder: subject.sortOrder,
        archived: subject.archived,
        ...(subject.moodle ? { moodle: subject.moodle } : {}),
      },
    });
    await scanSubjectFiles(
      {
        root: workspace.root,
        subjectId: subject.id,
        subjectDir: dir,
        resources,
        folders,
        issues,
      },
      dir,
    );
  }

  workspace.subjects = subjects;
  workspace.projects = await scanProjects(workspace.root, issues);
  workspace.resources = resources;
  workspace.folders = folders;
  workspace.issues = issues;
}

/** Where projects live, whether or not there are any. */
export function projectsDir(workspace: OpenWorkspace): string {
  return join(workspace.root, "projects");
}

async function scanProjects(
  root: string,
  issues: WorkspaceIssue[],
): Promise<Map<string, ProjectEntry>> {
  const projects = new Map<string, ProjectEntry>();
  const directory = join(root, "projects");
  if (!(await isDirectory(directory))) return projects;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const path = join(directory, entry.name);
    const parsed = projectFileSchema.safeParse(
      await readJson(path).catch(() => null),
    );
    if (!parsed.success) {
      issues.push({
        kind: "invalid-file",
        path: `projects/${entry.name}`,
        message: "The project could not be read.",
      });
      continue;
    }
    const project = parsed.data;
    if (projects.has(project.id)) {
      issues.push({
        kind: "duplicate-id",
        path: `projects/${entry.name}`,
        message: `Another project already uses the ID ${project.id}.`,
      });
      continue;
    }
    projects.set(project.id, {
      path,
      info: {
        id: project.id,
        title: project.title,
        subjectIds: project.subjectIds,
        resourceIds: project.resourceIds,
      },
    });
  }
  return projects;
}

interface SubjectScan {
  root: string;
  subjectId: string;
  subjectDir: string;
  resources: Map<string, ResourceEntry>;
  folders: Map<string, FolderEntry>;
  issues: WorkspaceIssue[];
}

async function scanSubjectFiles(scan: SubjectScan, dir: string): Promise<void> {
  const { subjectDir, resources, folders, issues } = scan;
  const entries = await readdir(dir, { withFileTypes: true });
  const names = new Set(entries.map((entry) => entry.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === subjectDir && RESERVED_DIRS.has(entry.name)) continue;
      const nested = folderPath(subjectDir, path);
      if (nested) {
        const existing = folders.get(folderKey(scan.subjectId, nested));
        if (existing) existing.dirs.push(path);
        else
          folders.set(folderKey(scan.subjectId, nested), {
            info: { subjectId: scan.subjectId, path: nested, moodle: false },
            dirs: [path],
          });
      }
      await scanSubjectFiles(scan, path);
      continue;
    }
    if (!entry.isFile()) continue;
    if (
      dir === subjectDir &&
      (entry.name === "subject.json" || entry.name === ACTIVITIES_FILE)
    )
      continue;
    if (entry.name.endsWith(SIDECAR_SUFFIX)) continue;

    const folder = folderPath(subjectDir, dirname(path));
    const relativePath = toPosix(relative(scan.root, path));
    const subjectId = scan.subjectId;

    try {
      const entryInfo = entry.name.toLowerCase().endsWith(".md")
        ? await readNoteEntry(path, subjectId)
        : await readBinaryEntry(
            path,
            subjectId,
            names.has(`${entry.name}${SIDECAR_SUFFIX}`),
          );
      const existing = resources.get(entryInfo.id);
      if (existing) {
        issues.push({
          kind: "duplicate-id",
          path: relativePath,
          message: `${existing.info.path} already uses the ID ${entryInfo.id}. Only the first file is shown.`,
        });
        continue;
      }
      resources.set(entryInfo.id, {
        absPath: path,
        ...("sidecarPath" in entryInfo
          ? { sidecarPath: entryInfo.sidecarPath }
          : {}),
        info: {
          id: entryInfo.id,
          kind: entryInfo.kind,
          title: entryInfo.title,
          subjectId,
          path: relativePath,
          ...(folder ? { folder } : {}),
          revision: entryInfo.revision,
          size: entryInfo.size,
          updatedAt: entryInfo.updatedAt,
        },
      });
      // A folder holding a downloaded file belongs to the course, not the
      // student: resit fills it from Moodle and leaves it alone otherwise.
      if (folder && entryInfo.fromMoodle) {
        const owner = folders.get(folderKey(subjectId, folder));
        if (owner) owner.info.moodle = true;
      }
    } catch (error) {
      issues.push({
        kind: "invalid-file",
        path: relativePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function titleFromFilename(path: string): string {
  return splitExtension(basename(path)).name.replace(/[-_]+/g, " ").trim();
}

/** Reads a note's metadata. Notes without an ID get frontmatter added once. */
async function readNoteEntry(path: string, subjectId: string) {
  let text = await readFile(path, "utf8");
  const parsed = parseNote(text);
  if (!parsed.ok) throw new Error(parsed.message);
  const data = parsed.data;
  if (typeof data.id !== "string" || !data.id) {
    const at = now();
    const heading = /^#\s+(.+)$/m.exec(parsed.body)?.[1]?.trim();
    const { id: _id, subjectId: _subject, title, ...rest } = data;
    const adopted = {
      id: randomUUID(),
      subjectId,
      title:
        typeof title === "string" && title
          ? title
          : (heading ?? titleFromFilename(path)),
      createdAt: at,
      updatedAt: at,
      ...rest,
    };
    text = serializeNote(adopted, parsed.body);
    await writeFileAtomic(path, text);
    return {
      id: adopted.id,
      kind: "note" as const,
      title: adopted.title,
      revision: noteRevision(text),
      size: Buffer.byteLength(text),
      updatedAt: at,
      fromMoodle: false,
    };
  }
  return {
    id: data.id,
    kind: "note" as const,
    fromMoodle: false,
    title:
      typeof data.title === "string" && data.title
        ? data.title
        : titleFromFilename(path),
    revision: sha256(parsed.body),
    size: Buffer.byteLength(text),
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : (await stat(path)).mtime.toISOString(),
  };
}

/** Reads a binary's sidecar, creating one for files added outside resit. */
async function readBinaryEntry(
  path: string,
  subjectId: string,
  hasSidecar: boolean,
) {
  const sidecarPath = `${path}${SIDECAR_SUFFIX}`;
  const info = await stat(path);
  let sidecar: SidecarFile;
  if (hasSidecar) {
    sidecar = sidecarFileSchema.parse(await readJson(sidecarPath));
  } else {
    const at = now();
    const hash = await hashFile(path);
    sidecar = {
      id: randomUUID(),
      type: binaryKind(path),
      title: titleFromFilename(path),
      subjectId,
      originalFilename: basename(path),
      contentHash: hash,
      revision: hash,
      createdAt: at,
      updatedAt: at,
    };
    await writeJson(sidecarPath, sidecar);
  }
  return {
    id: sidecar.id,
    kind: sidecar.type,
    title: sidecar.title,
    revision: sidecar.revision,
    size: info.size,
    updatedAt: sidecar.updatedAt,
    fromMoodle: sidecar.moodle !== undefined,
    sidecarPath,
  };
}

export function snapshot(workspace: OpenWorkspace): WorkspaceSnapshot {
  return {
    workspace: {
      id: workspace.file.id,
      name: workspace.file.name,
      root: workspace.root,
    },
    subjects: [...workspace.subjects.values()]
      .map((entry) => entry.info)
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    projects: [...workspace.projects.values()]
      .map((entry) => entry.info)
      .sort((a, b) => a.title.localeCompare(b.title)),
    folders: [...workspace.folders.values()]
      .map((entry) => entry.info)
      .sort((a, b) => a.path.localeCompare(b.path)),
    resources: [...workspace.resources.values()]
      .map((entry) => entry.info)
      .sort((a, b) => a.title.localeCompare(b.title)),
    issues: workspace.issues,
  };
}

function subjectEntry(workspace: OpenWorkspace, id: string): SubjectEntry {
  const entry = workspace.subjects.get(id);
  if (!entry) throw new WorkspaceError("That subject no longer exists.");
  return entry;
}

function resourceEntry(workspace: OpenWorkspace, id: string): ResourceEntry {
  const entry = workspace.resources.get(id);
  if (!entry) throw new WorkspaceError("That file no longer exists.");
  return entry;
}

async function readSubjectFile(entry: SubjectEntry): Promise<SubjectFile> {
  return subjectFileSchema.parse(
    await readJson(join(entry.dir, "subject.json")),
  );
}

export async function createSubject(
  workspace: OpenWorkspace,
  input: {
    name: string;
    color: SubjectColorValue;
    moodle?: MoodleLink | undefined;
  },
): Promise<SubjectInfo> {
  const subjectsDir = join(workspace.root, "subjects");
  await mkdir(subjectsDir, { recursive: true });
  const dir = await uniquePath(subjectsDir, slugify(input.name), "");
  const at = now();
  const sortOrder =
    Math.max(
      -1,
      ...[...workspace.subjects.values()].map((entry) => entry.info.sortOrder),
    ) + 1;
  const file: SubjectFile = {
    id: randomUUID(),
    name: input.name,
    color: input.color,
    sortOrder,
    archived: false,
    ...(input.moodle ? { moodle: input.moodle } : {}),
    createdAt: at,
    updatedAt: at,
  };
  await writeJson(join(dir, "subject.json"), file);
  const info: SubjectInfo = {
    id: file.id,
    name: file.name,
    color: file.color,
    sortOrder,
    archived: false,
    ...(input.moodle ? { moodle: input.moodle } : {}),
  };
  workspace.subjects.set(file.id, { dir, info });
  return info;
}

export async function updateSubject(
  workspace: OpenWorkspace,
  input: {
    id: string;
    name?: string | undefined;
    color?: SubjectColorValue | undefined;
    sortOrder?: number | undefined;
  },
): Promise<void> {
  const entry = subjectEntry(workspace, input.id);
  await withLock(workspace, input.id, async () => {
    const file = await readSubjectFile(entry);
    if (input.name !== undefined) file.name = input.name;
    if (input.color !== undefined) file.color = input.color;
    if (input.sortOrder !== undefined) file.sortOrder = input.sortOrder;
    file.updatedAt = now();
    await writeJson(join(entry.dir, "subject.json"), file);
    entry.info = {
      ...entry.info,
      name: file.name,
      color: file.color,
      sortOrder: file.sortOrder,
    };
  });
}

/** Points a subject at a Moodle course, or with `null` stops following one. */
export function linkSubject(
  workspace: OpenWorkspace,
  input: { subjectId: string; link: MoodleLink | null },
): Promise<SubjectInfo> {
  const entry = subjectEntry(workspace, input.subjectId);
  return withLock(workspace, input.subjectId, async () => {
    const file = await readSubjectFile(entry);
    if (input.link) file.moodle = input.link;
    else delete file.moodle;
    file.updatedAt = now();
    await writeJson(join(entry.dir, "subject.json"), file);
    const { moodle: _previous, ...info } = entry.info;
    entry.info = { ...info, ...(input.link ? { moodle: input.link } : {}) };
    return entry.info;
  });
}

/** Every binary in a subject that has a sidecar, with the sidecar's contents. */
export async function subjectSidecars(
  workspace: OpenWorkspace,
  subjectId: string,
): Promise<{ resource: ResourceInfo; sidecar: SidecarFile }[]> {
  subjectEntry(workspace, subjectId);
  const found = [];
  for (const entry of workspace.resources.values()) {
    if (entry.info.subjectId !== subjectId || !entry.sidecarPath) continue;
    try {
      found.push({
        resource: entry.info,
        sidecar: sidecarFileSchema.parse(await readJson(entry.sidecarPath)),
      });
    } catch {
      // A sidecar resit cannot read is reported by the workspace scan.
    }
  }
  return found;
}

/** Moves files into `.resit/trash` with a record of where they came from. */
export async function moveToTrash(
  workspace: OpenWorkspace,
  paths: string[],
  record: Record<string, unknown>,
): Promise<void> {
  const stamp = now().replace(/[:.]/g, "-");
  const dir = join(
    workspace.root,
    ".resit",
    "trash",
    `${stamp}-${randomUUID().slice(0, 8)}`,
  );
  await mkdir(dir, { recursive: true });
  const moved: { from: string; to: string }[] = [];
  for (const path of paths) {
    if (!(await exists(path))) continue;
    // A folder deletion moves the notes, documents, and images directories
    // that share its name, so the trash cannot take them under one name.
    const { name, extension } = splitExtension(basename(path));
    const target = await uniquePath(dir, name, extension);
    await rename(path, target);
    moved.push({
      from: toPosix(relative(workspace.root, path)),
      to: basename(target),
    });
  }
  await writeJson(join(dir, "trash.json"), {
    ...record,
    deletedAt: now(),
    files: moved,
  });
}

export async function deleteSubject(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  const entry = subjectEntry(workspace, id);
  await moveToTrash(workspace, [entry.dir], {
    kind: "subject",
    id,
    title: entry.info.name,
  });
  await scanWorkspace(workspace);
}

/**
 * Keeps the index in step with a directory that has just been made, so a
 * folder deleted before the next scan still takes all of its areas with it.
 */
function rememberFolder(
  workspace: OpenWorkspace,
  input: { subjectId: string; path: string; dir: string; moodle?: boolean },
): FolderInfo {
  const key = folderKey(input.subjectId, input.path);
  const entry = workspace.folders.get(key);
  if (!entry) {
    const info: FolderInfo = {
      subjectId: input.subjectId,
      path: input.path,
      moodle: input.moodle ?? false,
    };
    workspace.folders.set(key, { info, dirs: [input.dir] });
    return info;
  }
  if (!entry.dirs.includes(input.dir)) entry.dirs.push(input.dir);
  if (input.moodle) entry.info.moodle = true;
  return entry.info;
}

/** Makes a folder a student can put things in. Moodle keeps its own. */
export async function createFolder(
  workspace: OpenWorkspace,
  input: { subjectId: string; name: string; parent?: string | undefined },
): Promise<FolderInfo> {
  const subject = subjectEntry(workspace, input.subjectId);
  const name = folderName(input.name);
  if (!name) throw new WorkspaceError("That folder name cannot be used.");
  const parent = writableFolder(workspace, input.subjectId, input.parent);
  const path = parent ? `${parent}/${name}` : name;
  if (workspace.folders.has(folderKey(input.subjectId, path)))
    throw new WorkspaceError(
      `${parent || subject.info.name} already has a ${name} folder.`,
    );
  const dir = join(subject.dir, "notes", ...path.split("/"));
  await mkdir(dir, { recursive: true });
  return rememberFolder(workspace, {
    subjectId: input.subjectId,
    path,
    dir,
  });
}

function folderEntry(
  workspace: OpenWorkspace,
  subjectId: string,
  path: string,
): FolderEntry {
  const entry = workspace.folders.get(folderKey(subjectId, path));
  if (!entry) throw new WorkspaceError("That folder no longer exists.");
  return entry;
}

export async function deleteFolder(
  workspace: OpenWorkspace,
  input: { subjectId: string; path: string },
): Promise<void> {
  const entry = folderEntry(workspace, input.subjectId, input.path);
  await moveToTrash(workspace, entry.dirs, {
    kind: "folder",
    title: entry.info.path,
  });
  await scanWorkspace(workspace);
}

/** True when the folder, or a folder above it, is filled from Moodle. */
function moodleOwned(
  workspace: OpenWorkspace,
  subjectId: string,
  path: string,
): boolean {
  const segments = path.split("/");
  for (let depth = segments.length; depth > 0; depth -= 1) {
    const key = folderKey(subjectId, segments.slice(0, depth).join("/"));
    if (workspace.folders.get(key)?.info.moodle) return true;
  }
  return false;
}

/** Checks a folder something is headed for, and returns it for the path. */
function writableFolder(
  workspace: OpenWorkspace,
  subjectId: string,
  folder: string | undefined,
): string {
  if (!folder) return "";
  const entry = folderEntry(workspace, subjectId, folder);
  if (moodleOwned(workspace, subjectId, entry.info.path))
    throw new WorkspaceError(
      "This folder is filled from the Moodle course. Choose another folder.",
    );
  return entry.info.path;
}

/**
 * Renames a folder, moves it into another, or both. An empty `parent` moves
 * it to the top of the subject; leaving it out keeps the folder where it is.
 */
export async function updateFolder(
  workspace: OpenWorkspace,
  input: {
    subjectId: string;
    path: string;
    name?: string | undefined;
    parent?: string | undefined;
  },
): Promise<FolderInfo> {
  const subject = subjectEntry(workspace, input.subjectId);
  const entry = folderEntry(workspace, input.subjectId, input.path);
  if (moodleOwned(workspace, input.subjectId, entry.info.path))
    throw new WorkspaceError(
      "resit keeps this folder in step with the Moodle course. Following the course again would download its files under the old name.",
    );
  const current = splitFolder(entry.info.path);
  const name = input.name === undefined ? current.name : folderName(input.name);
  if (!name) throw new WorkspaceError("That folder name cannot be used.");
  const parent =
    input.parent === undefined
      ? current.parent
      : writableFolder(workspace, input.subjectId, input.parent || undefined);
  if (parent === entry.info.path || parent.startsWith(`${entry.info.path}/`))
    throw new WorkspaceError("A folder cannot go inside itself.");
  const path = parent ? `${parent}/${name}` : name;
  if (path === entry.info.path) return entry.info;
  if (workspace.folders.has(folderKey(input.subjectId, path)))
    throw new WorkspaceError(
      `${parent || subject.info.name} already has a ${name} folder.`,
    );

  for (const dir of entry.dirs) {
    const [first] = toPosix(relative(subject.dir, dir)).split("/");
    const area = first && AREAS.includes(first) ? [first] : [];
    const target = join(subject.dir, ...area, ...path.split("/"));
    await mkdir(dirname(target), { recursive: true });
    await rename(dir, target);
  }
  await scanWorkspace(workspace);
  return folderEntry(workspace, input.subjectId, path).info;
}

export async function createNote(
  workspace: OpenWorkspace,
  input: {
    subjectId: string;
    title: string;
    folder?: string | undefined;
    body?: string | undefined;
  },
): Promise<ResourceInfo> {
  const subject = subjectEntry(workspace, input.subjectId);
  const folder = writableFolder(workspace, input.subjectId, input.folder);
  const at = now();
  const id = randomUUID();
  const directory = join(subject.dir, "notes", ...(folder ? [folder] : []));
  await mkdir(directory, { recursive: true });
  if (folder)
    rememberFolder(workspace, {
      subjectId: input.subjectId,
      path: folder,
      dir: directory,
    });
  const path = await uniquePath(directory, slugify(input.title), ".md");
  const text = serializeNote(
    {
      id,
      subjectId: input.subjectId,
      title: input.title,
      createdAt: at,
      updatedAt: at,
    },
    input.body ?? "",
  );
  await writeFileAtomic(path, text);
  const info: ResourceInfo = {
    id,
    kind: "note",
    title: input.title,
    subjectId: input.subjectId,
    path: toPosix(relative(workspace.root, path)),
    ...(folder ? { folder } : {}),
    revision: noteRevision(text),
    size: Buffer.byteLength(text),
    updatedAt: at,
  };
  workspace.resources.set(id, { info, absPath: path });
  return info;
}

export async function readNote(
  workspace: OpenWorkspace,
  id: string,
): Promise<{ resource: ResourceInfo; body: string; revision: string }> {
  const entry = resourceEntry(workspace, id);
  if (entry.info.kind !== "note")
    throw new WorkspaceError("That resource is not a note.");
  await assertInsideWorkspace(workspace.root, entry.absPath);
  const text = await readFile(entry.absPath, "utf8");
  const parsed = parseNote(text);
  if (!parsed.ok) throw new WorkspaceError(parsed.message);
  const revision = sha256(parsed.body);
  entry.info = { ...entry.info, revision, size: Buffer.byteLength(text) };
  return { resource: entry.info, body: parsed.body, revision };
}

/**
 * Saves a note body if the file still has the revision the editor loaded.
 * Otherwise returns the current text so the student can choose.
 */
export function saveNote(
  workspace: OpenWorkspace,
  input: { id: string; body: string; expectedRevision: string },
): Promise<SaveNoteResult> {
  return withLock(workspace, input.id, async () => {
    const entry = workspace.resources.get(input.id);
    if (!entry || entry.info.kind !== "note") return { status: "missing" };
    let current: string;
    try {
      await assertInsideWorkspace(workspace.root, entry.absPath);
      current = await readFile(entry.absPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { status: "missing" };
      throw error;
    }
    const parsed = parseNote(current);
    if (!parsed.ok) throw new WorkspaceError(parsed.message);
    const currentRevision = sha256(parsed.body);
    if (currentRevision !== input.expectedRevision)
      return { status: "conflict", currentRevision, currentBody: parsed.body };
    const at = now();
    const text = serializeNote({ ...parsed.data, updatedAt: at }, input.body);
    await writeFileAtomic(entry.absPath, text);
    const revision = noteRevision(text);
    entry.info = {
      ...entry.info,
      revision,
      size: Buffer.byteLength(text),
      updatedAt: at,
    };
    return { status: "saved", revision, resource: entry.info };
  });
}

export function renameResource(
  workspace: OpenWorkspace,
  input: { id: string; title: string },
): Promise<ResourceInfo> {
  return withLock(workspace, input.id, async () => {
    const entry = resourceEntry(workspace, input.id);
    const at = now();
    if (entry.info.kind === "note") {
      const text = await readFile(entry.absPath, "utf8");
      const parsed = parseNote(text);
      if (!parsed.ok) throw new WorkspaceError(parsed.message);
      const next = serializeNote(
        { ...parsed.data, title: input.title, updatedAt: at },
        parsed.body,
      );
      await writeFileAtomic(entry.absPath, next);
      const target = await uniquePath(
        dirname(entry.absPath),
        slugify(input.title),
        ".md",
      );
      if (basename(target) !== basename(entry.absPath)) {
        await rename(entry.absPath, target);
        entry.absPath = target;
      }
      entry.info = {
        ...entry.info,
        title: input.title,
        path: toPosix(relative(workspace.root, entry.absPath)),
        revision: noteRevision(next),
        size: Buffer.byteLength(next),
        updatedAt: at,
      };
    } else if (entry.sidecarPath) {
      const sidecar = sidecarFileSchema.parse(
        await readJson(entry.sidecarPath),
      );
      sidecar.title = input.title;
      sidecar.updatedAt = at;
      await writeJson(entry.sidecarPath, sidecar);
      entry.info = { ...entry.info, title: input.title, updatedAt: at };
    }
    return entry.info;
  });
}

/**
 * Moves a file to another subject or folder. It keeps its ID and title, so
 * open tabs and links into it still point at it. Highlights follow the PDF.
 */
export function moveResource(
  workspace: OpenWorkspace,
  input: { id: string; subjectId: string; folder?: string | undefined },
): Promise<ResourceInfo> {
  return withLock(workspace, input.id, async () => {
    const entry = resourceEntry(workspace, input.id);
    const subject = subjectEntry(workspace, input.subjectId);
    const folder = writableFolder(workspace, input.subjectId, input.folder);
    const directory = join(
      subject.dir,
      areaFor(entry.info.kind),
      ...(folder ? folder.split("/") : []),
    );
    if (directory === dirname(entry.absPath)) return entry.info;

    await assertInsideWorkspace(workspace.root, entry.absPath);
    const moved = entry.info.subjectId !== input.subjectId;
    const highlights =
      moved && entry.info.kind === "pdf"
        ? annotationsPath(workspace, input.id)
        : null;
    await mkdir(directory, { recursive: true });
    const { name, extension } = splitExtension(basename(entry.absPath));
    const target = await uniquePath(directory, name, extension);
    await rename(entry.absPath, target);
    entry.absPath = target;

    const at = now();
    if (entry.sidecarPath) {
      const sidecar = sidecarFileSchema.parse(
        await readJson(entry.sidecarPath),
      );
      const beside = `${target}${SIDECAR_SUFFIX}`;
      await rename(entry.sidecarPath, beside);
      entry.sidecarPath = beside;
      await writeJson(beside, {
        ...sidecar,
        subjectId: input.subjectId,
        updatedAt: at,
      });
    } else if (entry.info.kind === "note" && moved) {
      const text = await readFile(target, "utf8");
      const parsed = parseNote(text);
      if (parsed.ok)
        await writeFileAtomic(
          target,
          serializeNote(
            { ...parsed.data, subjectId: input.subjectId, updatedAt: at },
            parsed.body,
          ),
        );
    }

    if (folder)
      rememberFolder(workspace, {
        subjectId: input.subjectId,
        path: folder,
        dir: directory,
      });
    const { folder: _previous, ...info } = entry.info;
    entry.info = {
      ...info,
      subjectId: input.subjectId,
      path: toPosix(relative(workspace.root, target)),
      ...(folder ? { folder } : {}),
      updatedAt: at,
    };

    if (highlights && (await exists(highlights))) {
      const to = annotationsPath(workspace, input.id);
      await mkdir(dirname(to), { recursive: true });
      await rename(highlights, to);
    }
    return entry.info;
  });
}

export function deleteResource(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  return withLock(workspace, id, async () => {
    const entry = resourceEntry(workspace, id);
    await moveToTrash(
      workspace,
      [
        entry.absPath,
        ...(entry.sidecarPath ? [entry.sidecarPath] : []),
        ...(entry.info.kind === "pdf" ? [annotationsPath(workspace, id)] : []),
      ],
      { kind: entry.info.kind, id, title: entry.info.title },
    );
    workspace.resources.delete(id);
  });
}

/**
 * Adds a binary and its sidecar to a subject. `write` fills a temporary file
 * beside the target, so a failed write never leaves a half-written resource.
 */
async function addBinary(
  workspace: OpenWorkspace,
  input: {
    subjectId: string;
    /** Folder inside the subject's documents or images area. */
    folder?: string | undefined;
    filename: string;
    title: string;
    moodle?: MoodleFileRef | undefined;
  },
  write: (temporaryPath: string) => Promise<void>,
): Promise<ResourceInfo> {
  const subject = subjectEntry(workspace, input.subjectId);
  const { name, extension } = splitExtension(input.filename);
  const kind = binaryKind(input.filename);
  const directory = join(
    subject.dir,
    kind === "image" ? "images" : "documents",
    ...(input.folder ? [input.folder] : []),
  );
  await mkdir(directory, { recursive: true });
  if (input.folder)
    rememberFolder(workspace, {
      subjectId: input.subjectId,
      path: input.folder,
      dir: directory,
      moodle: input.moodle !== undefined,
    });
  const target = await uniquePath(
    directory,
    slugify(name),
    extension.toLowerCase(),
  );
  const temporary = join(
    directory,
    `.${basename(target)}.${randomUUID().slice(0, 8)}.tmp`,
  );
  try {
    await write(temporary);
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  const hash = await hashFile(target);
  const at = now();
  const sidecar: SidecarFile = {
    id: randomUUID(),
    type: kind,
    title: input.title,
    subjectId: input.subjectId,
    originalFilename: input.filename,
    contentHash: hash,
    revision: hash,
    ...(input.moodle ? { moodle: input.moodle } : {}),
    createdAt: at,
    updatedAt: at,
  };
  const sidecarPath = `${target}${SIDECAR_SUFFIX}`;
  await writeJson(sidecarPath, sidecar);
  const info: ResourceInfo = {
    id: sidecar.id,
    kind,
    title: sidecar.title,
    subjectId: input.subjectId,
    path: toPosix(relative(workspace.root, target)),
    ...(input.folder ? { folder: input.folder } : {}),
    revision: hash,
    size: (await stat(target)).size,
    updatedAt: at,
  };
  workspace.resources.set(info.id, { info, absPath: target, sidecarPath });
  return info;
}

/** Copies an external file into a subject. The original is never modified. */
export async function importFile(
  workspace: OpenWorkspace,
  input: {
    subjectId: string;
    sourcePath: string;
    folder?: string | undefined;
  },
): Promise<ResourceInfo> {
  subjectEntry(workspace, input.subjectId);
  const folder = writableFolder(workspace, input.subjectId, input.folder);
  const filename = basename(input.sourcePath);
  const { extension } = splitExtension(filename);

  if (extension.toLowerCase() === ".md") {
    const text = await readFile(input.sourcePath, "utf8");
    const parsed = parseNote(text);
    const body = parsed.ok ? parsed.body : text;
    const data = parsed.ok ? parsed.data : {};
    const title =
      typeof data.title === "string" && data.title
        ? data.title
        : titleFromFilename(filename);
    return createNote(workspace, {
      subjectId: input.subjectId,
      title,
      ...(folder ? { folder } : {}),
      body,
    });
  }

  return addBinary(
    workspace,
    {
      subjectId: input.subjectId,
      ...(folder ? { folder } : {}),
      filename,
      title: titleFromFilename(filename),
    },
    (temporary) => copyFile(input.sourcePath, temporary),
  );
}

/** Stores a file downloaded from Moodle, recording where it came from. */
export function importDownload(
  workspace: OpenWorkspace,
  input: {
    subjectId: string;
    folder?: string | undefined;
    filename: string;
    title: string;
    bytes: Uint8Array;
    moodle: MoodleFileRef;
  },
): Promise<ResourceInfo> {
  return addBinary(workspace, input, (temporary) =>
    writeFile(temporary, input.bytes, { flag: "wx" }),
  );
}

/**
 * Replaces an imported file's contents, with a newer copy from Moodle or a
 * kept one. The resource keeps its ID, so open tabs and links still point
 * at it.
 */
export function replaceFile(
  workspace: OpenWorkspace,
  input: {
    resourceId: string;
    bytes: Uint8Array;
    /** Where a newer copy came from. Without it, the record stays as it was. */
    moodle?: MoodleFileRef | undefined;
  },
): Promise<ResourceInfo> {
  return withLock(workspace, input.resourceId, async () => {
    const entry = resourceEntry(workspace, input.resourceId);
    if (!entry.sidecarPath)
      throw new WorkspaceError("That file has no resit record to update.");
    await assertInsideWorkspace(workspace.root, entry.absPath);
    await writeFileAtomic(entry.absPath, input.bytes);
    const hash = await hashFile(entry.absPath);
    const at = now();
    const sidecar = sidecarFileSchema.parse(await readJson(entry.sidecarPath));
    await writeJson(entry.sidecarPath, {
      ...sidecar,
      contentHash: hash,
      revision: hash,
      ...(input.moodle ? { moodle: input.moodle } : {}),
      updatedAt: at,
    });
    entry.info = {
      ...entry.info,
      revision: hash,
      size: input.bytes.byteLength,
      updatedAt: at,
    };
    return entry.info;
  });
}

export async function readResourceBytes(
  workspace: OpenWorkspace,
  id: string,
): Promise<Uint8Array> {
  const entry = resourceEntry(workspace, id);
  await assertInsideWorkspace(workspace.root, entry.absPath);
  return readFile(entry.absPath);
}

export function resourcePath(workspace: OpenWorkspace, id: string): string {
  return resourceEntry(workspace, id).absPath;
}

export function resourceInfo(
  workspace: OpenWorkspace,
  id: string,
): ResourceInfo {
  return resourceEntry(workspace, id).info;
}

/**
 * Annotation files are named after the document's ID. An ID adopted from a
 * sidecar written outside resit is not necessarily a safe filename.
 */
function annotationFilename(documentId: string): string {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(documentId)
    ? `${documentId}.json`
    : `${sha256(documentId).slice("sha256:".length, "sha256:".length + 32)}.json`;
}

/** Where a subject's Moodle activities live, whether or not the file exists. */
export function activitiesPath(
  workspace: OpenWorkspace,
  subjectId: string,
): string {
  return join(subjectEntry(workspace, subjectId).dir, ACTIVITIES_FILE);
}

/** A subject's cards, reviews, and quizzes, whether or not any exist yet. */
export function practiceDir(
  workspace: OpenWorkspace,
  subjectId: string,
): string {
  return join(subjectEntry(workspace, subjectId).dir, "practice");
}

/** Where one document's annotations live, whether or not the file exists. */
export function annotationsPath(
  workspace: OpenWorkspace,
  documentId: string,
): string {
  const entry = resourceEntry(workspace, documentId);
  return join(
    subjectEntry(workspace, entry.info.subjectId).dir,
    "annotations",
    annotationFilename(documentId),
  );
}
