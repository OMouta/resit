import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parentPort } from "node:worker_threads";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * This file's own path, so tests that import it directly can still start it
 * as a worker. The application build imports it through `?modulePath`.
 */
export default fileURLToPath(import.meta.url);

export interface ExtractRequest {
  id: number;
  path: string;
  /** One-based page to return text positions for, instead of all the text. */
  page?: number;
}

/** One run of text on a page, in unrotated PDF user space. */
export interface TextBox {
  text: string;
  /** Left edge of the run, on its baseline. */
  x: number;
  y: number;
  width: number;
  /** Font size, so a line's box can be drawn around its baseline. */
  height: number;
}

export interface PageText {
  pageCount: number;
  /** The page's crop box, `[xMin, yMin, xMax, yMax]`. */
  view: [number, number, number, number];
  boxes: TextBox[];
}

export type ExtractResponse =
  | { id: number; pages: string[] }
  | { id: number; page: PageText }
  | { id: number; error: string };

async function documentFor(path: string) {
  return getDocument({
    // PDF.js rejects Node Buffers; it wants a plain Uint8Array it can own.
    data: new Uint8Array(await readFile(path)),
    disableFontFace: true,
    enableXfa: false,
    verbosity: 0,
  });
}

/** The text of every page, in page order. Scanned pages come back empty. */
async function extract(path: string): Promise<string[]> {
  const loading = await documentFor(path);
  try {
    const document = await loading.promise;
    const pages: string[] = [];
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) =>
            "str" in item ? `${item.str}${item.hasEOL ? "\n" : ""}` : "",
          )
          .join("")
          .replace(/[ \t]+\n/g, "\n")
          .trim(),
      );
      page.cleanup();
    }
    return pages;
  } finally {
    await loading.destroy();
  }
}

/**
 * Where each run of text sits on one page, so a highlight asked for by its
 * words can be drawn in the right place.
 */
async function extractPage(path: string, number: number): Promise<PageText> {
  const loading = await documentFor(path);
  try {
    const document = await loading.promise;
    if (number < 1 || number > document.numPages)
      throw new Error(`The PDF has ${document.numPages} pages.`);
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const view = page.view as number[];
    const boxes: TextBox[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const transform = item.transform as number[];
      const size = Math.hypot(transform[1] ?? 0, transform[3] ?? 0);
      boxes.push({
        text: item.str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        width: item.width || 0,
        height: size || item.height || 0,
      });
    }
    page.cleanup();
    return {
      pageCount: document.numPages,
      view: [view[0] ?? 0, view[1] ?? 0, view[2] ?? 0, view[3] ?? 0],
      boxes,
    };
  } finally {
    await loading.destroy();
  }
}

const port = parentPort;
port?.on("message", (request: ExtractRequest) => {
  const work: Promise<ExtractResponse> =
    request.page === undefined
      ? extract(request.path).then((pages) => ({ id: request.id, pages }))
      : extractPage(request.path, request.page).then((page) => ({
          id: request.id,
          page,
        }));
  void work.then(
    (response) => port.postMessage(response),
    (error: unknown) =>
      port.postMessage({
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      }),
  );
});
