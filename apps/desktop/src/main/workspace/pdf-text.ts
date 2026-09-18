import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { readResourceBytes, type OpenWorkspace } from "./workspace";

interface CachedPdf {
  revision: string;
  pages: Promise<string[]>;
}

/** Extracted text by resource ID; rebuilt when the file's revision changes. */
const cache = new Map<string, CachedPdf>();
const MAX_CACHED = 50;

async function extract(bytes: Uint8Array): Promise<string[]> {
  const loading = getDocument({
    // PDF.js rejects Node Buffers; it wants a plain Uint8Array it can own.
    data: new Uint8Array(bytes),
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

/** Text of every page, one string per page, in page order. */
export function pdfPages(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<string[]> {
  const entry = workspace.resources.get(resourceId);
  if (!entry || entry.info.kind !== "pdf")
    return Promise.reject(new Error("That resource is not a PDF."));
  const cached = cache.get(resourceId);
  if (cached && cached.revision === entry.info.revision) return cached.pages;
  const pages = readResourceBytes(workspace, resourceId).then(extract);
  cache.set(resourceId, { revision: entry.info.revision, pages });
  pages.catch(() => cache.delete(resourceId));
  if (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return pages;
}
