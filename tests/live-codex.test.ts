import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

/**
 * Spends real Codex usage, so it only runs when asked:
 *   RESIT_LIVE=1 npx vitest run tests/live-codex.test.ts
 */
const live = process.env.RESIT_LIVE === "1";

vi.mock("../apps/desktop/src/main/settings", () => ({
  loadSettings: () =>
    Promise.resolve({
      theme: "system",
      recent: [],
      provider: "codex",
      claude: {},
      codex: {},
    }),
}));

import { runCodexTurn } from "../apps/desktop/src/main/agent/codex-turn";
import { createConversation } from "../apps/desktop/src/main/conversations/store";
import {
  createNote,
  createWorkspace,
  importFile,
  readNote,
  saveNote,
  snapshot,
} from "../apps/desktop/src/main/workspace/workspace";
import { samplePdf } from "./tools/sample-pdf.mjs";

it.skipIf(!live)(
  "answers from the student's files through Codex",
  { timeout: 300_000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "resit-live-"));
    const workspace = await createWorkspace({
      folder: join(directory, "Studies"),
      name: "Studies",
      subject: { name: "Mathematics", color: "blue" },
    });
    const subject = snapshot(workspace).subjects[0]!;
    const note = await createNote(workspace, {
      subjectId: subject.id,
      title: "Limits",
    });
    await saveNote(workspace, {
      id: note.id,
      body: "The squeeze theorem bounds sin(x)/x between cos(x) and 1.\n",
      expectedRevision: (await readNote(workspace, note.id)).revision,
    });
    const source = join(directory, "Worksheet 1.pdf");
    await writeFile(
      source,
      samplePdf([
        {
          title: "Worksheet 1",
          lines: ["1. Compute the limit of sin(x)/x as x approaches 0."],
        },
      ]),
    );
    await importFile(workspace, { subjectId: subject.id, sourcePath: source });
    const conversation = await createConversation(
      workspace,
      { subjectIds: [subject.id], resourceIds: [] },
      "codex",
    );

    const phases = new Set<string>();
    const message = await runCodexTurn(
      workspace,
      (event) => {
        if (event.type === "turn-progress") phases.add(event.phase);
      },
      "turn-1",
      {
        conversationId: conversation.id,
        scope: { subjectIds: [subject.id], resourceIds: [] },
        prompt:
          "Use the study tools to find which worksheet exercise my note 'Limits' is about. Answer in one sentence naming the PDF and the exercise number.",
        cancelled: () => false,
        onStoppable: () => undefined,
      },
    );

    if (message.role !== "assistant") throw new Error("Expected a reply");
    console.log("STATUS:", message.status);
    console.log("ERROR:", JSON.stringify(message.error ?? null));
    console.log(
      "TOOLS:",
      message.tools.map((tool) => `${tool.summary} [${tool.status}]`),
    );
    console.log("PHASES:", [...phases]);
    console.log("TEXT:", message.text.slice(0, 700));

    expect(message.status).toBe("completed");
    expect(message.tools.length).toBeGreaterThan(0);
    expect(message.text.toLowerCase()).toContain("worksheet");
    await rm(directory, { recursive: true, force: true, maxRetries: 5 });
  },
);
