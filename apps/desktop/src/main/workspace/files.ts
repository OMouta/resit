import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  sep,
} from "node:path";

export function sha256(data: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(data).digest("hex")}`;
}

/**
 * Writes through a temporary sibling, flushes it, then renames it over the
 * target so a failed write never truncates the only copy.
 */
export async function writeFileAtomic(
  path: string,
  data: string | Uint8Array,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${randomUUID().slice(0, 8)}.tmp`,
  );
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(temporary, { force: true });
    throw error;
  }
  await handle.close();
  try {
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

export async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** True when `child` is `parent` or inside it, compared by path segments. */
export function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

/**
 * Resolves symlinks and junctions and rejects any path that ends up outside
 * the workspace root.
 */
export async function assertInsideWorkspace(
  root: string,
  path: string,
): Promise<void> {
  const [realRoot, realPath] = await Promise.all([
    realpath(root),
    realpath(path),
  ]);
  if (!isInside(realRoot, realPath))
    throw new Error("The file is outside the workspace folder.");
}

/** Device names Windows refuses to use as a filename, with or without a suffix. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Lowercase, hyphenated, filesystem-safe name. Keeps accented letters. */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[<>:"/\x5c|?*\p{Cc}]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  if (!slug) return "untitled";
  return RESERVED.test(slug) ? `${slug}-file` : slug;
}

/** First free path of the form `name.ext`, `name-2.ext`, `name-3.ext`, ... */
export async function uniquePath(
  directory: string,
  name: string,
  extension: string,
): Promise<string> {
  for (let index = 1; ; index += 1) {
    const candidate = join(
      directory,
      `${name}${index === 1 ? "" : `-${index}`}${extension}`,
    );
    if (!(await exists(candidate))) return candidate;
  }
}

export function splitExtension(filename: string): {
  name: string;
  extension: string;
} {
  const extension = extname(filename);
  return {
    name: filename.slice(0, filename.length - extension.length),
    extension,
  };
}

export function toPosix(path: string): string {
  return path.split(sep).join("/");
}
