import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  listFileRevisions,
  listNoteRevisions,
  readNoteRevision,
  replaceFileWithHistory,
  restoreFileRevision,
  restoreNoteRevision,
  saveNoteWithHistory,
  snapshotFile,
} from "../../apps/desktop/src/main/workspace/history";
import {
  createNote,
  createWorkspace,
  importFile,
  readNote,
  resourcePath,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

let directory: string;
let workspace: OpenWorkspace;
let noteId: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-history-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
  const note = await createNote(workspace, {
    subjectId: snapshot(workspace).subjects[0]!.id,
    title: "Limits",
    body: "The squeeze theorem.\n",
  });
  noteId = note.id;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

/** Saves a new body the way the editor and the assistant both do. */
async function save(body: string, cause: "edit" | "assistant") {
  const current = await readNote(workspace, noteId);
  return saveNoteWithHistory(
    workspace,
    { id: noteId, body, expectedRevision: current.revision },
    cause,
  );
}

describe("note history", () => {
  it("keeps the text a change replaced and puts it back", async () => {
    await save("The squeeze theorem, with an example.\n", "assistant");

    const revisions = await listNoteRevisions(workspace, noteId);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]!.cause).toBe("assistant");
    expect(
      (await readNoteRevision(workspace, noteId, revisions[0]!.id)).body,
    ).toBe("The squeeze theorem.\n");

    await delay(5);
    const restored = await restoreNoteRevision(
      workspace,
      noteId,
      revisions[0]!.id,
    );
    expect(restored.body).toBe("The squeeze theorem.\n");
    expect((await readNote(workspace, noteId)).body).toBe(
      "The squeeze theorem.\n",
    );

    // Restoring is itself undoable: the text it replaced is kept.
    const after = await listNoteRevisions(workspace, noteId);
    expect(after.map((revision) => revision.cause)).toEqual([
      "restore",
      "assistant",
    ]);
    expect((await readNoteRevision(workspace, noteId, after[0]!.id)).body).toBe(
      "The squeeze theorem, with an example.\n",
    );
  });

  it("keeps one copy for a burst of editing, and one for every assistant change", async () => {
    await save("One.\n", "edit");
    await delay(5);
    await save("Two.\n", "edit");
    expect(await listNoteRevisions(workspace, noteId)).toHaveLength(1);

    await delay(5);
    await save("Three.\n", "assistant");
    await delay(5);
    await save("Four.\n", "assistant");
    const revisions = await listNoteRevisions(workspace, noteId);
    expect(revisions.map((revision) => revision.cause)).toEqual([
      "assistant",
      "assistant",
      "edit",
    ]);
    expect(
      (await readNoteRevision(workspace, noteId, revisions[0]!.id)).body,
    ).toBe("Three.\n");
  });

  it("refuses a version that was never kept", async () => {
    await expect(
      readNoteRevision(workspace, noteId, "not-a-revision"),
    ).rejects.toThrow(/not a saved version/i);
  });
});

describe("file history", () => {
  async function importPdf(bytes: string) {
    const source = join(directory, "worksheet.pdf");
    await writeFile(source, bytes);
    return importFile(workspace, {
      subjectId: snapshot(workspace).subjects[0]!.id,
      sourcePath: source,
    });
  }

  it("keeps a copy when a newer one replaces the file, and puts it back", async () => {
    const pdf = await importPdf("first copy");
    await replaceFileWithHistory(workspace, {
      resourceId: pdf.id,
      bytes: new TextEncoder().encode("second copy"),
    });
    const path = resourcePath(workspace, pdf.id);
    expect(await readFile(path, "utf8")).toBe("second copy");

    const [kept] = await listFileRevisions(workspace, pdf.id);
    expect(kept).toMatchObject({ cause: "replace", size: 10 });
    expect(kept!.id).toMatch(/\.pdf$/);

    await delay(5);
    const restored = await restoreFileRevision(workspace, pdf.id, kept!.id);
    expect(await readFile(path, "utf8")).toBe("first copy");
    expect(restored.revision).toBe(pdf.revision);
    expect(
      (await listFileRevisions(workspace, pdf.id)).map(
        (revision) => revision.cause,
      ),
    ).toEqual(["restore", "replace"]);
  });

  it("does not keep the same contents twice", async () => {
    const pdf = await importPdf("same");
    await snapshotFile(workspace, pdf.id, "replace");
    await delay(5);
    await snapshotFile(workspace, pdf.id, "replace");
    expect(await listFileRevisions(workspace, pdf.id)).toHaveLength(1);
  });
});
