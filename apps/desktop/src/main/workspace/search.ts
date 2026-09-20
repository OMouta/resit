import type { ResourceInfo } from "../../shared/workspace";
import { pdfPages } from "./pdf-text";
import { readNote, type OpenWorkspace } from "./workspace";

export interface SearchHit {
  resourceId: string;
  title: string;
  kind: ResourceInfo["kind"];
  subjectId: string;
  /** One-based page for PDF hits. */
  page?: number;
  snippet: string;
}

/** Lowercased text without accents, with a map back to original offsets. */
function fold(text: string): { folded: string; offsets: number[] } {
  let folded = "";
  const offsets: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const plain = text[index]!.normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    for (const char of plain) {
      folded += char;
      offsets.push(index);
    }
  }
  return { folded, offsets };
}

export function foldText(text: string): string {
  return fold(text).folded;
}

/** Finds every term in `text`; returns a snippet around the first one. */
function match(text: string, terms: string[]): string | null {
  const { folded, offsets } = fold(text);
  let first = -1;
  for (const term of terms) {
    const at = folded.indexOf(term);
    if (at === -1) return null;
    if (first === -1 || at < first) first = at;
  }
  const start = offsets[Math.max(0, first - 80)] ?? 0;
  const end = offsets[Math.min(folded.length - 1, first + 160)] ?? text.length;
  return `${start > 0 ? "…" : ""}${text
    .slice(start, end + 1)
    .replace(/\s+/g, " ")
    .trim()}${end < text.length - 1 ? "…" : ""}`;
}

const noteCache = new Map<string, { revision: string; text: string }>();

/** A note's text, kept until the note's revision changes. */
export async function noteText(
  workspace: OpenWorkspace,
  resource: ResourceInfo,
): Promise<string> {
  const cached = noteCache.get(resource.id);
  if (cached && cached.revision === resource.revision) return cached.text;
  const note = await readNote(workspace, resource.id);
  noteCache.set(resource.id, { revision: note.revision, text: note.body });
  return note.body;
}

/**
 * Accent- and case-insensitive search over note text, PDF pages, and
 * titles. `allow` filters resources before any text is read, so excluded
 * files never produce snippets.
 */
export async function searchWorkspace(
  workspace: OpenWorkspace,
  query: string,
  options: { allow: (resource: ResourceInfo) => boolean; limit: number },
): Promise<SearchHit[]> {
  const terms = foldText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const titleHits: SearchHit[] = [];
  const textHits: SearchHit[] = [];
  const resources = [...workspace.resources.values()]
    .map((entry) => entry.info)
    .filter(options.allow);

  for (const resource of resources) {
    const base = {
      resourceId: resource.id,
      title: resource.title,
      kind: resource.kind,
      subjectId: resource.subjectId,
    };
    const titleMatch = match(resource.title, terms);
    try {
      if (resource.kind === "note") {
        const snippet = match(await noteText(workspace, resource), terms);
        if (snippet)
          (titleMatch ? titleHits : textHits).push({ ...base, snippet });
        else if (titleMatch) titleHits.push({ ...base, snippet: titleMatch });
      } else if (resource.kind === "pdf") {
        const pages = await pdfPages(workspace, resource.id);
        let found = false;
        pages.forEach((text, index) => {
          const snippet = match(text, terms);
          if (!snippet) return;
          found = true;
          textHits.push({ ...base, page: index + 1, snippet });
        });
        if (!found && titleMatch)
          titleHits.push({ ...base, snippet: titleMatch });
      } else if (titleMatch) {
        titleHits.push({ ...base, snippet: titleMatch });
      }
    } catch {
      // Unreadable files are skipped; the file view reports the problem.
    }
    if (titleHits.length + textHits.length >= options.limit * 3) break;
  }
  return [...titleHits, ...textHits].slice(0, options.limit);
}
