import type { AnnotationQuad, AnnotationSegment } from "../../shared/workspace";
import { pdfPages, pdfPageText, type PageText } from "./pdf-text";
import type { OpenWorkspace } from "./workspace";

/** Lowercase, without accents or spacing, so wrapped lines still match. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

interface CharSource {
  box: number;
  offset: number;
}

interface Located {
  box: number;
  start: number;
  /** Exclusive. */
  end: number;
}

/** Every character of the page's text, with the run each one came from. */
function pageCharacters(page: PageText): {
  text: string;
  sources: CharSource[];
} {
  let text = "";
  const sources: CharSource[] = [];
  page.boxes.forEach((box, index) => {
    for (let offset = 0; offset < box.text.length; offset += 1) {
      const folded = fold(box.text[offset] ?? "");
      for (let repeat = 0; repeat < folded.length; repeat += 1) {
        text += folded[repeat];
        sources.push({ box: index, offset });
      }
    }
  });
  return { text, sources };
}

/** The runs a match covers, with the part of each run it uses. */
function runsFor(
  sources: CharSource[],
  start: number,
  length: number,
): Located[] {
  const runs: Located[] = [];
  for (let index = start; index < start + length; index += 1) {
    const source = sources[index];
    if (!source) break;
    const last = runs.at(-1);
    if (last && last.box === source.box) last.end = source.offset + 1;
    else
      runs.push({
        box: source.box,
        start: source.offset,
        end: source.offset + 1,
      });
  }
  return runs;
}

interface Line {
  runs: Located[];
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Groups the matched runs into lines and measures each one. A run's own
 * characters are assumed to be evenly spaced, which is close enough to put
 * the highlight over the right words.
 */
function linesFor(page: PageText, runs: Located[]): Line[] {
  const lines: Line[] = [];
  for (const run of runs) {
    const box = page.boxes[run.box];
    if (!box || box.width <= 0 || box.text.length === 0) continue;
    const perCharacter = box.width / box.text.length;
    const left = box.x + perCharacter * run.start;
    const right = box.x + perCharacter * run.end;
    const top = box.y + box.height * 0.85;
    const bottom = box.y - box.height * 0.25;
    const line = lines.find(
      (entry) =>
        Math.abs((entry.top + entry.bottom) / 2 - (top + bottom) / 2) <
        box.height * 0.6,
    );
    if (line) {
      line.runs.push(run);
      line.left = Math.min(line.left, left);
      line.right = Math.max(line.right, right);
      line.top = Math.max(line.top, top);
      line.bottom = Math.min(line.bottom, bottom);
    } else lines.push({ runs: [run], top, bottom, left, right });
  }
  return lines;
}

function quadFor(line: Line): AnnotationQuad {
  return [
    line.left,
    line.top,
    line.right,
    line.top,
    line.left,
    line.bottom,
    line.right,
    line.bottom,
  ];
}

/** The quoted words as the PDF spells them, with line breaks as spaces. */
function quotedText(page: PageText, lines: Line[]): string {
  return lines
    .map((line) =>
      line.runs
        .map((run) => page.boxes[run.box]?.text.slice(run.start, run.end) ?? "")
        .join(""),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface QuoteMatch {
  /** One-based page the words were found on. */
  page: number;
  segment: AnnotationSegment;
  text: string;
}

/** Finds the words on one page and measures where they sit. */
export async function locateOnPage(
  workspace: OpenWorkspace,
  documentId: string,
  page: number,
  quote: string,
): Promise<QuoteMatch | null> {
  const wanted = fold(quote);
  if (!wanted) return null;
  const pageText = await pdfPageText(workspace, documentId, page);
  const { text, sources } = pageCharacters(pageText);
  const at = text.indexOf(wanted);
  if (at === -1) return null;
  const lines = linesFor(pageText, runsFor(sources, at, wanted.length));
  const quads = lines.map(quadFor).filter((quad) => quad[2] - quad[0] > 0.5);
  if (quads.length === 0) return null;
  return {
    page,
    segment: {
      pageIndex: page - 1,
      cropBox: pageText.view,
      quads,
      text: quotedText(pageText, lines),
    },
    text: quotedText(pageText, lines),
  };
}

/** One-based pages whose text contains the quote. */
export async function pagesWithQuote(
  workspace: OpenWorkspace,
  documentId: string,
  quote: string,
): Promise<number[]> {
  const wanted = fold(quote);
  if (!wanted) return [];
  const pages = await pdfPages(workspace, documentId);
  const found: number[] = [];
  pages.forEach((text, index) => {
    if (fold(text).includes(wanted)) found.push(index + 1);
  });
  return found;
}

/**
 * Where a quote sits in a PDF. Without a page, the pages whose text holds
 * the words are tried in order.
 */
export async function locateQuote(
  workspace: OpenWorkspace,
  documentId: string,
  quote: string,
  page?: number,
): Promise<QuoteMatch | null> {
  if (page !== undefined)
    return locateOnPage(workspace, documentId, page, quote);
  for (const candidate of await pagesWithQuote(workspace, documentId, quote)) {
    const match = await locateOnPage(workspace, documentId, candidate, quote);
    if (match) return match;
  }
  return null;
}
