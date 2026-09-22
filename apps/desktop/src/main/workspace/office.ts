import mammoth from "mammoth";
import yauzl from "yauzl";

import type { OfficeContent } from "../../shared/workspace";

/** Parts larger than this are left out, so a crafted file cannot fill memory. */
const MAX_PART_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 2000;
const MAX_COLUMNS = 60;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decode(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (!code.startsWith("#")) return ENTITIES[code.toLowerCase()] ?? match;
      const value =
        code[1]?.toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return value > 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : match;
    },
  );
}

/** The named parts of an Office file, read as text. */
async function readParts(
  path: string,
  wanted: (name: string) => boolean,
): Promise<Map<string, string>> {
  const zip = await yauzl.openPromise(path, {
    lazyEntries: true,
    autoClose: false,
  });
  const parts = new Map<string, string>();
  try {
    await new Promise<void>((resolve, reject) => {
      zip.on("entry", (entry: yauzl.Entry) => {
        if (
          !wanted(entry.fileName) ||
          entry.uncompressedSize > MAX_PART_BYTES
        ) {
          zip.readEntry();
          return;
        }
        void (async () => {
          const chunks: Buffer[] = [];
          for await (const chunk of await zip.openReadStreamPromise(entry))
            chunks.push(chunk as Buffer);
          parts.set(entry.fileName, Buffer.concat(chunks).toString("utf8"));
          zip.readEntry();
        })().catch(reject);
      });
      zip.on("end", () => resolve());
      zip.on("error", reject);
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
  return parts;
}

/** Relationship IDs to their targets, from a `.rels` part. */
function relationships(xml: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of (xml ?? "").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(match[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(match[0])?.[1];
    if (id && target) map.set(id, target);
  }
  return map;
}

/** Paragraphs of text, with runs joined, from WordprocessingML or DrawingML. */
function paragraphs(xml: string, prefix: "w" | "a"): string[] {
  const found: string[] = [];
  let current = "";
  const token = new RegExp(
    `<${prefix}:p[ >]|</${prefix}:p>|<${prefix}:t(?: [^>]*)?>([^<]*)</${prefix}:t>|<${prefix}:tab/>|<${prefix}:br/>`,
    "g",
  );
  for (const match of xml.matchAll(token)) {
    const tag = match[0];
    if (tag.startsWith(`</${prefix}:p`)) {
      found.push(current);
      current = "";
    } else if (tag.startsWith(`<${prefix}:p`)) current = "";
    else if (tag.startsWith(`<${prefix}:tab`)) current += "\t";
    else if (tag.startsWith(`<${prefix}:br`)) current += "\n";
    else current += decode(match[1] ?? "");
  }
  return found.map((line) => line.trim()).filter(Boolean);
}

async function readDocx(path: string): Promise<OfficeContent> {
  const parts = await readParts(path, (name) => name === "word/document.xml");
  return {
    format: "docx",
    paragraphs: paragraphs(parts.get("word/document.xml") ?? "", "w"),
  };
}

async function readPptx(path: string): Promise<OfficeContent> {
  const parts = await readParts(
    path,
    (name) =>
      name === "ppt/presentation.xml" ||
      name === "ppt/_rels/presentation.xml.rels" ||
      /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  const rels = relationships(parts.get("ppt/_rels/presentation.xml.rels"));
  // The order the presentation shows its slides in, not their file numbers.
  const order = [
    ...(parts.get("ppt/presentation.xml") ?? "").matchAll(
      /<p:sldId\b[^>]*\br:id="([^"]+)"/g,
    ),
  ].flatMap((match) => {
    const target = rels.get(match[1] ?? "");
    return target ? [`ppt/${target.replace(/^\/?(ppt\/)?/, "")}`] : [];
  });
  const names =
    order.length > 0
      ? order
      : [...parts.keys()]
          .filter((name) => name.startsWith("ppt/slides/"))
          .sort(
            (a, b) =>
              Number(/(\d+)\.xml$/.exec(a)?.[1]) -
              Number(/(\d+)\.xml$/.exec(b)?.[1]),
          );
  return {
    format: "pptx",
    slides: names.map((name) => ({
      lines: paragraphs(parts.get(name) ?? "", "a"),
    })),
  };
}

/** Column letters to a zero-based index: A is 0, AA is 26. */
function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "A";
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

async function readXlsx(path: string): Promise<OfficeContent> {
  const parts = await readParts(
    path,
    (name) =>
      name === "xl/workbook.xml" ||
      name === "xl/_rels/workbook.xml.rels" ||
      name === "xl/sharedStrings.xml" ||
      /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );
  const shared = [
    ...(parts.get("xl/sharedStrings.xml") ?? "").matchAll(
      /<si>([\s\S]*?)<\/si>/g,
    ),
  ].map((match) =>
    [...(match[1] ?? "").matchAll(/<t(?: [^>]*)?>([^<]*)<\/t>/g)]
      .map((text) => decode(text[1] ?? ""))
      .join(""),
  );
  const rels = relationships(parts.get("xl/_rels/workbook.xml.rels"));
  const sheets = [
    ...(parts.get("xl/workbook.xml") ?? "").matchAll(/<sheet\b[^>]*>/g),
  ].flatMap((match) => {
    const name = decode(/\bname="([^"]*)"/.exec(match[0])?.[1] ?? "");
    const target = rels.get(/\br:id="([^"]+)"/.exec(match[0])?.[1] ?? "");
    const xml = target
      ? parts.get(`xl/${target.replace(/^\/?(xl\/)?/, "")}`)
      : undefined;
    if (xml === undefined) return [];
    const rows: string[][] = [];
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (rows.length >= MAX_ROWS) break;
      const cells: string[] = [];
      for (const cell of (row[1] ?? "").matchAll(
        /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
      )) {
        const attributes = cell[1] ?? "";
        const body = cell[2] ?? "";
        const column = columnIndex(
          /\br="([A-Z]+)\d+"/.exec(attributes)?.[1] ?? "",
        );
        if (column >= MAX_COLUMNS) continue;
        const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
        const value = /<v>([^<]*)<\/v>/.exec(body)?.[1];
        let text: string;
        if (type === "s") text = shared[Number(value)] ?? "";
        else if (type === "inlineStr")
          text = decode(/<t(?: [^>]*)?>([^<]*)<\/t>/.exec(body)?.[1] ?? "");
        else if (type === "b") text = value === "1" ? "TRUE" : "FALSE";
        else text = decode(value ?? "");
        while (cells.length < column) cells.push("");
        cells[column < 0 ? cells.length : column] = text;
      }
      rows.push(cells);
    }
    return [{ name, rows }];
  });
  return { format: "xlsx", sheets };
}

const READERS: Record<string, (path: string) => Promise<OfficeContent>> = {
  ".docx": readDocx,
  ".pptx": readPptx,
  ".xlsx": readXlsx,
};

/** The text in a Word, PowerPoint, or Excel file, or null for anything else. */
export async function readOffice(
  path: string,
  extension: string,
): Promise<OfficeContent | null> {
  const reader = READERS[extension];
  return reader ? reader(path) : null;
}

/**
 * A Word document as HTML with its headings, lists, tables, and images.
 * Links keep only web and mail addresses; the window opens those outside.
 */
export async function docxHtml(path: string): Promise<string> {
  const { value } = await mammoth.convertToHtml({ path });
  return value.replace(/\shref="([^"]*)"/g, (whole, href: string) =>
    /^(https?:|mailto:)/i.test(decode(href)) ? whole : "",
  );
}

/** The content as plain text: one page per slide or sheet. */
export function officePages(content: OfficeContent): string[] {
  if (content.format === "docx") return [content.paragraphs.join("\n")];
  if (content.format === "pptx")
    return content.slides.map((slide) => slide.lines.join("\n"));
  return content.sheets.map((sheet) =>
    [sheet.name, ...sheet.rows.map((row) => row.join("\t"))].join("\n"),
  );
}
