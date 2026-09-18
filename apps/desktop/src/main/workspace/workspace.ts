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
} from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

import {
  sidecarFileSchema,
  subjectFileSchema,
  workspaceFileSchema,
  type BinaryKind,
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
import { parseNote, serializeNote } from "./frontmatter";

export const WORKSPACE_FORMAT_VERSION = 1;
const SIDECAR_SUFFIX = ".resource.json";

interface SubjectEntry {
  info: SubjectInfo;
  dir: string;
}

interface ResourceEntry {
  info: ResourceInfo;
  absPath: string;
  sidecarPath?: string;
}

export interface OpenWorkspace {
  root: string;
  file: WorkspaceFile;
  subjects: Map<string, SubjectEntry>;
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
function withLock<T>(
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
  const workspace: OpenWorkspace = {
    root: folder,
    file: parsed.data,
    subjects: new Map(),
    resources: new Map(),
    issues: [],
    locks: new Map(),
  };
  await scanWorkspace(workspace);
  return workspace;
}

/** Rebuilds the in-memory index of subjects and resources from disk. */
export async function scanWorkspace(workspace: OpenWorkspace): Promise<void> {
  const subjects = new Map<string, SubjectEntry>();
  const resources = new Map<string, ResourceEntry>();
  const issues: WorkspaceIssue[] = [];
  const subjectsDir = join(workspace.root, "subjects");
  const rel = (path: string) => toPosix(relative(workspace.root, path));

  const folders = (await isDirectory(subjectsDir))
    ? await readdir(subjectsDir, { withFileTypes: true })
    : [];
  for (const folder of folders) {
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
      },
    });
    await scanSubjectFiles(workspace, subject.id, dir, dir, resources, issues);
  }

  workspace.subjects = subjects;
  workspace.resources = resources;
  workspace.issues = issues;
}

async function scanSubjectFiles(
  workspace: OpenWorkspace,
  subjectId: string,
  subjectDir: string,
  dir: string,
  resources: Map<string, ResourceEntry>,
  issues: WorkspaceIssue[],
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  const names = new Set(entries.map((entry) => entry.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === subjectDir && entry.name === "annotations") continue;
      await scanSubjectFiles(
        workspace,
        subjectId,
        subjectDir,
        path,
        resources,
        issues,
      );
      continue;
    }
    if (!entry.isFile()) continue;
    if (dir === subjectDir && entry.name === "subject.json") continue;
    if (entry.name.endsWith(SIDECAR_SUFFIX)) continue;

    const segments = toPosix(relative(subjectDir, dirname(path)))
      .split("/")
      .filter(Boolean);
    if (["notes", "documents", "images"].includes(segments[0] ?? ""))
      segments.shift();
    const folder = segments.join("/");
    const relativePath = toPosix(relative(workspace.root, path));

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
      revision: sha256(text),
      size: Buffer.byteLength(text),
      updatedAt: at,
    };
  }
  return {
    id: data.id,
    kind: "note" as const,
    title:
      typeof data.title === "string" && data.title
        ? data.title
        : titleFromFilename(path),
    revision: sha256(text),
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
  input: { name: string; color: SubjectColorValue },
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

/** Moves files into `.resit/trash` with a record of where they came from. */
async function moveToTrash(
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
    const target = join(dir, basename(path));
    await rename(path, target);
    moved.push({
      from: toPosix(relative(workspace.root, path)),
      to: basename(path),
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

export async function createNote(
  workspace: OpenWorkspace,
  input: { subjectId: string; title: string; body?: string | undefined },
): Promise<ResourceInfo> {
  const subject = subjectEntry(workspace, input.subjectId);
  const at = now();
  const id = randomUUID();
  const path = await uniquePath(
    join(subject.dir, "notes"),
    slugify(input.title),
    ".md",
  );
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
    revision: sha256(text),
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
  const revision = sha256(text);
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
    const currentRevision = sha256(current);
    if (currentRevision !== input.expectedRevision)
      return { status: "conflict", currentRevision, currentBody: parsed.body };
    const at = now();
    const text = serializeNote({ ...parsed.data, updatedAt: at }, input.body);
    await writeFileAtomic(entry.absPath, text);
    const revision = sha256(text);
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
        revision: sha256(next),
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

export function deleteResource(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  return withLock(workspace, id, async () => {
    const entry = resourceEntry(workspace, id);
    await moveToTrash(
      workspace,
      [entry.absPath, ...(entry.sidecarPath ? [entry.sidecarPath] : [])],
      { kind: entry.info.kind, id, title: entry.info.title },
    );
    workspace.resources.delete(id);
  });
}

/** Copies an external file into a subject. The original is never modified. */
export async function importFile(
  workspace: OpenWorkspace,
  input: { subjectId: string; sourcePath: string },
): Promise<ResourceInfo> {
  const subject = subjectEntry(workspace, input.subjectId);
  const filename = basename(input.sourcePath);
  const { name, extension } = splitExtension(filename);

  if (extension.toLowerCase() === ".md") {
    const text = await readFile(input.sourcePath, "utf8");
    const parsed = parseNote(text);
    const body = parsed.ok ? parsed.body : text;
    const data = parsed.ok ? parsed.data : {};
    const title =
      typeof data.title === "string" && data.title
        ? data.title
        : titleFromFilename(filename);
    return createNote(workspace, { subjectId: input.subjectId, title, body });
  }

  const kind = binaryKind(filename);
  const target = await uniquePath(
    join(subject.dir, kind === "image" ? "images" : "documents"),
    slugify(name),
    extension.toLowerCase(),
  );
  await mkdir(dirname(target), { recursive: true });
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${randomUUID().slice(0, 8)}.tmp`,
  );
  try {
    await copyFile(input.sourcePath, temporary);
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
    title: titleFromFilename(filename),
    subjectId: input.subjectId,
    originalFilename: filename,
    contentHash: hash,
    revision: hash,
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
    revision: hash,
    size: (await stat(target)).size,
    updatedAt: at,
  };
  workspace.resources.set(info.id, { info, absPath: target, sidecarPath });
  return info;
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
