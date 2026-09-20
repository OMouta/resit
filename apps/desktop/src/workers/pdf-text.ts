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
}

export type ExtractResponse =
  { id: number; pages: string[] } | { id: number; error: string };

/** The text of every page, in page order. Scanned pages come back empty. */
async function extract(path: string): Promise<string[]> {
  const loading = getDocument({
    // PDF.js rejects Node Buffers; it wants a plain Uint8Array it can own.
    data: new Uint8Array(await readFile(path)),
    disableFontFace: true,
    enableXfa: false,
    verbosity: 0,
  });
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

const port = parentPort;
port?.on("message", (request: ExtractRequest) => {
  void extract(request.path).then(
    (pages) => port.postMessage({ id: request.id, pages }),
    (error: unknown) =>
      port.postMessage({
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      }),
  );
});
