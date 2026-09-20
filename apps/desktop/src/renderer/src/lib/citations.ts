import type { ResourceInfo } from "../../../shared/workspace";
import { viewFor, type DocumentTarget } from "../views/view-registry";
import type { Layout } from "../workspace/layout";

export interface CitationSource {
  resourceId: string;
  title: string;
  /** One-based page number. */
  page: number;
  annotationId: string;
  quote: string;
}

/** A link into this workspace: a resource, and where to look inside it. */
export function resitLink(
  resourceId: string,
  target: DocumentTarget = {},
): string {
  const query = new URLSearchParams();
  if (target.page !== undefined) query.set("page", String(target.page));
  if (target.annotationId) query.set("annotation", target.annotationId);
  const search = query.toString();
  return `resit://resource/${encodeURIComponent(resourceId)}${search ? `?${search}` : ""}`;
}

/** Reads a `resit://` link, or returns null for anything else. */
export function parseResitLink(
  href: string,
): { resourceId: string; target: DocumentTarget } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "resit:" || url.host !== "resource") return null;
  const resourceId = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!resourceId) return null;
  const page = Number(url.searchParams.get("page"));
  const annotationId = url.searchParams.get("annotation");
  return {
    resourceId,
    target: {
      ...(Number.isInteger(page) && page > 0 ? { page } : {}),
      ...(annotationId ? { annotationId } : {}),
    },
  };
}

/**
 * A quote of the highlighted text with a link back to its page. The excerpt
 * stays readable if the PDF later changes; the link goes to the source.
 */
export function citationMarkdown(source: CitationSource): string {
  const quote = source.quote
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");
  const label = `${source.title.replace(/([[\]])/g, "\\$1")}, p. ${source.page}`;
  const link = resitLink(source.resourceId, {
    page: source.page,
    annotationId: source.annotationId,
  });
  return `${quote}\n>\n> — [${label}](${link})`;
}

/**
 * Appends Markdown to the note the student is most likely writing in: the
 * focused pane's note, else a note open in the other pane.
 */
export function insertIntoNote(
  layout: Layout,
  resources: ReadonlyMap<string, ResourceInfo>,
  markdown: string,
): ResourceInfo | null {
  const panes = [...layout.panes].sort(
    (a, b) =>
      Number(b.id === layout.focusedPaneId) -
      Number(a.id === layout.focusedPaneId),
  );
  for (const pane of panes) {
    const tab = pane.tabs.find((entry) => entry.id === pane.activeTabId);
    const resource = tab ? resources.get(tab.resourceId) : undefined;
    if (resource?.kind !== "note") continue;
    if (viewFor(resource.id)?.insertMarkdown?.(markdown)) return resource;
  }
  return null;
}
