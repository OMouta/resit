import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { extname, join } from "node:path";

import type {
  FileRevision,
  NoteRevision,
  NoteRevisionContent,
  ResourceInfo,
  RevisionCause,
  SaveNoteResult,
} from "../../shared/workspace";
import { assertInsideWorkspace, writeFileAtomic } from "./files";
import {
  readNote,
  replaceFile,
  resourceInfo,
  resourcePath,
  saveNote,
  withLock,
  WorkspaceError,
  type OpenWorkspace,
} from "./workspace";

/** Copies older than this are dropped once the note has enough of them. */
const RETENTION_DAYS = 30;
const MAX_REVISIONS = 60;
const ALWAYS_KEPT = 10;
/** Ordinary editing keeps about one copy per interval, not one per save. */
const EDIT_INTERVAL_MS = 5 * 60_000;

const CAUSE_CODES: Record<RevisionCause, string> = {
  edit: "edit",
  assistant: "assistant",
  restore: "restore",
};

function historyDir(workspace: OpenWorkspace, noteId: string): string {
  if (!/^[\w-]+$/.test(noteId))
    throw new WorkspaceError("That note ID is not one resit can use.");
  return join(workspace.root, ".resit", "history", "notes", noteId);
}

/** `2026-09-20T14-30-00-123Z--assistant--1a2b3c4d.md` */
function revisionName(at: string, cause: RevisionCause): string {
  return `${at.replace(/[:.]/g, "-")}--${CAUSE_CODES[cause]}--${randomUUID().slice(0, 8)}.md`;
}

const NAME =
  /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z--(edit|assistant|restore)--[\da-f]{8}\.md$/;

function parseRevisionName(
  name: string,
): { at: string; cause: RevisionCause } | null {
  const match = NAME.exec(name);
  if (!match) return null;
  return {
    at: `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`,
    cause: match[6] as RevisionCause,
  };
}

/** The files holding kept copies, newest first. Their names carry the date. */
async function revisionNames(directory: string): Promise<string[]> {
  const names = await readdir(directory).catch(() => []);
  return names
    .filter((name) => parseRevisionName(name) !== null)
    .sort((a, b) => b.localeCompare(a));
}

/** Every kept copy of one note, newest first. */
export async function listNoteRevisions(
  workspace: OpenWorkspace,
  noteId: string,
): Promise<NoteRevision[]> {
  const directory = historyDir(workspace, noteId);
  const revisions: NoteRevision[] = [];
  for (const name of await revisionNames(directory)) {
    const parsed = parseRevisionName(name);
    const info = await stat(join(directory, name)).catch(() => null);
    if (!parsed || !info) continue;
    revisions.push({
      id: name,
      at: parsed.at,
      cause: parsed.cause,
      size: info.size,
    });
  }
  return revisions;
}

export async function readNoteRevision(
  workspace: OpenWorkspace,
  noteId: string,
  revisionId: string,
): Promise<NoteRevisionContent> {
  const parsed = parseRevisionName(revisionId);
  if (!parsed) throw new WorkspaceError("That is not a saved version.");
  const path = join(historyDir(workspace, noteId), revisionId);
  let body: string;
  try {
    body = await readFile(path, "utf8");
  } catch {
    throw new WorkspaceError("That version is no longer kept.");
  }
  return {
    id: revisionId,
    at: parsed.at,
    cause: parsed.cause,
    size: Buffer.byteLength(body),
    body,
  };
}

/** Drops copies past the retention window, keeping the most recent few. */
async function prune(directory: string): Promise<void> {
  const names = (await readdir(directory))
    .filter((name) => parseRevisionName(name) !== null)
    .sort((a, b) => b.localeCompare(a));
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60_000;
  const dropped = names.filter((name, index) => {
    if (index < ALWAYS_KEPT) return false;
    if (index >= MAX_REVISIONS) return true;
    const at = parseRevisionName(name)?.at;
    return at !== undefined && Date.parse(at) < cutoff;
  });
  for (const name of dropped)
    await rm(join(directory, name), { force: true }).catch(() => undefined);
}

/**
 * Keeps the note's current text before something replaces it. Repeated
 * saves of the same text, and ordinary editing within the interval, reuse
 * the copy already kept.
 */
export async function snapshotNote(
  workspace: OpenWorkspace,
  noteId: string,
  cause: RevisionCause,
): Promise<NoteRevision | null> {
  const directory = historyDir(workspace, noteId);
  const [newest] = await revisionNames(directory);
  const previous = newest ? parseRevisionName(newest) : null;
  if (
    previous &&
    cause === "edit" &&
    Date.now() - Date.parse(previous.at) < EDIT_INTERVAL_MS
  )
    return null;
  const note = await readNote(workspace, noteId);
  if (newest) {
    const kept = await readFile(join(directory, newest), "utf8").catch(
      () => null,
    );
    if (kept === note.body) return null;
  }
  const at = new Date().toISOString();
  const id = revisionName(at, cause);
  await mkdir(directory, { recursive: true });
  await writeFileAtomic(join(directory, id), note.body);
  await prune(directory).catch(() => undefined);
  return { id, at, cause, size: Buffer.byteLength(note.body) };
}

/** Saves a note, keeping a copy of what it said first. */
export async function saveNoteWithHistory(
  workspace: OpenWorkspace,
  input: { id: string; body: string; expectedRevision: string },
  cause: RevisionCause,
): Promise<SaveNoteResult> {
  await snapshotNote(workspace, input.id, cause).catch(() => null);
  return saveNote(workspace, input);
}

/**
 * Puts an older version back as the note's current text. The text being
 * replaced is kept too, so a restore can itself be undone.
 */
export function restoreNoteRevision(
  workspace: OpenWorkspace,
  noteId: string,
  revisionId: string,
): Promise<{ body: string; revision: string }> {
  return withLock(workspace, `restore:${noteId}`, async () => {
    const wanted = await readNoteRevision(workspace, noteId, revisionId);
    await snapshotNote(workspace, noteId, "restore");
    const current = await readNote(workspace, noteId);
    const result = await saveNote(workspace, {
      id: noteId,
      body: wanted.body,
      expectedRevision: current.revision,
    });
    if (result.status !== "saved")
      throw new WorkspaceError(
        result.status === "missing"
          ? "That note is no longer in the workspace."
          : "The note changed while it was being restored. Try again.",
      );
    return { body: wanted.body, revision: result.revision };
  });
}

/** Why resit kept a copy of an imported file. */
export type FileRevisionCause = FileRevision["cause"];

/** Imported files are large, so fewer copies are kept. */
const MAX_FILE_REVISIONS = 10;
const FILE_ALWAYS_KEPT = 3;

function fileHistoryDir(workspace: OpenWorkspace, resourceId: string): string {
  if (!/^[\w-]+$/.test(resourceId))
    throw new WorkspaceError("That file ID is not one resit can use.");
  return join(workspace.root, ".resit", "history", "files", resourceId);
}

/**
 * `2026-09-20T14-30-00-123Z--replace--0123456789ab.pdf`. The hex is the
 * start of the copy's content hash, so an unchanged file is not kept twice.
 */
const FILE_NAME =
  /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z--(replace|restore)--([\da-f]{12})(\.[A-Za-z\d]{1,10})?$/;

function parseFileRevisionName(
  name: string,
): { at: string; cause: FileRevisionCause; hash: string } | null {
  const match = FILE_NAME.exec(name);
  if (!match) return null;
  return {
    at: `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`,
    cause: match[6] as FileRevisionCause,
    hash: match[7]!,
  };
}

async function fileRevisionNames(directory: string): Promise<string[]> {
  const names = await readdir(directory).catch(() => []);
  return names
    .filter((name) => parseFileRevisionName(name) !== null)
    .sort((a, b) => b.localeCompare(a));
}

/** Every kept copy of one imported file, newest first. */
export async function listFileRevisions(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<FileRevision[]> {
  const directory = fileHistoryDir(workspace, resourceId);
  const revisions: FileRevision[] = [];
  for (const name of await fileRevisionNames(directory)) {
    const parsed = parseFileRevisionName(name);
    const info = await stat(join(directory, name)).catch(() => null);
    if (!parsed || !info) continue;
    revisions.push({
      id: name,
      at: parsed.at,
      cause: parsed.cause,
      size: info.size,
    });
  }
  return revisions;
}

async function pruneFiles(directory: string): Promise<void> {
  const names = await fileRevisionNames(directory);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60_000;
  const dropped = names.filter((name, index) => {
    if (index < FILE_ALWAYS_KEPT) return false;
    if (index >= MAX_FILE_REVISIONS) return true;
    const at = parseFileRevisionName(name)?.at;
    return at !== undefined && Date.parse(at) < cutoff;
  });
  for (const name of dropped)
    await rm(join(directory, name), { force: true }).catch(() => undefined);
}

/** Keeps a copy of an imported file before something replaces it. */
export async function snapshotFile(
  workspace: OpenWorkspace,
  resourceId: string,
  cause: FileRevisionCause,
): Promise<void> {
  const resource = resourceInfo(workspace, resourceId);
  if (resource.kind === "note")
    throw new WorkspaceError("Notes keep their own history.");
  const hash = resource.revision.replace(/^sha256:/, "").slice(0, 12);
  const directory = fileHistoryDir(workspace, resourceId);
  const [newest] = await fileRevisionNames(directory);
  if (newest && parseFileRevisionName(newest)?.hash === hash) return;
  const source = resourcePath(workspace, resourceId);
  await assertInsideWorkspace(workspace.root, source);
  const extension = extname(source).toLowerCase();
  const name = `${new Date().toISOString().replace(/[:.]/g, "-")}--${cause}--${hash}${
    /^\.[a-z\d]{1,10}$/.test(extension) ? extension : ""
  }`;
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${name}.tmp`);
  try {
    await copyFile(source, temporary);
    await rename(temporary, join(directory, name));
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  await pruneFiles(directory).catch(() => undefined);
}

/** Replaces an imported file's contents, keeping a copy of the old ones. */
export async function replaceFileWithHistory(
  workspace: OpenWorkspace,
  input: Parameters<typeof replaceFile>[1],
): Promise<ResourceInfo> {
  await snapshotFile(workspace, input.resourceId, "replace");
  return replaceFile(workspace, input);
}

/**
 * Puts a kept copy of an imported file back. The contents it replaces are
 * kept too, so this can be undone.
 */
export function restoreFileRevision(
  workspace: OpenWorkspace,
  resourceId: string,
  revisionId: string,
): Promise<ResourceInfo> {
  return withLock(workspace, `restore:${resourceId}`, async () => {
    if (!parseFileRevisionName(revisionId))
      throw new WorkspaceError("That is not a kept copy.");
    let bytes: Uint8Array;
    try {
      bytes = await readFile(
        join(fileHistoryDir(workspace, resourceId), revisionId),
      );
    } catch {
      throw new WorkspaceError("That copy is no longer kept.");
    }
    await snapshotFile(workspace, resourceId, "restore");
    return replaceFile(workspace, { resourceId, bytes });
  });
}
