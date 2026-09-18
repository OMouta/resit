import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  appendMessage,
  bindClaudeSession,
  claudeSessionFor,
  createConversation,
  deleteConversation,
  listConversations,
  readConversation,
} from "../../apps/desktop/src/main/conversations/store";
import { pdfPages } from "../../apps/desktop/src/main/workspace/pdf-text";
import { searchWorkspace } from "../../apps/desktop/src/main/workspace/search";
import {
  createNote,
  createSubject,
  createWorkspace,
  importFile,
  readNote,
  saveNote,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import { samplePdf } from "../tools/sample-pdf.mjs";

let directory: string;
let workspace: OpenWorkspace;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-chat-"));
  workspace = await createWorkspace({
    folder: join(directory, "ISEP"),
    name: "ISEP",
    subject: { name: "Mathematics", color: "blue" },
  });
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const subjectId = () => snapshot(workspace).subjects[0]!.id;

describe("conversations", () => {
  it("keeps every complete message when the last write was cut short", async () => {
    const meta = await createConversation(workspace, {
      subjectIds: [subjectId()],
      resourceIds: [],
    });
    await appendMessage(workspace, meta.id, {
      id: "m1",
      role: "user",
      text: "What is a limit?",
      context: {},
      at: "2026-09-18T10:00:00.000Z",
    });
    await appendFile(
      join(workspace.root, "conversations", meta.id, "events.jsonl"),
      '{"type":"message","message":{"id":"m2","ro',
    );
    const detail = await readConversation(workspace, meta.id);
    expect(detail.messages.map((message) => message.id)).toEqual(["m1"]);
    expect(detail.meta.title).toBe("What is a limit?");
  });

  it("keeps native sessions out of the portable conversation files", async () => {
    const meta = await createConversation(workspace, {
      subjectIds: [],
      resourceIds: [],
    });
    await bindClaudeSession(workspace, meta.id, "session-1");
    expect(await claudeSessionFor(workspace, meta.id)).toBe("session-1");
    expect(
      JSON.stringify(await readConversation(workspace, meta.id)),
    ).not.toContain("session-1");
  });

  it("moves deleted conversations to the trash", async () => {
    const meta = await createConversation(workspace, {
      subjectIds: [],
      resourceIds: [],
    });
    await deleteConversation(workspace, meta.id);
    expect(await listConversations(workspace)).toEqual([]);
  });
});

describe("study retrieval", () => {
  it("reads PDF text page by page", async () => {
    const source = join(directory, "sheet.pdf");
    await writeFile(
      source,
      samplePdf([
        { title: "Limits", lines: ["Compute sin(x)/x near 0."] },
        { title: "Continuity", lines: ["Where is 1/(x - 2) continuous?"] },
      ]),
    );
    const pdf = await importFile(workspace, {
      subjectId: subjectId(),
      sourcePath: source,
    });
    const pages = await pdfPages(workspace, pdf.id);
    expect(pages).toHaveLength(2);
    expect(pages[1]).toContain("continuous");
  });

  it("ignores accents and never returns files outside the allowed set", async () => {
    const physics = await createSubject(workspace, {
      name: "Physics",
      color: "red",
    });
    const note = await createNote(workspace, {
      subjectId: subjectId(),
      title: "Séries",
    });
    const loaded = await readNote(workspace, note.id);
    await saveNote(workspace, {
      id: note.id,
      body: "Uma série converge quando…\n",
      expectedRevision: loaded.revision,
    });
    await createNote(workspace, {
      subjectId: physics.id,
      title: "Série de Fourier",
    });

    const all = await searchWorkspace(workspace, "serie", {
      allow: () => true,
      limit: 10,
    });
    expect(all.map((hit) => hit.title).sort()).toEqual([
      "Série de Fourier",
      "Séries",
    ]);

    const scoped = await searchWorkspace(workspace, "serie", {
      allow: (resource) => resource.subjectId === subjectId(),
      limit: 10,
    });
    expect(scoped.map((hit) => hit.title)).toEqual(["Séries"]);
  });
});
