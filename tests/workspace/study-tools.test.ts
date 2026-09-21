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
import { listNoteRevisions } from "../../apps/desktop/src/main/workspace/history";
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
  });
});
