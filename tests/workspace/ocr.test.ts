import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readablePages,
  recognitionState,
  recognizedPages,
  recognizePdf,
} from "../../apps/desktop/src/main/workspace/ocr";
import {
  closeSearchIndex,
  reindexResource,
  searchWorkspace,
} from "../../apps/desktop/src/main/workspace/search";
import {
  createWorkspace,
  importFile,
  replaceFile,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import { samplePdf } from "../tools/sample-pdf.mjs";

let directory: string;
let workspace: OpenWorkspace;
let pdfId: string;

/** Two scanned pages between two with text. */
const pages = [
  { title: "Worksheet 3", lines: ["Answer every question."] },
  { title: "", lines: [] },
  { title: "", lines: [] },
  { title: "Solutions", lines: ["See the lecture notes."] },
];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-ocr-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
  const source = join(directory, "Scan.pdf");
  await writeFile(source, samplePdf(pages));
  pdfId = (
    await importFile(workspace, {
      subjectId: snapshot(workspace).subjects[0]!.id,
      sourcePath: source,
    })
  ).id;
});

afterEach(async () => {
  closeSearchIndex(workspace);
  await rm(directory, { recursive: true, force: true });
});

/** Stands in for Tesseract: page 2 says one thing, page 3 another. */
function fakeRead(texts: Record<number, string>) {
  let page = 0;
  return {
    render: async (number: number) => {
      page = number;
      return new Uint8Array([number]);
    },
    recognizer: { recognize: async () => `  ${texts[page] ?? ""}\n` },
  };
}

describe("text recognition", () => {
  it("finds the pages with no text", async () => {
    expect(await recognitionState(workspace, pdfId)).toEqual({
      pageCount: 4,
      waiting: [2, 3],
      recognized: 0,
    });
  });

  it("reads scanned pages into the PDF's text and the search index", async () => {
    const progress: [number, number][] = [];
    const read = await recognizePdf(workspace, {
      documentId: pdfId,
      languages: ["eng"],
      ...fakeRead({ 2: "Integrate by substitution.", 3: "" }),
      onProgress: (done, total) => progress.push([done, total]),
      signal: new AbortController().signal,
    });
    expect(read).toBe(2);
    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    const text = await readablePages(workspace, pdfId);
    expect(text[1]).toBe("Integrate by substitution.");
    expect(text[0]).toContain("Answer every question.");
    expect([...(await recognizedPages(workspace, pdfId))].sort()).toEqual([
      2, 3,
    ]);
    // A page read and found blank is not offered again.
    expect(await recognitionState(workspace, pdfId)).toMatchObject({
      waiting: [],
      recognized: 2,
    });

    await reindexResource(workspace, pdfId);
    expect(
      await searchWorkspace(workspace, "substitution", {
        allow: () => true,
        limit: 10,
      }),
    ).toMatchObject([{ resourceId: pdfId, page: 2 }]);
  });

  it("keeps the pages already read when it is stopped", async () => {
    const controller = new AbortController();
    const read = await recognizePdf(workspace, {
      documentId: pdfId,
      languages: ["eng"],
      ...fakeRead({ 2: "First scanned page.", 3: "Second scanned page." }),
      onProgress: (done) => {
        if (done === 1) controller.abort();
      },
      signal: controller.signal,
    });
    expect(read).toBe(1);
    expect(await recognitionState(workspace, pdfId)).toMatchObject({
      waiting: [3],
      recognized: 1,
    });
  });

  it("forgets what it read when the PDF is replaced", async () => {
    await recognizePdf(workspace, {
      documentId: pdfId,
      languages: ["eng"],
      ...fakeRead({ 2: "Old scan.", 3: "Old scan." }),
      onProgress: () => undefined,
      signal: new AbortController().signal,
    });
    await replaceFile(workspace, {
      resourceId: pdfId,
      bytes: samplePdf([...pages, { title: "", lines: [] }]),
    });
    expect((await readablePages(workspace, pdfId)).join(" ")).not.toContain(
      "Old scan.",
    );
    expect((await recognitionState(workspace, pdfId)).waiting).toEqual([
      2, 3, 5,
    ]);
  });
});
