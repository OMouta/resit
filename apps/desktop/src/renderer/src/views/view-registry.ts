import type { CardRequest } from "../practice/card-dialog";

/** What an open view can tell the AI panel about where the student is. */
export interface ViewContext {
  /** Selected text in the view, if any. */
  selection?: string;
  /** One-based page number for PDFs. */
  page?: number;
  pageCount?: number;
}

/** A place inside a document: a page, one of its highlights, or both. */
export interface DocumentTarget {
  /** One-based page number. */
  page?: number;
  annotationId?: string;
}

export interface ViewHandle {
  context(): ViewContext;
  /** Appends Markdown to a note. Returns false if the view cannot take it. */
  insertMarkdown?(markdown: string): boolean;
  /** Writes pending edits to disk. */
  flush?(): Promise<void>;
  /** Scrolls a PDF to a page or highlight and selects it. */
  show?(target: DocumentTarget): void;
}

const handles = new Map<string, ViewHandle>();

/** Views register by resource ID; a resource is open in at most one tab. */
export function registerView(
  resourceId: string,
  handle: ViewHandle,
): () => void {
  handles.set(resourceId, handle);
  return () => {
    if (handles.get(resourceId) === handle) handles.delete(resourceId);
  };
}

export function viewFor(resourceId: string): ViewHandle | undefined {
  return handles.get(resourceId);
}

export async function flushAllViews(): Promise<void> {
  await Promise.allSettled(
    [...handles.values()].map((handle) => handle.flush?.()),
  );
}

const pendingTargets = new Map<string, DocumentTarget>();

/** Goes there now, or once the view for that resource has mounted. */
export function showTarget(resourceId: string, target: DocumentTarget): void {
  const handle = handles.get(resourceId);
  if (handle?.show) handle.show(target);
  else pendingTargets.set(resourceId, target);
}

export function takePendingTarget(
  resourceId: string,
): DocumentTarget | undefined {
  const target = pendingTargets.get(resourceId);
  pendingTargets.delete(resourceId);
  return target;
}

/** A highlight the student wants to ask the AI panel about. */
export interface AskRequest {
  resourceId: string;
  annotation: {
    id: string;
    /** One-based page number. */
    page: number;
    text: string;
    comment?: string;
  };
}

const askListeners = new Set<(request: AskRequest) => void>();

/** Attaches a highlight to the next message and opens the AI panel. */
export function requestAsk(request: AskRequest): void {
  for (const listener of askListeners) listener(request);
}

export function onAskRequest(
  listener: (request: AskRequest) => void,
): () => void {
  askListeners.add(listener);
  return () => {
    askListeners.delete(listener);
  };
}

const cardListeners = new Set<(request: CardRequest) => void>();

/** Opens the card dialog, filled in from what the student was reading. */
export function requestCard(request: CardRequest): void {
  for (const listener of cardListeners) listener(request);
}

export function onCardRequest(
  listener: (request: CardRequest) => void,
): () => void {
  cardListeners.add(listener);
  return () => {
    cardListeners.delete(listener);
  };
}

let pendingReview: { subjectId?: string } | null = null;
const reviewListeners = new Set<(request: { subjectId?: string }) => void>();

/** Starts a flashcard review in the Practice tab, once it is showing. */
export function requestReview(request: { subjectId?: string }): void {
  if (reviewListeners.size === 0) pendingReview = request;
  for (const listener of reviewListeners) listener(request);
}

export function onReviewRequest(
  listener: (request: { subjectId?: string }) => void,
): () => void {
  reviewListeners.add(listener);
  if (pendingReview) {
    listener(pendingReview);
    pendingReview = null;
  }
  return () => {
    reviewListeners.delete(listener);
  };
}
