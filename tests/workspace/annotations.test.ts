import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from "../../apps/desktop/src/main/workspace/annotations";
import {
  createWorkspace,
  deleteResource,
  importFile,
  openWorkspace,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import type { AnnotationSegment } from "../../apps/desktop/src/shared/workspace";
import { samplePdf } from "../tools/sample-pdf.mjs";

let directory: string;
let workspace: OpenWorkspace;
let pdfId: string;

const segments: AnnotationSegment[] = [
  {
    pageIndex: 6,
    cropBox: [0, 0, 595, 842],
    quads: [[120, 224, 421, 224, 120, 203, 421, 203]],
    text: "lim x→0 sin(x)/x",
  },
];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-annotations-"));
  workspace = await createWorkspace({
    folder: join(directory, "ISEP"),
    name: "ISEP 2026/27",
    subject: { name: "Mathematics", color: "blue" },
  });
  const source = join(directory, "Worksheet 1.pdf");
  await writeFile(
    source,
    samplePdf([{ title: "Limits", lines: ["1. Compute sin(x)/x."] }]),
  );
  const subject = snapshot(workspace).subjects[0]!;
  const imported = await importFile(workspace, {
    subjectId: subject.id,
    sourcePath: source,
  });
  pdfId = imported.id;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function annotationsDirectory(): string {
  return join(workspace.root, "subjects", "mathematics", "annotations");
}

describe("pdf annotations", () => {
  it("saves highlights beside the subject and reads them back after reopening", async () => {
    const created = await createAnnotation(workspace, {
      documentId: pdfId,
      type: "highlight",
      color: "yellow",
      segments,
    });
    expect(created.documentRevision).toMatch(/^sha256:/);
    expect(await readdir(annotationsDirectory())).toEqual([`${pdfId}.json`]);

    const reopened = await openWorkspace(workspace.root);
    const saved = await listAnnotations(reopened, pdfId);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      id: created.id,
      type: "highlight",
      color: "yellow",
      segments,
    });
  });

  it("leaves the PDF itself untouched", async () => {
    const before = await readFile(join(workspace.root, ...pdfPath()));
    await createAnnotation(workspace, {
      documentId: pdfId,
      type: "highlight",
      color: "green",
      segments,
    });
    const after = await readFile(join(workspace.root, ...pdfPath()));
    expect(after.equals(before)).toBe(true);
  });

  it("changes colour and comment, and deletes", async () => {
    const created = await createAnnotation(workspace, {
      documentId: pdfId,
      type: "highlight",
      color: "yellow",
      segments,
    });
    const commented = await updateAnnotation(workspace, {
      documentId: pdfId,
      id: created.id,
      color: "pink",
      comment: "I did not understand this step",
    });
    expect(commented.color).toBe("pink");
    expect(commented.comment).toBe("I did not understand this step");
    expect(commented.updatedAt >= created.updatedAt).toBe(true);

    const cleared = await updateAnnotation(workspace, {
      documentId: pdfId,
      id: created.id,
      comment: "",
    });
    expect(cleared.comment).toBeUndefined();

    await deleteAnnotation(workspace, { documentId: pdfId, id: created.id });
    expect(await listAnnotations(workspace, pdfId)).toEqual([]);
    await expect(
      deleteAnnotation(workspace, { documentId: pdfId, id: created.id }),
    ).rejects.toThrow(/no longer in this PDF/);
  });

  it("moves highlights to the trash with their PDF", async () => {
    await createAnnotation(workspace, {
      documentId: pdfId,
      type: "underline",
      color: "blue",
      segments,
    });
    await deleteResource(workspace, pdfId);
    expect(await readdir(annotationsDirectory())).toEqual([]);
    const trash = join(workspace.root, ".resit", "trash");
    const [stamp] = await readdir(trash);
    expect(await readdir(join(trash, stamp!))).toContain(`${pdfId}.json`);
  });

  it("reports an unreadable highlights file instead of replacing it", async () => {
    await createAnnotation(workspace, {
      documentId: pdfId,
      type: "highlight",
      color: "yellow",
      segments,
    });
    const path = join(annotationsDirectory(), `${pdfId}.json`);
    await writeFile(path, "{ not json");
    await expect(listAnnotations(workspace, pdfId)).rejects.toThrow(
      /not valid JSON/,
    );
    await expect(
      createAnnotation(workspace, {
        documentId: pdfId,
        type: "highlight",
        color: "blue",
        segments,
      }),
    ).rejects.toThrow(/not valid JSON/);
    expect(await readFile(path, "utf8")).toBe("{ not json");
  });
});

function pdfPath(): string[] {
  const resource = snapshot(workspace).resources.find(
    (entry) => entry.id === pdfId,
  );
  if (!resource) throw new Error("Missing PDF");
  return resource.path.split("/");
}
