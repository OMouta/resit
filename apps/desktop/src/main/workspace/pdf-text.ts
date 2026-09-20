import { Worker } from "node:worker_threads";

import workerPath from "../../workers/pdf-text?modulePath";
import type { ExtractResponse, PageText } from "../../workers/pdf-text";
import { assertInsideWorkspace } from "./files";
import { type OpenWorkspace } from "./workspace";

interface Cached<T> {
  revision: string;
  value: Promise<T>;
}

/** Extracted text by resource ID; rebuilt when the file's revision changes. */
const cache = new Map<string, Cached<string[]>>();
/** Text positions by resource ID and page, for placing highlights. */
const pageCache = new Map<string, Cached<PageText>>();
const MAX_CACHED = 50;

interface Pending {
  resolve: (response: ExtractResponse) => void;
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
    if ("error" in response) request.reject(new Error(response.error));
    else request.resolve(response);
  });
  started.on("error", failAll);
  started.on("exit", () => failAll(new Error("Reading the PDF stopped.")));
  // Never hold the application open waiting for this thread.
  started.unref();
  worker = started;
  return started;
}

function ask(path: string, page?: number): Promise<ExtractResponse> {
  const id = (nextId += 1);
  return new Promise<ExtractResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    extractionWorker().postMessage({
      id,
      path,
      ...(page === undefined ? {} : { page }),
    });
  });
}

function pdfEntry(workspace: OpenWorkspace, resourceId: string) {
  const entry = workspace.resources.get(resourceId);
  if (!entry || entry.info.kind !== "pdf")
    throw new Error("That resource is not a PDF.");
  return entry;
}

/** Keeps the map from growing without bound as documents are read. */
function remember<T>(
  store: Map<string, Cached<T>>,
  key: string,
  entry: Cached<T>,
): Promise<T> {
  store.set(key, entry);
  entry.value.catch(() => store.delete(key));
  if (store.size > MAX_CACHED) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  return entry.value;
}

/** Text of every page, one string per page, in page order. */
export function pdfPages(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<string[]> {
  let entry;
  try {
    entry = pdfEntry(workspace, resourceId);
  } catch (error) {
    return Promise.reject(error as Error);
  }
  const cached = cache.get(resourceId);
  if (cached && cached.revision === entry.info.revision) return cached.value;
  const value = assertInsideWorkspace(workspace.root, entry.absPath)
    .then(() => ask(entry.absPath))
    .then((response) => ("pages" in response ? response.pages : []));
  return remember(cache, resourceId, {
    revision: entry.info.revision,
    value,
  });
}

/** Where the text sits on one page, for drawing a highlight over it. */
export function pdfPageText(
  workspace: OpenWorkspace,
  resourceId: string,
  page: number,
): Promise<PageText> {
  let entry;
  try {
    entry = pdfEntry(workspace, resourceId);
  } catch (error) {
    return Promise.reject(error as Error);
  }
  const key = `${resourceId}:${page}`;
  const cached = pageCache.get(key);
  if (cached && cached.revision === entry.info.revision) return cached.value;
  const value = assertInsideWorkspace(workspace.root, entry.absPath)
    .then(() => ask(entry.absPath, page))
    .then((response) => {
      if (!("page" in response))
        throw new Error("The page's text could not be read.");
      return response.page;
    });
  return remember(pageCache, key, { revision: entry.info.revision, value });
}

export type { PageText };
