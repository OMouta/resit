import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  discardDraft,
  keepDraft,
  readDraft,
  restoreDraft,
} from "../../apps/desktop/src/main/workspace/drafts";
import {
  listNoteRevisions,
  readNoteRevision,
} from "../../apps/desktop/src/main/workspace/history";
import {
  createNote,
  createWorkspace,
  readNote,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

let directory: string;
let workspace: OpenWorkspace;
let noteId: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-drafts-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
  const note = await createNote(workspace, {
    subjectId: snapshot(workspace).subjects[0]!.id,
    title: "Limits",
    body: "On disk.\n",
  });
  noteId = note.id;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("drafts", () => {
  it("keeps unsaved text until it is thrown away", async () => {
    const { revision } = await readNote(workspace, noteId);
    await keepDraft(workspace, {
      id: noteId,
      body: "Typed but not saved.\n",
      expectedRevision: revision,
    });
    expect(await readDraft(workspace, noteId)).toMatchObject({
      body: "Typed but not saved.\n",
    });
    await discardDraft(workspace, noteId);
    expect(await readDraft(workspace, noteId)).toBeNull();
  });

  it("puts the text back and keeps what the note said", async () => {
    const { revision } = await readNote(workspace, noteId);
    await keepDraft(workspace, {
      id: noteId,
      body: "Typed but not saved.\n",
      expectedRevision: revision,
    });
    const restored = await restoreDraft(workspace, noteId);
    expect(restored.body).toBe("Typed but not saved.\n");
    expect((await readNote(workspace, noteId)).body).toBe(
      "Typed but not saved.\n",
    );
    expect(await readDraft(workspace, noteId)).toBeNull();

    const [kept] = await listNoteRevisions(workspace, noteId);
    expect(kept?.cause).toBe("restore");
    expect((await readNoteRevision(workspace, noteId, kept!.id)).body).toBe(
      "On disk.\n",
    );
  });

  it("refuses to restore text it no longer has", async () => {
    await expect(restoreDraft(workspace, noteId)).rejects.toThrow(
      "no longer kept",
    );
  });
});
