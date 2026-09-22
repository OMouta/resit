import { readFile } from "node:fs/promises";

import {
  extensionOf,
  isOfficeFile,
  isTextFile,
  type OfficeContent,
  type ResourceInfo,
} from "../../shared/workspace";
import { assertInsideWorkspace } from "./files";
import { docxHtml, officePages, readOffice } from "./office";
import { resourcePath, type OpenWorkspace } from "./workspace";

/** Imported files whose words resit can read, for search and the assistant. */
export function hasReadableText(info: ResourceInfo): boolean {
  return (
    info.kind === "attachment" &&
    (isTextFile(info.path) || isOfficeFile(info.path))
  );
}

/** A Word, PowerPoint, or Excel file's words, or null for anything else. */
export async function officeContent(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<OfficeContent | null> {
  const info = workspace.resources.get(resourceId)?.info;
  if (!info || info.kind !== "attachment" || !isOfficeFile(info.path))
    return null;
  const path = resourcePath(workspace, resourceId);
  await assertInsideWorkspace(workspace.root, path);
  return readOffice(path, extensionOf(path));
}

/** Larger documents show as text: their images would make the page huge. */
const MAX_DOCX_BYTES = 30 * 1024 * 1024;

/** A Word document laid out as HTML, or null when it is too large to. */
export async function wordHtml(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<string | null> {
  const info = workspace.resources.get(resourceId)?.info;
  if (
    !info ||
    info.kind !== "attachment" ||
    extensionOf(info.path) !== ".docx" ||
    info.size > MAX_DOCX_BYTES
  )
    return null;
  const path = resourcePath(workspace, resourceId);
  await assertInsideWorkspace(workspace.root, path);
  return docxHtml(path);
}

/**
 * An imported file's words, a page per slide for a presentation, or null
 * for a kind resit cannot read. `paged` says the pages are worth numbering.
 */
export async function readablePagesOf(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<{ pages: string[]; paged: boolean } | null> {
  const info = workspace.resources.get(resourceId)?.info;
  if (!info || !hasReadableText(info)) return null;
  const office = await officeContent(workspace, resourceId);
  if (office)
    return { pages: officePages(office), paged: office.format === "pptx" };
  const path = resourcePath(workspace, resourceId);
  await assertInsideWorkspace(workspace.root, path);
  return { pages: [await readFile(path, "utf8")], paged: false };
}

/** The same words as one text, with each slide or sheet marked. */
export async function readableText(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<string | null> {
  const read = await readablePagesOf(workspace, resourceId);
  if (!read) return null;
  if (read.pages.length === 1) return read.pages[0] ?? "";
  const office = extensionOf(
    workspace.resources.get(resourceId)?.info.path ?? "",
  );
  const label = office === ".pptx" ? "Slide" : "Sheet";
  return read.pages
    .map((page, index) => `--- ${label} ${index + 1} ---\n${page}`)
    .join("\n\n");
}
