import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, statfs } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable, Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";

import yauzl from "yauzl";
import yazl from "yazl";
import { z } from "zod";

import type { PackageOptions, PackageSummary } from "../../shared/workspace";
import { exists, folderName, isInside, readJson, writeJson } from "./files";
import {
  readWorkspaceFile,
  WorkspaceError,
  type OpenWorkspace,
} from "./workspace";
import { t } from "../i18n";

export const PACKAGE_FORMAT_VERSION = 1;

const manifestSchema = z.object({
  format: z.literal("resit-package"),
  formatVersion: z.number().int().positive(),
  exportedAt: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  files: z.array(
    z.object({
      path: z.string().min(1),
      size: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[\da-f]{64}$/),
    }),
  ),
});
type Manifest = z.infer<typeof manifestSchema>;

const MANIFEST = "manifest.json";
const PREFIX = "workspace/";
const MAX_ENTRIES = 200_000;
const MAX_BYTES = 64 * 1024 ** 3;
const MAX_MANIFEST_BYTES = 64 * 1024 ** 2;
/** Formats that are compressed already gain nothing from deflate. */
const STORED = /\.(pdf|png|jpe?g|gif|webp|zip|docx|pptx|xlsx|mp[34]|m4a)$/i;

/**
 * Whether a workspace file goes into a package. The cache, machine state,
 * unsaved drafts, the lock, and temporary files never do.
 */
function packaged(path: string, options: PackageOptions): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name.endsWith(".tmp")) return false;
  if (path.startsWith(".resit/")) {
    if (path.startsWith(".resit/history/")) return options.history;
    if (path.startsWith(".resit/trash/")) return options.trash;
    return false;
  }
  if (path.startsWith("conversations/")) return options.conversations;
  if (path === "learner.json") return options.learner;
  return true;
}

interface PackagedFile {
  path: string;
  absolute: string;
  size: number;
  mtime: Date;
}

/** Every file a package takes, walking the folder. Links are left out. */
async function packageFiles(
  root: string,
  options: PackageOptions,
): Promise<PackagedFile[]> {
  const found: PackagedFile[] = [];
  const walk = async (directory: string, prefix: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${prefix}${entry.name}`;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (path === ".resit" && !options.history && !options.trash) continue;
        await walk(absolute, `${path}/`);
      } else if (entry.isFile() && packaged(path, options)) {
        const info = await stat(absolute);
        found.push({ path, absolute, size: info.size, mtime: info.mtime });
      }
    }
  };
  await walk(root, "");
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

/** Passes bytes through while hashing and counting them. */
class Measure extends Transform {
  readonly hash = createHash("sha256");
  bytes = 0;
  constructor(private readonly onBytes: (count: number) => void) {
    super();
  }
  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.hash.update(chunk);
    this.bytes += chunk.length;
    this.onBytes(chunk.length);
    callback(null, chunk);
  }
}

function stopped(signal: AbortSignal): WorkspaceError {
  return new WorkspaceError(
    signal.reason instanceof Error ? signal.reason.message : t("Stopped."),
  );
}

/**
 * Writes the workspace to one `.resit` file: a ZIP with the files under
 * `workspace/` and a manifest of their sizes and SHA-256 hashes. It is
 * written beside the destination and only takes its name once it reads
 * back complete.
 */
export async function exportPackage(
  workspace: OpenWorkspace,
  input: {
    destination: string;
    options: PackageOptions;
    onProgress: (done: number, total: number) => void;
    signal: AbortSignal;
  },
): Promise<{ files: number; bytes: number }> {
  const files = await packageFiles(workspace.root, input.options);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const temporary = `${input.destination}.${randomUUID().slice(0, 8)}.tmp`;
  const manifest: Manifest = {
    format: "resit-package",
    formatVersion: PACKAGE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    workspaceId: workspace.file.id,
    workspaceName: workspace.file.name,
    files: [],
  };
  let done = 0;
  const zip = new yazl.ZipFile();
  const output = createWriteStream(temporary);
  const written = pipeline(zip.outputStream, output);
  const abort = () => {
    (zip.outputStream as Readable).destroy(stopped(input.signal));
  };
  input.signal.addEventListener("abort", abort, { once: true });
  try {
    for (const file of files)
      // Opened only when the archive gets to it, so one file is open at a time.
      zip.addReadStreamLazy(
        `${PREFIX}${file.path}`,
        { mtime: file.mtime, compress: !STORED.test(file.path) },
        (callback) => {
          const measure = new Measure((count) => {
            done += count;
            input.onProgress(done, total);
          });
          measure.on("end", () =>
            manifest.files.push({
              path: file.path,
              size: measure.bytes,
              sha256: measure.hash.digest("hex"),
            }),
          );
          const source = createReadStream(file.absolute);
          source.on("error", (error) => measure.destroy(error));
          callback(null, source.pipe(measure));
        },
      );
    // Last, so every file above has been read and hashed by the time it is.
    zip.addReadStreamLazy(MANIFEST, {}, (callback) =>
      callback(null, Readable.from([JSON.stringify(manifest, null, 2)])),
    );
    zip.end();
    await written;
    if (input.signal.aborted) throw stopped(input.signal);
    await readPackage(temporary);
    await rename(temporary, input.destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw input.signal.aborted ? stopped(input.signal) : error;
  } finally {
    input.signal.removeEventListener("abort", abort);
  }
  return { files: files.length, bytes: total };
}

async function openArchive(path: string): Promise<yauzl.ZipFile> {
  try {
    return await yauzl.openPromise(path, {
      lazyEntries: true,
      // Entries are read again after the listing reaches the end.
      autoClose: false,
      validateEntrySizes: true,
      strictFileNames: true,
    });
  } catch {
    throw new WorkspaceError(t("This is not a resit file, or it is damaged."));
  }
}

async function readEntries(zip: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  if (zip.entryCount > MAX_ENTRIES)
    throw new WorkspaceError(
      t("This resit file holds too many files to open."),
    );
  return new Promise((resolveEntries, reject) => {
    const entries: yauzl.Entry[] = [];
    zip.on("entry", (entry: yauzl.Entry) => {
      entries.push(entry);
      zip.readEntry();
    });
    zip.on("end", () => resolveEntries(entries));
    zip.on("error", () =>
      reject(new WorkspaceError(t("This resit file is damaged."))),
    );
    zip.readEntry();
  });
}

/** A path inside the archive that is safe to write under a new folder. */
function safePath(name: string): boolean {
  if (!name.startsWith(PREFIX) || name.length === PREFIX.length) return false;
  // Windows separators, drive letters, and control characters.
  if (/[\\:]/.test(name)) return false;
  if ([...name].some((char) => char.charCodeAt(0) < 0x20)) return false;
  return name
    .slice(PREFIX.length)
    .replace(/\/$/, "")
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isLink(entry: yauzl.Entry): boolean {
  return ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000;
}

async function readManifest(
  zip: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<Manifest> {
  if (entry.uncompressedSize > MAX_MANIFEST_BYTES)
    throw new WorkspaceError(t("This resit file's manifest is too large."));
  const chunks: Buffer[] = [];
  for await (const chunk of await zip.openReadStreamPromise(entry))
    chunks.push(chunk as Buffer);
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new WorkspaceError(t("This resit file's manifest cannot be read."));
  }
  const format = z
    .object({ format: z.literal("resit-package"), formatVersion: z.number() })
    .safeParse(raw);
  if (!format.success)
    throw new WorkspaceError(t("This is not a resit workspace file."));
  if (format.data.formatVersion > PACKAGE_FORMAT_VERSION)
    throw new WorkspaceError(
      t(
        "This file was exported by a newer version of resit. Update resit to open it.",
      ),
    );
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success)
    throw new WorkspaceError(t("This resit file's manifest is not valid."));
  return parsed.data;
}

interface CheckedPackage {
  zip: yauzl.ZipFile;
  manifest: Manifest;
  /** File entries by their path inside the workspace. */
  files: Map<string, yauzl.Entry>;
  bytes: number;
}

/**
 * Checks everything that can be checked without extracting: that each
 * path stays inside the workspace, that nothing is a link or appears twice
 * (also ignoring case), and that the manifest lists exactly the files there
 * are, at the sizes they have.
 */
async function checkPackage(path: string): Promise<CheckedPackage> {
  const zip = await openArchive(path);
  try {
    const entries = await readEntries(zip);
    let manifestEntry: yauzl.Entry | undefined;
    const files = new Map<string, yauzl.Entry>();
    const folded = new Set<string>();
    let bytes = 0;
    for (const entry of entries) {
      const name = entry.fileName;
      if (name === MANIFEST) {
        if (manifestEntry)
          throw new WorkspaceError(t("This resit file has two manifests."));
        manifestEntry = entry;
        continue;
      }
      if (!safePath(name) || isLink(entry))
        throw new WorkspaceError(
          t("This resit file has an entry resit will not extract: {name}", {
            name: name.slice(0, 200),
          }),
        );
      if (entry.isEncrypted())
        throw new WorkspaceError(t("This resit file is encrypted."));
      const key = name.normalize("NFC").toLowerCase().replace(/\/$/, "");
      if (folded.has(key))
        throw new WorkspaceError(
          t("This resit file has two entries named {name}.", {
            name: name.slice(PREFIX.length, 200),
          }),
        );
      folded.add(key);
      if (name.endsWith("/")) continue;
      bytes += entry.uncompressedSize;
      if (bytes > MAX_BYTES)
        throw new WorkspaceError(t("This resit file is too large to open."));
      files.set(name.slice(PREFIX.length), entry);
    }
    if (!manifestEntry)
      throw new WorkspaceError(t("This is not a resit workspace file."));
    const manifest = await readManifest(zip, manifestEntry);
    if (manifest.files.length !== files.size)
      throw new WorkspaceError(
        t("This resit file does not match its list of files."),
      );
    for (const listed of manifest.files) {
      const entry = files.get(listed.path);
      if (!entry || entry.uncompressedSize !== listed.size)
        throw new WorkspaceError(
          t("This resit file does not match its list of files."),
        );
    }
    if (!files.has("workspace.json"))
      throw new WorkspaceError(t("This resit file has no workspace in it."));
    return { zip, manifest, files, bytes };
  } catch (error) {
    zip.close();
    throw error;
  }
}

export async function readPackage(path: string): Promise<PackageSummary> {
  const checked = await checkPackage(path);
  checked.zip.close();
  return {
    workspaceName: checked.manifest.workspaceName,
    exportedAt: checked.manifest.exportedAt,
    files: checked.files.size,
    bytes: checked.bytes,
  };
}

/**
 * Extracts a package into a new folder inside `parent`, checking every
 * file's hash, and returns that folder. Nothing appears at the final path
 * until the whole workspace is there. The copy gets a workspace ID of its
 * own.
 */
export async function extractPackage(
  archive: string,
  parent: string,
  input: {
    onProgress: (done: number, total: number) => void;
    signal: AbortSignal;
  },
): Promise<string> {
  const checked = await checkPackage(archive);
  const { zip, manifest } = checked;
  const hashes = new Map(
    manifest.files.map((file) => [file.path, file.sha256]),
  );
  const name = folderName(manifest.workspaceName) || "Workspace";
  let target = join(parent, name);
  for (let index = 2; await exists(target); index += 1)
    target = join(parent, `${name} ${index}`);
  const staging = join(parent, `.${name}.${randomUUID().slice(0, 8)}.import`);
  try {
    await mkdir(parent, { recursive: true });
    const free = await statfs(parent).catch(() => null);
    if (free && free.bavail * free.bsize < checked.bytes)
      throw new WorkspaceError(
        t(
          "This workspace needs {needed} MB, and the chosen drive has {free} MB free.",
          {
            needed: Math.ceil(checked.bytes / 1024 ** 2),
            free: Math.floor((free.bavail * free.bsize) / 1024 ** 2),
          },
        ),
      );
    let done = 0;
    for (const [path, entry] of checked.files) {
      if (input.signal.aborted) throw stopped(input.signal);
      const output = resolve(staging, ...path.split("/"));
      if (!isInside(staging, output) || output === staging)
        throw new WorkspaceError(t("resit will not extract {path}.", { path }));
      await mkdir(dirname(output), { recursive: true });
      const measure = new Measure((count) => {
        done += count;
        input.onProgress(done, checked.bytes);
      });
      await pipeline(
        await zip.openReadStreamPromise(entry),
        measure,
        createWriteStream(output, { flags: "wx" }),
        { signal: input.signal },
      );
      if (measure.hash.digest("hex") !== hashes.get(path))
        throw new WorkspaceError(
          t("{path} in this resit file is damaged. Nothing was opened.", {
            path,
          }),
        );
    }
    // A copy is a workspace of its own, whatever the original was.
    const manifestPath = join(staging, "workspace.json");
    await readWorkspaceFile(staging);
    await writeJson(manifestPath, {
      ...((await readJson(manifestPath)) as object),
      id: randomUUID(),
      updatedAt: new Date().toISOString(),
    });
    await rename(staging, target);
    return target;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw input.signal.aborted ? stopped(input.signal) : error;
  } finally {
    zip.close();
  }
}
