import { randomUUID } from "node:crypto";

import type { DesktopEvent, RenderedPage } from "../../shared/ipc";

/** A page render the window has not answered yet is given up on. */
const TIMEOUT_MS = 30_000;
const MAX_CACHED = 6;

interface Waiting {
  resolve: (page: RenderedPage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const waiting = new Map<string, Waiting>();
const cache = new Map<string, RenderedPage>();

/** The window answering a render request, or reporting that it failed. */
export function deliverRenderedPage(result: {
  requestId: string;
  page?: RenderedPage | undefined;
  error?: string | undefined;
}): void {
  const request = waiting.get(result.requestId);
  if (!request) return;
  waiting.delete(result.requestId);
  clearTimeout(request.timer);
  if (result.page) request.resolve(result.page);
  else request.reject(new Error(result.error ?? "The page did not render."));
}

/**
 * Asks the window to draw one PDF page and send the image back. PDF.js runs
 * there already, so the main process does not need a second renderer.
 */
export function renderPdfPage(
  emit: (event: DesktopEvent) => void,
  input: {
    resourceId: string;
    revision: string;
    page: number;
    maxWidth: number;
  },
): Promise<RenderedPage> {
  const key = `${input.resourceId}:${input.revision}:${input.page}:${input.maxWidth}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const requestId = randomUUID();
  return new Promise<RenderedPage>((resolve, reject) => {
    waiting.set(requestId, {
      resolve,
      reject,
      timer: setTimeout(() => {
        waiting.delete(requestId);
        reject(new Error("The window did not draw the page in time."));
      }, TIMEOUT_MS),
    });
    emit({
      type: "render-page",
      requestId,
      resourceId: input.resourceId,
      page: input.page,
      maxWidth: input.maxWidth,
    });
  }).then((page) => {
    cache.set(key, page);
    if (cache.size > MAX_CACHED) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return page;
  });
}

/** Fails every waiting render, for closing a workspace or quitting. */
export function abandonRenders(): void {
  for (const request of waiting.values()) {
    clearTimeout(request.timer);
    request.reject(new Error("The workspace closed before the page rendered."));
  }
  waiting.clear();
  cache.clear();
}
