import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { sha256, writeJson } from "./files";
import { pdfPages } from "./pdf-text";
import { WorkspaceError, type OpenWorkspace } from "./workspace";
import { t } from "../i18n";

/**
 * Text recognized on a PDF's scanned pages, in `.resit/cache/ocr`. It is
 * derived from the PDF, so it belongs to one revision and can be rebuilt.
 */
const ocrFileSchema = z.object({
  format: z.literal("resit-ocr"),
  formatVersion: z.literal(1),
  documentId: z.string(),
  revision: z.string(),
  languages: z.array(z.string()),
  /** Text by one-based page. A page read and found blank is an empty string. */
  pages: z.record(z.string(), z.string()),
});
type OcrFile = z.infer<typeof ocrFileSchema>;

/** Fewer characters than this and a page counts as having no text. */
const MIN_CHARACTERS = 10;

export function hasText(text: string): boolean {
  return text.replace(/\s/g, "").length >= MIN_CHARACTERS;
}

function ocrPath(workspace: OpenWorkspace, documentId: string): string {
  const name = /^[\w-]+$/.test(documentId)
    ? documentId
    : sha256(documentId).slice("sha256:".length, "sha256:".length + 32);
  return join(workspace.root, ".resit", "cache", "ocr", `${name}.json`);
}

/** Recognized text for the PDF's current revision, if there is any. */
async function readOcr(
  workspace: OpenWorkspace,
  documentId: string,
): Promise<OcrFile | null> {
  const revision = workspace.resources.get(documentId)?.info.revision;
  if (!revision) return null;
  try {
    const file = ocrFileSchema.parse(
      JSON.parse(await readFile(ocrPath(workspace, documentId), "utf8")),
    );
    return file.documentId === documentId && file.revision === revision
      ? file
      : null;
  } catch {
    return null;
  }
}

/**
 * The text of every page: what the PDF holds, and for a scanned page the
 * text recognized on it.
 */
export async function readablePages(
  workspace: OpenWorkspace,
  documentId: string,
): Promise<string[]> {
  const pages = await pdfPages(workspace, documentId);
  const ocr = await readOcr(workspace, documentId);
  if (!ocr) return pages;
  return pages.map((text, index) =>
    hasText(text) ? text : (ocr.pages[String(index + 1)] ?? text),
  );
}

/** One-based pages whose text came from recognition. */
export async function recognizedPages(
  workspace: OpenWorkspace,
  documentId: string,
): Promise<Set<number>> {
  const ocr = await readOcr(workspace, documentId);
  return new Set(Object.keys(ocr?.pages ?? {}).map(Number));
}

export interface RecognitionState {
  pageCount: number;
  /** One-based pages with no text that have not been read yet. */
  waiting: number[];
  /** Pages whose text came from recognition. */
  recognized: number;
}

export async function recognitionState(
  workspace: OpenWorkspace,
  documentId: string,
): Promise<RecognitionState> {
  const pages = await pdfPages(workspace, documentId);
  const ocr = await readOcr(workspace, documentId);
  const done = new Set(Object.keys(ocr?.pages ?? {}));
  return {
    pageCount: pages.length,
    waiting: pages.flatMap((text, index) =>
      hasText(text) || done.has(String(index + 1)) ? [] : [index + 1],
    ),
    recognized: done.size,
  };
}

/** Reads the text in a picture of a page. */
export interface Recognizer {
  recognize(image: Uint8Array): Promise<string>;
}

/**
 * Reads the text on every scanned page not read yet, saving each page as it
 * finishes, so stopping keeps the pages already done. Returns how many pages
 * were read.
 */
export async function recognizePdf(
  workspace: OpenWorkspace,
  input: {
    documentId: string;
    languages: string[];
    recognizer: Recognizer;
    /** A picture of one page, drawn by the window. */
    render: (page: number) => Promise<Uint8Array>;
    onProgress: (done: number, total: number) => void;
    signal: AbortSignal;
  },
): Promise<number> {
  const { documentId } = input;
  const revision = workspace.resources.get(documentId)?.info.revision;
  if (!revision) throw new WorkspaceError(t("That file no longer exists."));
  const { waiting } = await recognitionState(workspace, documentId);
  let done = 0;
  input.onProgress(done, waiting.length);
  for (const page of waiting) {
    if (input.signal.aborted) break;
    const image = await input.render(page);
    if (input.signal.aborted) break;
    const text = await input.recognizer.recognize(image);
    if (input.signal.aborted) break;
    if (workspace.resources.get(documentId)?.info.revision !== revision)
      throw new WorkspaceError(
        t("The PDF changed while its text was being read. Try again."),
      );
    const file: OcrFile = (await readOcr(workspace, documentId)) ?? {
      format: "resit-ocr",
      formatVersion: 1,
      documentId,
      revision,
      languages: input.languages,
      pages: {},
    };
    file.pages[String(page)] = text.trim();
    await writeJson(ocrPath(workspace, documentId), file);
    done += 1;
    input.onProgress(done, waiting.length);
  }
  return done;
}
