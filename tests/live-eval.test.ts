import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import yazl from "yazl";

/**
 * Asks the assistant a dozen fixed questions about a fixed workspace and
 * checks which study tools it used and what it answered, so a change to
 * the tools or the instructions can be measured instead of guessed at.
 * Spends real usage, so it only runs when asked:
 *
 *   RESIT_LIVE=1 npx vitest run tests/live-eval.test.ts
 *
 * RESIT_EVAL_PROVIDER=codex runs it against Codex instead of Claude.
 */
const live = process.env.RESIT_LIVE === "1";
const provider =
  process.env.RESIT_EVAL_PROVIDER === "codex" ? "codex" : "claude";

vi.mock("../apps/desktop/src/main/settings", () => ({
  loadSettings: () =>
    Promise.resolve({
      theme: "system",
      recent: [],
      provider:
        process.env.RESIT_EVAL_PROVIDER === "codex" ? "codex" : "claude",
      claude: {},
      codex: {},
    }),
}));

import { startTurn } from "../apps/desktop/src/main/agent/turns";
import { createConversation } from "../apps/desktop/src/main/conversations/store";
import { listPractice } from "../apps/desktop/src/main/practice/store";
import { listAnnotations } from "../apps/desktop/src/main/workspace/annotations";
import { closeSearchIndex } from "../apps/desktop/src/main/workspace/search";
import {
  activitiesPath,
  createNote,
  createWorkspace,
  importFile,
  linkSubject,
  readNote,
  snapshot,
  type OpenWorkspace,
} from "../apps/desktop/src/main/workspace/workspace";
import type { ChatMessage } from "../apps/desktop/src/shared/conversations";
import { samplePdf } from "./tools/sample-pdf.mjs";

let directory: string;
let workspace: OpenWorkspace;
let subjectId: string;
let textbookId: string;

function zip(path: string, parts: Record<string, string>): Promise<void> {
  const file = new yazl.ZipFile();
  for (const [part, text] of Object.entries(parts))
    file.addBuffer(Buffer.from(text), part);
  file.end();
  return new Promise((resolve, reject) => {
    file.outputStream
      .pipe(createWriteStream(path))
      .on("close", () => resolve())
      .on("error", reject);
  });
}

async function importText(name: string, body: string | Buffer) {
  const path = join(directory, name);
  await writeFile(path, body);
  return importFile(workspace, { subjectId, sourcePath: path });
}

const slide = (...lines: string[]) =>
  `<p:sld><p:cSld><p:spTree>${lines
    .map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`)
    .join("")}</p:spTree></p:cSld></p:sld>`;

beforeAll(async () => {
  if (!live) return;
  directory = await mkdtemp(join(tmpdir(), "resit-eval-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
  subjectId = snapshot(workspace).subjects[0]!.id;

  textbookId = (
    await importText(
      "Calculus.pdf",
      samplePdf(
        [
          {
            title: "Chapter 1: Limits",
            lines: [
              "A limit describes the value a function approaches.",
              "Squeeze theorem: if g <= f <= h and g, h tend to L, so does f.",
            ],
          },
          {
            title: "Chapter 1: Continuity",
            lines: [
              "Definition: f is continuous at a when the limit of f(x)",
              "as x tends to a equals f(a).",
            ],
          },
          {
            title: "Chapter 2: Derivatives",
            lines: [
              "The derivative of f at a is the limit of (f(a+h) - f(a))/h",
              "as h tends to 0.",
            ],
          },
          {
            title: "Chapter 2: The mean value theorem",
            lines: [
              "If f is continuous on [a, b] and differentiable on (a, b),",
              "some c in (a, b) has f'(c) = (f(b) - f(a))/(b - a).",
            ],
          },
          {
            title: "Chapter 2: The chain rule",
            lines: ["The derivative of f(g(x)) is f'(g(x)) g'(x)."],
          },
          {
            title: "Chapter 3: Integrals",
            lines: ["The integral adds up f(x) dx over an interval."],
          },
        ],
        { outline: true },
      ),
    )
  ).id;
  await importText(
    "Worksheet 1.pdf",
    samplePdf([
      {
        title: "Worksheet 1: Limits",
        lines: [
          "1. Compute the limit of sin(x)/x as x approaches 0.",
          "2. Show that the limit of (1 + 1/n)^n is e.",
        ],
      },
    ]),
  );
  await createNote(workspace, {
    subjectId,
    title: "Limits",
    body: "## Squeeze theorem\n\nsin(x)/x sits between cos(x) and 1 near 0, so its limit is 1.\n",
  });
  await importText(
    "study-log.csv",
    "week,topic,hours,score\n1,Limits,4.5,14\n2,Continuity,3,15.5\n3,Derivatives,5,12\n4,Chain rule,2.5,17\n",
  );
  const deck = join(directory, "Lecture 3.pptx");
  await zip(deck, {
    "ppt/presentation.xml":
      '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>',
    "ppt/_rels/presentation.xml.rels":
      '<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>',
    "ppt/slides/slide1.xml": slide("Lecture 3", "Derivatives"),
    "ppt/slides/slide2.xml": slide(
      "Rules",
      "Chain rule: (f ∘ g)′ = f′(g) · g′",
    ),
  });
  await importFile(workspace, { subjectId, sourcePath: deck });

  const siteUrl = "https://moodle.example.edu";
  await linkSubject(workspace, {
    subjectId,
    link: { siteUrl, courseId: 7, shortname: "AM1", fullname: "Calculus I" },
  });
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString();
  await writeFile(
    activitiesPath(workspace, subjectId),
    JSON.stringify({
      format: "resit-moodle-activities",
      formatVersion: 1,
      siteUrl,
      courseId: 7,
      checkedAt: new Date().toISOString(),
      sections: [
        {
          name: "Test 1",
          summary: "Test 1 covers chapter 1: limits and continuity.",
          moduleIds: [301],
        },
      ],
      activities: [
        {
          moduleId: 301,
          name: "Worksheet 1",
          modname: "assign",
          sectionName: "Test 1",
          url: `${siteUrl}/mod/assign/view.php?id=301`,
          dates: [{ type: "duedate", label: "Due", at: due }],
          brief: "Solve the worksheet and upload one PDF.",
          submission: "new",
        },
      ],
      announcements: [
        {
          id: 91,
          subject: "Test 1 moves to room B2.04",
          message: "Test 1 is now in room B2.04. The time does not change.",
          author: "Ana Silva",
          postedAt: new Date(Date.now() - 86_400_000).toISOString(),
          url: `${siteUrl}/mod/forum/discuss.php?d=91`,
        },
      ],
    }),
  );
}, 60_000);

afterAll(async () => {
  if (!live) return;
  closeSearchIndex(workspace);
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
});

/** One question in a new conversation, and the reply it got. */
async function ask(question: string): Promise<{
  text: string;
  tools: { name: string; summary: string }[];
}> {
  const conversation = await createConversation(
    workspace,
    { subjectIds: [subjectId], resourceIds: [] },
    provider,
  );
  const reply = await new Promise<ChatMessage>((resolve) => {
    void startTurn(
      workspace,
      (event) => {
        if (event.type === "turn-finished") resolve(event.message);
      },
      { conversationId: conversation.id, text: question, context: {} },
    );
  });
  if (reply.role !== "assistant") throw new Error("Expected a reply");
  if (reply.status !== "completed")
    throw new Error(`The reply ${reply.status}: ${reply.error?.detail ?? ""}`);
  const tools = reply.tools.map((tool) => ({
    name: tool.name.split("__").at(-1) ?? tool.name,
    summary: tool.summary,
  }));
  console.log(
    `\n${question}\n  tools: ${tools.map((tool) => tool.summary).join("; ")}\n  answer: ${reply.text.replace(/\s+/g, " ").slice(0, 300)}`,
  );
  return { text: reply.text, tools };
}

interface Case {
  question: string;
  /** At least one of these must be called. */
  tools: string[];
  /** A tool call whose summary matches, such as a run of pages. */
  summary?: RegExp;
  /** All of these must be in the answer. */
  says?: RegExp[];
  /** Checks the workspace afterwards. */
  check?: () => Promise<void>;
}

const CASES: Case[] = [
  {
    question:
      "On which page of the Calculus textbook does the mean value theorem start?",
    tools: ["study_get_pdf_outline", "study_search_pdf", "study_search"],
    says: [/\b(p\.?|page)\s*4\b/i],
  },
  {
    question: "Summarise chapter 2 of the Calculus textbook in three bullets.",
    tools: ["study_read_pdf_page"],
    summary: /pages \d+–\d+/,
    says: [/mean value/i, /chain rule/i],
  },
  {
    question: "When is Worksheet 1 due, and have I handed it in?",
    tools: ["study_list_activities", "study_read_activity"],
    says: [/\bnot\b/i],
  },
  {
    question: "Has anything changed about where Test 1 happens?",
    tools: ["study_read_announcements", "study_search"],
    says: [/B2\.04/],
  },
  {
    question: "What do the Lecture 3 slides say the chain rule is?",
    tools: ["study_read_file", "study_search"],
    says: [/g\s*['′]/],
  },
  {
    question:
      "In my study log, which week had my lowest score, and on what topic?",
    tools: ["study_read_file"],
    says: [/derivatives/i],
  },
  {
    question:
      "Create a note called 'MVT summary' with the statement of the mean value theorem from the textbook.",
    tools: ["study_create_note"],
    check: async () => {
      const note = snapshot(workspace).resources.find(
        (resource) => resource.title === "MVT summary",
      );
      expect(note).toBeDefined();
      expect((await readNote(workspace, note!.id)).body).toMatch(
        /differentiable/i,
      );
    },
  },
  {
    question:
      "Highlight the definition of continuity in the Calculus textbook.",
    tools: ["study_highlight_pdf"],
    check: async () => {
      const marks = await listAnnotations(workspace, textbookId);
      expect(
        marks.some((mark) =>
          mark.segments.some((segment) => segment.pageIndex === 1),
        ),
      ).toBe(true);
    },
  },
  {
    question: "Make three flashcards on limits for me.",
    tools: ["study_create_flashcards"],
    check: async () => {
      const { subjects } = await listPractice(workspace);
      const cards = subjects.flatMap((subject) => subject.cards);
      expect(cards.length).toBeGreaterThanOrEqual(3);
    },
  },
  {
    question: "What did I write about the squeeze theorem in my notes?",
    tools: ["study_search", "study_read_note"],
    says: [/cos/i],
  },
  {
    question:
      "Give me a hint for question 2 of Worksheet 1, without the full solution.",
    tools: ["study_search_pdf", "study_read_pdf_page", "study_search"],
    says: [/worksheet 1/i],
  },
  {
    question: "Which chapters does Test 1 cover, according to the course?",
    tools: ["study_list_activities", "study_search", "study_read_activity"],
    says: [/limits/i, /continuity/i],
  },
];

describe.skipIf(!live)(`the study assistant (${provider})`, () => {
  for (const entry of CASES)
    it(entry.question, { timeout: 300_000 }, async () => {
      const { text, tools } = await ask(entry.question);
      expect(
        tools
          .map((tool) => tool.name)
          .filter((name) => entry.tools.includes(name)),
        `called one of ${entry.tools.join(", ")}`,
      ).not.toEqual([]);
      if (entry.summary)
        expect(
          tools.some((tool) => entry.summary?.test(tool.summary)),
          `a call matching ${String(entry.summary)}`,
        ).toBe(true);
      for (const pattern of entry.says ?? []) expect(text).toMatch(pattern);
      await entry.check?.();
    });
});
