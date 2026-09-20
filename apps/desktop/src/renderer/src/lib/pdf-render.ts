import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { RenderedPage } from "../../../shared/ipc";
import { api, errorMessage } from "./api";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Drawing much above the page's own size only makes the image heavier. */
const MAX_SCALE = 3;
/** A document kept open for a second page is dropped once nothing follows. */
const IDLE_MS = 60_000;

interface OpenDocument {
  resourceId: string;
  task: PDFDocumentLoadingTask;
  document: PDFDocumentProxy;
}

let open: OpenDocument | null = null;
let idle: number | undefined;

async function close(): Promise<void> {
  const current = open;
  open = null;
  window.clearTimeout(idle);
  if (current) await current.task.destroy().catch(() => undefined);
}

async function documentFor(resourceId: string): Promise<PDFDocumentProxy> {
  if (open?.resourceId === resourceId) return open.document;
  await close();
  const data = await api.readResourceBytes(resourceId);
  const task = getDocument({ data, enableXfa: false });
  const document = await task.promise;
  open = { resourceId, task, document };
  return document;
}

async function draw(request: {
  resourceId: string;
  page: number;
  maxWidth: number;
}): Promise<RenderedPage> {
  const document = await documentFor(request.resourceId);
  if (request.page < 1 || request.page > document.numPages)
    throw new Error(`The PDF has ${document.numPages} pages.`);
  const page = await document.getPage(request.page);
  const unscaled = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: Math.min(
      MAX_SCALE,
      Math.max(0.2, request.maxWidth / unscaled.width),
    ),
  });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This window cannot draw PDF pages.");
  // Pages are transparent where nothing is printed, which reads as black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  try {
    await page.render({ canvasContext: context, viewport, canvas }).promise;
  } finally {
    page.cleanup();
  }
  const url = canvas.toDataURL("image/png");
  const drawn = { width: canvas.width, height: canvas.height };
  // Release the backing store now rather than waiting for the collector.
  canvas.width = 0;
  canvas.height = 0;
  return {
    data: url.slice(url.indexOf(",") + 1),
    mimeType: "image/png",
    ...drawn,
  };
}

/**
 * Draws the PDF pages the assistant asks to look at. PDF.js runs in the
 * window, so the main process asks for a page and gets the image back.
 */
export function startPageRenderer(): () => void {
  let queue: Promise<unknown> = Promise.resolve();
  const stop = api.onEvent((event) => {
    if (event.type !== "render-page") return;
    const request = event;
    queue = queue.then(() =>
      draw(request).then(
        (page) =>
          api.deliverRenderedPage({ requestId: request.requestId, page }),
        (error: unknown) =>
          api.deliverRenderedPage({
            requestId: request.requestId,
            error: errorMessage(error),
          }),
      ),
    );
    queue = queue.then(() => {
      window.clearTimeout(idle);
      idle = window.setTimeout(() => void close(), IDLE_MS);
    });
  });
  return () => {
    stop();
    void close();
  };
}
