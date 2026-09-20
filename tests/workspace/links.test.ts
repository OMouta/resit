import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { workspaceLinks } from "../../apps/desktop/src/main/workspace/links";
import {
  createNote,
  createWorkspace,
  readNote,
  saveNote,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

let directory: string;
let workspace: OpenWorkspace;
let subjectId: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-links-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
  subjectId = snapshot(workspace).subjects[0]!.id;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function write(id: string, body: string) {
  const current = await readNote(workspace, id);
  await saveNote(workspace, { id, body, expectedRevision: current.revision });
}

describe("workspace links", () => {
  it("counts the links one note makes to another", async () => {
    const source = await createNote(workspace, { subjectId, title: "Limits" });
    const target = await createNote(workspace, {
      subjectId,
      title: "Continuity",
    });
    await write(
      source.id,
      [
        `See [Continuity](resit://resource/${target.id}?page=3).`,
        `And again: resit://resource/${target.id}`,
        `A link to itself: resit://resource/${source.id}`,
      ].join("\n\n"),
    );

    const links = await workspaceLinks(workspace);

    expect(links).toEqual([{ from: source.id, to: target.id, count: 2 }]);
  });

  it("leaves out links to files that are no longer here", async () => {
    const note = await createNote(workspace, { subjectId, title: "Limits" });
    await write(note.id, "Gone: resit://resource/missing-id\n");

    expect(await workspaceLinks(workspace)).toEqual([]);
  });
});
