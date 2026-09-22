import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import yazl from "yazl";

import {
  docxHtml,
  readOffice,
} from "../../apps/desktop/src/main/workspace/office";
import {
  closeSearchIndex,
  searchWorkspace,
} from "../../apps/desktop/src/main/workspace/search";
import { readableText } from "../../apps/desktop/src/main/workspace/text";
import {
  createWorkspace,
  importFile,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-office-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

/** Writes a ZIP holding the given parts, the way Office files are made. */
function zip(name: string, parts: Record<string, string>): Promise<string> {
  const path = join(directory, name);
  const file = new yazl.ZipFile();
  for (const [part, text] of Object.entries(parts))
    file.addBuffer(Buffer.from(text), part);
  file.end();
  return new Promise((resolve, reject) => {
    file.outputStream
      .pipe(createWriteStream(path))
      .on("close", () => resolve(path))
      .on("error", reject);
  });
}

const slide = (...lines: string[]) =>
  `<p:sld><p:cSld><p:spTree>${lines
    .map((line) => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`)
    .join("")}</p:spTree></p:cSld></p:sld>`;

function pptx(): Promise<string> {
  return zip("Lecture 2.pptx", {
    "ppt/presentation.xml":
      '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>',
    "ppt/_rels/presentation.xml.rels":
      '<Relationships><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide2.xml"/></Relationships>',
    // The second file comes first in the presentation.
    "ppt/slides/slide1.xml": slide("The chain rule", "(f ∘ g)′ = f′(g) · g′"),
    "ppt/slides/slide2.xml": slide("Derivatives", "Rules &amp; examples"),
  });
}

describe("Office files", () => {
  it("reads a Word document's paragraphs", async () => {
    const path = await zip("Report.docx", {
      "word/document.xml":
        '<w:document><w:body><w:p><w:pPr/><w:r><w:t>Introduction</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Limits </w:t></w:r><w:r><w:t>and continuity</w:t></w:r></w:p></w:body></w:document>',
    });
    expect(await readOffice(path, ".docx")).toEqual({
      format: "docx",
      paragraphs: ["Introduction", "Limits and continuity"],
    });
  });

  it("lays out a Word document, keeping only web and mail links", async () => {
    const rel = (id: string, target: string) =>
      `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${target}" TargetMode="External"/>`;
    const link = (id: string, text: string) =>
      `<w:hyperlink r:id="${id}"><w:r><w:t>${text}</w:t></w:r></w:hyperlink>`;
    const path = await zip("Links.docx", {
      "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p>${link("rId1", "Course site")}</w:p><w:p>${link("rId2", "Trap")}</w:p></w:body></w:document>`,
      "word/_rels/document.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel("rId1", "https://example.edu/course")}${rel("rId2", "javascript:alert(1)")}</Relationships>`,
    });
    const html = await docxHtml(path);
    expect(html).toContain(
      '<a href="https://example.edu/course">Course site</a>',
    );
    expect(html).toContain("Trap");
    expect(html).not.toContain("javascript:");
  });

  it("reads slides in the order the presentation shows them", async () => {
    expect(await readOffice(await pptx(), ".pptx")).toEqual({
      format: "pptx",
      slides: [
        { lines: ["Derivatives", "Rules & examples"] },
        { lines: ["The chain rule", "(f ∘ g)′ = f′(g) · g′"] },
      ],
    });
  });

  it("reads a spreadsheet's sheets, cells in their columns", async () => {
    const path = await zip("Marks.xlsx", {
      "xl/workbook.xml":
        '<workbook><sheets><sheet name="Test 1" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels":
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/sharedStrings.xml":
        "<sst><si><t>Name</t></si><si><t>Mark</t></si><si><r><t>Ana </t></r><r><t>Silva</t></r></si></sst>",
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>15.5</v></c></row></sheetData></worksheet>',
    });
    expect(await readOffice(path, ".xlsx")).toEqual({
      format: "xlsx",
      sheets: [
        {
          name: "Test 1",
          rows: [
            ["Name", "Mark"],
            ["Ana Silva", "", "15.5"],
          ],
        },
      ],
    });
  });

  it("puts a presentation's slides in search and in the assistant's reach", async () => {
    const workspace: OpenWorkspace = await createWorkspace({
      folder: join(directory, "Studies"),
      name: "Studies",
      subject: { name: "Mathematics", color: "blue" },
    });
    try {
      const resource = await importFile(workspace, {
        subjectId: snapshot(workspace).subjects[0]!.id,
        sourcePath: await pptx(),
      });
      const hits = await searchWorkspace(workspace, "chain rule", {
        allow: () => true,
        limit: 5,
      });
      expect(hits.map((hit) => [hit.title, hit.page])).toEqual([
        ["Lecture 2", 2],
      ]);
      expect(await readableText(workspace, resource.id)).toContain(
        "--- Slide 2 ---\nThe chain rule",
      );
    } finally {
      closeSearchIndex(workspace);
    }
  });
});
