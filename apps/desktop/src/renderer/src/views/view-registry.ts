/** What an open view can tell the AI panel about where the student is. */
export interface ViewContext {
  /** Selected text in the view, if any. */
  selection?: string;
  /** One-based page number for PDFs. */
  page?: number;
  pageCount?: number;
}

export interface ViewHandle {
  context(): ViewContext;
  /** Appends Markdown to a note. Returns false if the view cannot take it. */
  insertMarkdown?(markdown: string): boolean;
  /** Writes pending edits to disk. */
  flush?(): Promise<void>;
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
