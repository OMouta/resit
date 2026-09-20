import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import type {
  NoteRevision,
  NoteRevisionContent,
  RevisionCause,
  SaveNoteResult,
} from "../../shared/workspace";
import { writeFileAtomic } from "./files";
import {
  readNote,
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
