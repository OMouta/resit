import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  studyTools,
  type TurnGrant,
} from "../../apps/desktop/src/main/agent/study-tools";
import {
  createAnnotation,
  listAnnotations,
} from "../../apps/desktop/src/main/workspace/annotations";
import { setPersonalization } from "../../apps/desktop/src/main/learner/store";
import {
  readPlan,
  saveSession,
} from "../../apps/desktop/src/main/planning/store";
import {
  listPractice,
  startAttempt,
  submitAttempt,
} from "../../apps/desktop/src/main/practice/store";
import { useNetworkFetch } from "../../apps/desktop/src/main/moodle/client";
import { listItems } from "../../apps/desktop/src/main/moodle/sync";
import { listNoteRevisions } from "../../apps/desktop/src/main/workspace/history";
import {
  createProject,
  resolveScope,
} from "../../apps/desktop/src/main/workspace/projects";
import {
  activitiesPath,
  createNote,
  createSubject,
  createWorkspace,
  importFile,
  linkSubject,
  readNote,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import { samplePdf } from "../tools/sample-pdf.mjs";

let directory: string;
let workspace: OpenWorkspace;
let mathematicsId: string;
let physicsId: string;
let noteId: string;
let physicsNoteId: string;
let pdfId: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-study-tools-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
  mathematicsId = snapshot(workspace).subjects[0]!.id;
  physicsId = (
    await createSubject(workspace, { name: "Physics", color: "red" })
  ).id;
  noteId = (
    await createNote(workspace, {
      subjectId: mathematicsId,
      title: "Limits",
      body: "## Squeeze theorem\n\nBound the function above and below.\n",
    })
  ).id;
  physicsNoteId = (
    await createNote(workspace, {
      subjectId: physicsId,
      title: "Kinematics",
      body: "Constant acceleration.\n",
    })
  ).id;
  const source = join(directory, "Worksheet 1.pdf");
  await writeFile(
    source,
    samplePdf([
      { title: "Limits", lines: ["1. Compute the limit of sin x over x."] },
      { title: "Derivatives", lines: ["3. Differentiate x squared."] },
    ]),
  );
  pdfId = (
    await importFile(workspace, {
      subjectId: mathematicsId,
      sourcePath: source,
    })
  ).id;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

/** Runs one tool the way a provider would, and reads its JSON reply. */
async function run(
  name: string,
  input: unknown,
  grant: Partial<TurnGrant> = {},
): Promise<{
  data: Record<string, unknown>;
  failed: boolean;
  images: number;
}> {
  const tools = studyTools(workspace, {
    scope: { subjectIds: [mathematicsId], resourceIds: [] },
    ...grant,
  });
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`No tool named ${name}`);
  const result = await tool.run(input);
  const first = result.content.find((part) => part.type === "text");
  return {
    data: JSON.parse(first?.text ?? "{}") as Record<string, unknown>,
    failed: result.isError === true,
    images: result.content.filter((part) => part.type === "image").length,
  };
}

const errorCode = (data: Record<string, unknown>) =>
  (data.error as { code?: string } | undefined)?.code;

describe("study write tools", () => {
  it("creates a note in a subject in scope, and refuses one outside it", async () => {
    const created = await run("study_create_note", {
      subjectId: mathematicsId,
      title: "Worked solutions",
      markdown: "# Worked solutions\n\n1. Apply the squeeze theorem.\n",
    });
    expect(created.failed).toBe(false);
    const id = created.data.id as string;
    expect((await readNote(workspace, id)).body).toContain("squeeze theorem");

    const refused = await run("study_create_note", {
      subjectId: physicsId,
      title: "Not mine to write",
    });
    expect(errorCode(refused.data)).toBe("OUT_OF_SCOPE");
  });

  it("adds a note made in a project's conversation to the project", async () => {
    const project = await createProject(workspace, {
      title: "Exam prep",
      subjectIds: [],
      resourceIds: [physicsNoteId],
    });
    const created = await run(
      "study_create_note",
      { subjectId: physicsId, title: "Forces cheat sheet" },
      {
        scope: {
          ...resolveScope(workspace, {
            subjectIds: [],
            resourceIds: [],
            projectId: project.id,
          }),
          projectId: project.id,
        },
      },
    );
    expect(created.failed).toBe(false);
    expect(workspace.projects.get(project.id)?.info.resourceIds).toEqual([
      physicsNoteId,
      created.data.id,
    ]);
  });

  it("saves a diagram it wrote as a file, and only text formats", async () => {
    const saved = await run("study_save_file", {
      subjectId: mathematicsId,
      filename: "unit-circle.svg",
      content: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>',
    });
    expect(saved.failed).toBe(false);
    expect(saved.data).toMatchObject({ title: "unit-circle", kind: "image" });

    const refused = await run("study_save_file", {
      subjectId: mathematicsId,
      filename: "setup.exe",
      content: "MZ",
    });
    expect(errorCode(refused.data)).toBe("UNSUPPORTED");
  });

  it("files a note into a new folder and renames it", async () => {
    const folder = await run("study_create_folder", {
      subjectId: mathematicsId,
      name: "Revision",
    });
    expect(folder.data).toMatchObject({ folder: "Revision" });

    const moved = await run("study_move_file", {
      resourceId: noteId,
      folder: "Revision",
      title: "Limits, revised",
    });
    expect(moved.failed).toBe(false);
    const info = workspace.resources.get(noteId)?.info;
    expect(info).toMatchObject({
      folder: "Revision",
      title: "Limits, revised",
    });

    const refused = await run("study_move_file", {
      resourceId: noteId,
      subjectId: physicsId,
    });
    expect(errorCode(refused.data)).toBe("OUT_OF_SCOPE");
  });

  it("offers adding files to a project only in the project's conversation", async () => {
    const tools = studyTools(workspace, {
      scope: { subjectIds: [mathematicsId], resourceIds: [] },
    });
    expect(tools.some((tool) => tool.name === "study_add_to_project")).toBe(
      false,
    );
    const project = await createProject(workspace, {
      title: "Exam prep",
      subjectIds: [],
      resourceIds: [],
    });
    const added = await run(
      "study_add_to_project",
      { resourceIds: [noteId] },
      {
        scope: {
          subjectIds: [mathematicsId],
          resourceIds: [],
          projectId: project.id,
        },
      },
    );
    expect(added.failed).toBe(false);
    expect(workspace.projects.get(project.id)?.info.resourceIds).toEqual([
      noteId,
    ]);
  });

  it("replaces text in a note and keeps what it replaced", async () => {
    const edited = await run("study_edit_note", {
      noteId,
      edits: [
        {
          type: "replace",
          find: "Bound the function above and below.",
          replaceWith:
            "Bound $f$ above and below by functions with the same limit.",
        },
        { type: "append", markdown: "See Worksheet 1, p. 1." },
      ],
    });
    expect(edited.failed).toBe(false);

    const note = await readNote(workspace, noteId);
    expect(note.body).toContain("by functions with the same limit");
    expect(note.body).toContain("See Worksheet 1, p. 1.");
    expect(note.body).toContain("## Squeeze theorem");

    const revisions = await listNoteRevisions(workspace, noteId);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]!.cause).toBe("assistant");
  });

  it("refuses an edit it cannot place, and one made against stale text", async () => {
    const missing = await run("study_edit_note", {
      noteId,
      edits: [{ type: "replace", find: "not in the note", replaceWith: "x" }],
    });
    expect(errorCode(missing.data)).toBe("NOT_FOUND");

    const ambiguous = await run("study_edit_note", {
      noteId,
      edits: [{ type: "replace", find: "the", replaceWith: "a" }],
    });
    expect(errorCode(ambiguous.data)).toBe("AMBIGUOUS");

    const stale = await run("study_edit_note", {
      noteId,
      edits: [{ type: "append", markdown: "Late." }],
      expectedRevision: "sha256:something-else",
    });
    expect(errorCode(stale.data)).toBe("REVISION_CONFLICT");
    expect((await readNote(workspace, noteId)).body).not.toContain("Late.");
  });

  it("highlights quoted words where they sit on the page", async () => {
    const marked = await run("study_highlight_pdf", {
      documentId: pdfId,
      quote: "Differentiate x squared",
      comment: "Start from the definition.",
    });
    expect(marked.failed).toBe(false);
    expect(marked.data.page).toBe(2);
    expect(marked.data.link).toContain("page=2");

    const [annotation] = await listAnnotations(workspace, pdfId);
    expect(annotation?.author).toBe("assistant");
    expect(annotation?.comment).toBe("Start from the definition.");
    const segment = annotation!.segments[0]!;
    expect(segment.pageIndex).toBe(1);
    expect(segment.cropBox).toEqual([0, 0, 595, 842]);
    expect(segment.text).toContain("Differentiate x squared");
    const quad = segment.quads[0]!;
    // Top-left, top-right, bottom-left, bottom-right, inside the page.
    expect(quad[0]).toBeGreaterThan(0);
    expect(quad[2]).toBeGreaterThan(quad[0]);
    expect(quad[1]).toBeGreaterThan(quad[5]);
    expect(quad[1]).toBeLessThan(842);
  });

  it("says where the words are when the page is wrong", async () => {
    const wrong = await run("study_highlight_pdf", {
      documentId: pdfId,
      quote: "Differentiate x squared",
      page: 1,
    });
    expect(errorCode(wrong.data)).toBe("NOT_FOUND");
    expect(String((wrong.data.error as { message: string }).message)).toContain(
      "page 2",
    );
    expect(await listAnnotations(workspace, pdfId)).toHaveLength(0);
  });

  it("removes its own highlights and leaves the student's alone", async () => {
    const theirs = await createAnnotation(workspace, {
      documentId: pdfId,
      type: "highlight",
      color: "yellow",
      segments: [
        {
          pageIndex: 0,
          cropBox: [0, 0, 595, 842],
          quads: [[72, 730, 300, 730, 72, 715, 300, 715]],
          text: "1. Compute the limit",
        },
      ],
    });
    const mine = await run("study_highlight_pdf", {
      documentId: pdfId,
      quote: "Differentiate x squared",
    });

    const refused = await run("study_delete_highlight", {
      documentId: pdfId,
      highlightId: theirs.id,
    });
    expect(errorCode(refused.data)).toBe("FORBIDDEN");

    const removed = await run("study_delete_highlight", {
      documentId: pdfId,
      highlightId: mine.data.highlightId,
    });
    expect(removed.failed).toBe(false);
    expect((await listAnnotations(workspace, pdfId)).map((a) => a.id)).toEqual([
      theirs.id,
    ]);
  });
});

describe("study read tools", () => {
  it("reads the file the student had open, even from another subject", async () => {
    const context = {
      focused: {
        resourceId: physicsNoteId,
        title: "Kinematics",
        kind: "note" as const,
      },
    };
    const open = await run(
      "study_read_note",
      { noteId: physicsNoteId },
      {
        context,
      },
    );
    expect(open.data.markdown).toContain("Constant acceleration.");

    const other = (
      await createNote(workspace, {
        subjectId: physicsId,
        title: "Momentum",
        body: "Collisions.\n",
      })
    ).id;
    const refused = await run(
      "study_read_note",
      { noteId: other },
      { context },
    );
    expect(errorCode(refused.data)).toBe("OUT_OF_SCOPE");
  });

  it("draws a page only for an assistant that can be given images", async () => {
    const textOnly = await run("study_read_pdf_page", {
      documentId: pdfId,
      page: 1,
      as: "image",
    });
    expect(errorCode(textOnly.data)).toBe("UNSUPPORTED_MEDIA");

    const drawn = await run(
      "study_read_pdf_page",
      { documentId: pdfId, page: 2, as: "image" },
      {
        images: true,
        renderPage: ({ page }) =>
          Promise.resolve({
            data: Buffer.from(`page ${page}`).toString("base64"),
            mimeType: "image/png",
            width: 1400,
            height: 1980,
          }),
      },
    );
    expect(drawn.images).toBe(1);
    expect(drawn.data.extraction).toBe("image");
    expect(drawn.data.page).toBe(2);
  });

  it("reads a run of pages in one call", async () => {
    const read = await run("study_read_pdf_page", {
      documentId: pdfId,
      page: 1,
      lastPage: 9,
    });
    const pages = read.data.pages as { page: number; text: string }[];
    expect(pages.map((entry) => entry.page)).toEqual([1, 2]);
    expect(pages[1]?.text).toContain("Differentiate x squared");
    // The PDF ends at page 2, so nothing is left to read.
    expect(read.data.nextPage).toBeUndefined();
  });

  it("finds which pages hold a phrase", async () => {
    const found = await run("study_search_pdf", {
      documentId: pdfId,
      query: "differentiate",
    });
    expect(
      (found.data.matches as { page: number }[]).map((match) => match.page),
    ).toEqual([2]);
  });

  it("reports what the student has open, and what it may read", async () => {
    const open = await run(
      "study_get_open_files",
      {},
      {
        liveContext: () => ({
          at: "2026-09-20T10:00:00.000Z",
          files: [
            {
              resourceId: pdfId,
              title: "Worksheet 1",
              kind: "pdf",
              pane: 1,
              visible: true,
              focused: true,
              page: 2,
            },
            {
              resourceId: physicsNoteId,
              title: "Kinematics",
              kind: "note",
              pane: 2,
              visible: true,
              focused: false,
            },
          ],
        }),
      },
    );
    const files = open.data.openFiles as { id: string; readable: boolean }[];
    expect(files.map((file) => file.readable)).toEqual([true, false]);
  });

  it("reads Moodle activities of the subjects in scope only", async () => {
    const siteUrl = "https://moodle.example.edu";
    for (const [subjectId, courseId, moduleId] of [
      [mathematicsId, 7, 301],
      [physicsId, 8, 302],
    ] as const) {
      await linkSubject(workspace, {
        subjectId,
        link: { siteUrl, courseId, shortname: "C", fullname: "Course" },
      });
      await writeFile(
        activitiesPath(workspace, subjectId),
        JSON.stringify({
          format: "resit-moodle-activities",
          formatVersion: 1,
          siteUrl,
          courseId,
          checkedAt: "2026-09-20T10:00:00.000Z",
          activities: [
            {
              moduleId,
              name: `Project ${moduleId}`,
              modname: "assign",
              sectionName: "Week 1",
              url: `${siteUrl}/mod/assign/view.php?id=${moduleId}`,
              dates: [
                {
                  type: "duedate",
                  label: "Due",
                  at: "2026-10-01T22:59:00.000Z",
                },
              ],
              brief: "Write a report.",
            },
          ],
          announcements: [
            {
              id: moduleId,
              subject: `Room change ${courseId}`,
              message: "The test moves to B2.04.",
              author: "Prof. Silva",
              postedAt: "2026-09-19T08:00:00.000Z",
              url: `${siteUrl}/mod/forum/discuss.php?d=${moduleId}`,
            },
          ],
        }),
      );
    }

    const listed = await run("study_list_activities", {});
    const subjects = listed.data.subjects as {
      subjectId: string;
      activities: { activityId: string; hasBrief: boolean }[];
    }[];
    expect(subjects.map((entry) => entry.subjectId)).toEqual([mathematicsId]);
    expect(subjects[0]?.activities).toMatchObject([
      { activityId: "301", hasBrief: true },
    ]);

    const read = await run("study_read_activity", { activityId: "301" });
    expect(read.data.brief).toBe("Write a report.");

    const refused = await run("study_read_activity", { activityId: "302" });
    expect(errorCode(refused.data)).toBe("OUT_OF_SCOPE");

    const news = await run("study_read_announcements", {});
    expect(news.data.subjects).toMatchObject([
      {
        subjectId: mathematicsId,
        announcements: [
          { subject: "Room change 7", message: "The test moves to B2.04." },
        ],
      },
    ]);
  });
});

describe("Moodle downloads", () => {
  it("downloads a course file the conversation can then read", async () => {
    const siteUrl = "https://moodle.example.edu";
    const session = { siteUrl, token: "secret" };
    await linkSubject(workspace, {
      subjectId: mathematicsId,
      link: { siteUrl, courseId: 7, shortname: "C", fullname: "Course" },
    });
    useNetworkFetch((url) => {
      if (new URL(url).pathname.endsWith("/server.php"))
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 1,
                name: "Week 1",
                section: 1,
                modules: [
                  {
                    id: 50,
                    name: "Notes on limits",
                    modname: "resource",
                    url: `${siteUrl}/mod/resource/view.php?id=50`,
                    contents: [
                      {
                        type: "file",
                        filename: "limits.txt",
                        filepath: "/",
                        filesize: 12,
                        fileurl: `${siteUrl}/webservice/pluginfile.php/1/mod_resource/content/0/limits.txt`,
                        timemodified: 1700000000,
                      },
                    ],
                  },
                ],
              },
            ]),
            { headers: { "content-type": "application/json" } },
          ),
        );
      return Promise.resolve(new Response("Limits: 0/0."));
    });
    try {
      await listItems(workspace, session, mathematicsId);
      const listed = await run("study_list_activities", {});
      const [subject] = listed.data.subjects as {
        filesNotDownloaded: { key: string }[];
      }[];
      expect(subject?.filesNotDownloaded).toEqual([
        {
          key: "50:/limits.txt",
          name: "Notes on limits",
          filename: "limits.txt",
        },
      ]);

      const downloaded = await run(
        "study_download_moodle_files",
        { subjectId: mathematicsId, keys: ["50:/limits.txt"] },
        { moodle: () => Promise.resolve(session) },
      );
      expect(downloaded.failed).toBe(false);
      const [file] = downloaded.data.files as { id: string }[];
      const read = await run("study_read_file", { resourceId: file?.id });
      expect(read.data.text).toBe("Limits: 0/0.");

      const refused = await run(
        "study_download_moodle_files",
        { subjectId: physicsId, keys: ["50:/limits.txt"] },
        { moodle: () => Promise.resolve(session) },
      );
      expect(errorCode(refused.data)).toBe("OUT_OF_SCOPE");
    } finally {
      useNetworkFetch(fetch);
    }
  });
});

describe("downloads from the web", () => {
  const pdf = Buffer.from("%PDF-1.4 a paper");
  const web = (body: Uint8Array | string, type: string) => () =>
    Promise.resolve(new Response(body, { headers: { "content-type": type } }));

  it("downloads a file only once the student allows it", async () => {
    const asked: string[] = [];
    const declined = await run(
      "study_import_url",
      {
        subjectId: mathematicsId,
        url: "https://example.org/papers/limits.pdf",
      },
      {
        ask: (question) => {
          asked.push(question.detail);
          return Promise.resolve(false);
        },
        web: web(pdf, "application/pdf"),
      },
    );
    expect(errorCode(declined.data)).toBe("DECLINED");
    expect(asked).toEqual(["example.org/papers/limits.pdf, into Mathematics"]);

    const saved = await run(
      "study_import_url",
      {
        subjectId: mathematicsId,
        url: "https://example.org/papers/limits.pdf",
      },
      { ask: () => Promise.resolve(true), web: web(pdf, "application/pdf") },
    );
    expect(saved.failed).toBe(false);
    expect(saved.data).toMatchObject({ title: "limits", kind: "pdf" });
  });

  it("refuses a sign-in page that claims to be a PDF, and other types", async () => {
    const page = await run(
      "study_import_url",
      { subjectId: mathematicsId, url: "https://example.org/paper.pdf" },
      {
        ask: () => Promise.resolve(true),
        web: web("<html>Sign in</html>", "application/pdf"),
      },
    );
    expect(errorCode(page.data)).toBe("UNSUPPORTED");
    const program = await run(
      "study_import_url",
      { subjectId: mathematicsId, url: "https://example.org/setup.exe" },
      {
        ask: () => Promise.resolve(true),
        web: web("MZ", "application/octet-stream"),
      },
    );
    expect(errorCode(program.data)).toBe("UNSUPPORTED");
  });
});

describe("practice tools", () => {
  it("suggests cards that wait for the student, and refuses another subject", async () => {
    const made = await run("study_create_flashcards", {
      subjectId: mathematicsId,
      cards: [
        {
          kind: "basic",
          front: "What is 2 + 2?",
          back: "4",
          topic: "Arithmetic",
        },
        {
          kind: "cloze",
          front: "The derivative of x^2 is {{c1::2x}}.",
          back: "",
          source: { resourceId: pdfId, page: 2 },
        },
      ],
    });
    expect(made.failed).toBe(false);
    expect(made.data.suggested).toBe(2);
    const { subjects } = await listPractice(workspace);
    const cards = subjects.find(
      (entry) => entry.subjectId === mathematicsId,
    )!.cards;
    expect(cards.every((card) => card.status === "suggested")).toBe(true);
    expect(cards[1]!.source).toEqual({ resourceId: pdfId, page: 2 });

    const refused = await run("study_create_flashcards", {
      subjectId: physicsId,
      cards: [{ kind: "basic", front: "F?", back: "ma" }],
    });
    expect(errorCode(refused.data)).toBe("OUT_OF_SCOPE");
  });

  it("makes a quiz, requires solutions to worked questions, and reads back the student's answers", async () => {
    const missing = await run("study_create_quiz", {
      subjectId: mathematicsId,
      title: "Limits",
      questions: [{ kind: "worked", prompt: "Prove it." }],
    });
    expect(errorCode(missing.data)).toBe("INVALID_INPUT");

    const made = await run("study_create_quiz", {
      subjectId: mathematicsId,
      title: "Limits",
      topic: "Limits",
      questions: [
        { kind: "short", prompt: "2 + 3?", answer: "5" },
        { kind: "worked", prompt: "Prove it.", solution: "Because." },
      ],
    });
    expect(made.failed).toBe(false);
    const quizId = made.data.quizId as string;
    const attempt = await startAttempt(workspace, mathematicsId, quizId);
    await submitAttempt(workspace, mathematicsId, quizId, attempt.id, {
      [attempt.questions[0]!.id]: { answer: "6" },
    });

    const read = await run("study_read_quiz", {
      subjectId: mathematicsId,
      quizId,
    });
    const [last] = read.data.attempts as {
      answers: { answer: string; mark: string }[];
    }[];
    expect(last!.answers[0]).toMatchObject({ answer: "6", mark: "incorrect" });
    expect(last!.answers[1]!.mark).toBe("not marked yet");

    const listed = await run("study_list_practice", {});
    const [subject] = listed.data.subjects as {
      quizzes: { title: string; lastScore: { correct: number } | null }[];
    }[];
    expect(subject!.quizzes[0]).toMatchObject({
      title: "Limits",
      lastScore: { correct: 0 },
    });
  });
});

describe("planning tools", () => {
  /** A date a week from now, so suggestions are never in the past. */
  const nextWeek = () => {
    const day = new Date();
    day.setDate(day.getDate() + 7);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  };

  it("suggests sessions, refuses overlaps, and shows other subjects only as busy time", async () => {
    const date = nextWeek();
    await saveSession(workspace, {
      title: "Kinematics problems",
      subjectId: physicsId,
      kind: "exercises",
      date,
      start: "18:00",
      end: "19:00",
    });
    const clash = await run("study_propose_sessions", {
      sessions: [
        {
          title: "Limits",
          subjectId: mathematicsId,
          kind: "reading",
          date,
          start: "18:30",
          end: "19:30",
        },
      ],
    });
    expect(errorCode(clash.data)).toBe("CONFLICT");

    const made = await run("study_propose_sessions", {
      sessions: [
        {
          title: "Limits",
          subjectId: mathematicsId,
          kind: "reading",
          date,
          start: "19:00",
          end: "20:00",
          opens: { resourceId: pdfId },
          reason: "Test on Friday",
        },
      ],
    });
    expect(made.failed).toBe(false);
    const plan = await readPlan(workspace);
    const suggestion = plan.sessions.find(
      (session) => session.title === "Limits",
    );
    expect(suggestion?.proposal).toEqual({ reason: "Test on Friday" });
    expect(suggestion?.target).toEqual({ type: "resource", resourceId: pdfId });

    const read = await run("study_get_plan", { from: date, days: 1 });
    const sessions = read.data.sessions as Record<string, unknown>[];
    expect(sessions[0]).toEqual({
      busy: true,
      date,
      start: "18:00",
      end: "19:00",
    });
    expect(sessions[1]).toMatchObject({
      title: "Limits",
      waitingForTheStudent: true,
    });
  });

  it("adds an assessment only to a subject in scope", async () => {
    const added = await run("study_add_assessment", {
      title: "Test 1",
      subjectId: mathematicsId,
      date: nextWeek(),
      time: "09:00",
    });
    expect(added.failed).toBe(false);
    const refused = await run("study_add_assessment", {
      title: "Physics exam",
      subjectId: physicsId,
      date: nextWeek(),
    });
    expect(errorCode(refused.data)).toBe("OUT_OF_SCOPE");
    expect((await readPlan(workspace)).assessments).toHaveLength(1);
  });
});

describe("learner tools", () => {
  it("suggests a topic for the student to accept, and reads only subjects in scope", async () => {
    const suggested = await run("study_propose_topic", {
      name: "Limits",
      subjectId: mathematicsId,
      level: "gap",
      reason: "Forgot most cards on it this week",
    });
    expect(suggested.failed).toBe(false);
    const refused = await run("study_propose_topic", {
      name: "Kinematics",
      subjectId: physicsId,
      level: "gap",
      reason: "Wrong twice",
    });
    expect(errorCode(refused.data)).toBe("OUT_OF_SCOPE");

    const profile = await run("study_get_learner_profile", {});
    expect(profile.data.waitingForTheStudent).toEqual([
      { name: "Limits", level: "gap" },
    ]);

    await setPersonalization(workspace, false);
    const off = await run("study_get_learner_profile", {});
    expect(off.data.personalization).toBe(false);
  });
});
