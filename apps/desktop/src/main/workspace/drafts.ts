import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import type { NoteDraft, ResourceInfo } from "../../shared/workspace";
import { sha256, writeJson } from "./files";
import { snapshotNote } from "./history";
import {
  readNote,
  saveNote,
  withLock,
  WorkspaceError,
  type OpenWorkspace,
} from "./workspace";

/**
 * Text the editor had that did not reach the note: a save that failed or
 * met a newer version on disk, and edits made while that was unresolved.
 */
const draftSchema = z.object({
  noteId: z.string(),
  body: z.string(),
  /** The note's revision when the editor loaded it. */
  baseRevision: z.string(),
  savedAt: z.string(),
});

function draftPath(workspace: OpenWorkspace, noteId: string): string {
  const name = /^[\w-]+$/.test(noteId)
    ? noteId
    : sha256(noteId).slice("sha256:".length, "sha256:".length + 32);
  return join(workspace.root, ".resit", "drafts", `${name}.json`);
}

export async function keepDraft(
  workspace: OpenWorkspace,
  input: { id: string; body: string; expectedRevision: string },
): Promise<void> {
  await writeJson(draftPath(workspace, input.id), {
    noteId: input.id,
    body: input.body,
    baseRevision: input.expectedRevision,
    savedAt: new Date().toISOString(),
  });
}

export async function readDraft(
  workspace: OpenWorkspace,
  noteId: string,
): Promise<NoteDraft | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(draftPath(workspace, noteId), "utf8"));
  } catch {
    return null;
  }
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success || parsed.data.noteId !== noteId) return null;
  return { body: parsed.data.body, savedAt: parsed.data.savedAt };
}

export async function discardDraft(
  workspace: OpenWorkspace,
  noteId: string,
): Promise<void> {
  await rm(draftPath(workspace, noteId), { force: true });
}

/**
 * Makes the kept text the note's text. What the note said before goes into
 * its history first, so this can be undone like any restore.
 */
export function restoreDraft(
  workspace: OpenWorkspace,
  noteId: string,
): Promise<{ resource: ResourceInfo; body: string; revision: string }> {
  return withLock(workspace, `restore:${noteId}`, async () => {
    const draft = await readDraft(workspace, noteId);
    if (!draft) throw new WorkspaceError("That text is no longer kept.");
    await snapshotNote(workspace, noteId, "restore");
    const current = await readNote(workspace, noteId);
    const result = await saveNote(workspace, {
      id: noteId,
      body: draft.body,
      expectedRevision: current.revision,
    });
    if (result.status !== "saved")
      throw new WorkspaceError(
        result.status === "missing"
          ? "That note is no longer in the workspace."
          : "The note changed while the text was being put back. Try again.",
      );
    await discardDraft(workspace, noteId);
    return {
      resource: result.resource,
      body: draft.body,
      revision: result.revision,
    };
  });
}
