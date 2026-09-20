import { Worker } from "node:worker_threads";

import workerPath from "../../workers/pdf-text?modulePath";
import type { ExtractResponse } from "../../workers/pdf-text";
import { assertInsideWorkspace } from "./files";
import { type OpenWorkspace } from "./workspace";

interface CachedPdf {
  revision: string;
  pages: Promise<string[]>;
}

/** Extracted text by resource ID; rebuilt when the file's revision changes. */
const cache = new Map<string, CachedPdf>();
const MAX_CACHED = 50;

interface Pending {
  resolve: (pages: string[]) => void;
  reject: (error: Error) => void;
}

/**
 * Reading a long PDF takes seconds, so it happens in a worker thread and
 * never blocks the window. One worker serves every document.
 */
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function failAll(error: Error): void {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
  worker = null;
}

function extractionWorker(): Worker {
  if (worker) return worker;
  const started = new Worker(workerPath);
  started.on("message", (response: ExtractResponse) => {
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if ("pages" in response) request.resolve(response.pages);
    else request.reject(new Error(response.error));
  });
  started.on("error", failAll);
  started.on("exit", () => failAll(new Error("Reading the PDF stopped.")));
  // Never hold the application open waiting for this thread.
  started.unref();
  worker = started;
  return started;
}

function extract(path: string): Promise<string[]> {
  const id = (nextId += 1);
  return new Promise<string[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    extractionWorker().postMessage({ id, path });
  });
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
  const pages = assertInsideWorkspace(workspace.root, entry.absPath).then(() =>
    extract(entry.absPath),
  );
  cache.set(resourceId, { revision: entry.info.revision, pages });
  pages.catch(() => cache.delete(resourceId));
  if (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return pages;
}
