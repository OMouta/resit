import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, posix } from "node:path";

import type { MarkdownExport, ResourceInfo } from "../../shared/workspace";
import { exists, folderName } from "./files";
import {
  readNote,
  resourcePath,
  WorkspaceError,
  type OpenWorkspace,
} from "./workspace";

/** A link into the workspace, with the page or highlight after it. */
const LINK = /resit:\/\/resource\/([A-Za-z0-9._~%-]+)(\?[^)\s>"']*)?/g;

/** A free name in a folder, with a number added when it is taken. */
function claim(taken: Set<string>, directory: string, name: string): string {
  const { stem, extension } = {
    stem: name.slice(0, name.length - extname(name).length),
    extension: extname(name),
  };
  for (let index = 1; ; index += 1) {
    const candidate = `${directory}${stem}${index === 1 ? "" : ` ${index}`}${extension}`;
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase());
      return candidate;
    }
  }
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Writes notes as ordinary Markdown into a new folder inside `parent`. Their
 * resit fields are left out and the file name carries the title. PDFs and
 * images the notes link to are copied into `files/`, and links to them and
 * between the exported notes become relative paths.
 */
export async function exportMarkdown(
  workspace: OpenWorkspace,
  input: { notes: ResourceInfo[]; parent: string; name: string },
): Promise<MarkdownExport> {
  const notes = input.notes.filter((resource) => resource.kind === "note");
  if (notes.length === 0)
    throw new WorkspaceError("There are no notes to export.");
  const name = folderName(input.name) || "Notes";
  let folder = join(input.parent, name);
  for (let index = 2; await exists(folder); index += 1)
    folder = join(input.parent, `${name} ${index}`);

  const taken = new Set<string>();
  /** Where each exported note or file goes, inside the folder. */
  const placed = new Map<string, string>();
  for (const note of notes)
    placed.set(
      note.id,
      claim(
        taken,
        note.folder ? `${note.folder}/` : "",
        `${folderName(note.title) || "Untitled"}.md`,
      ),
    );

  const bodies = new Map<string, string>();
  const copies: { from: string; to: string }[] = [];
  for (const note of notes) {
    const body = (await readNote(workspace, note.id)).body;
    bodies.set(note.id, body);
    for (const match of body.matchAll(LINK)) {
      const id = decodeURIComponent(match[1]!);
      const target = workspace.resources.get(id)?.info;
      if (!target || target.kind === "note" || placed.has(id)) continue;
      const to = claim(
        taken,
        "files/",
        `${folderName(target.title) || "File"}${extname(target.path).toLowerCase()}`,
      );
      placed.set(id, to);
      copies.push({ from: resourcePath(workspace, id), to });
    }
  }

  let unresolved = 0;
  await mkdir(folder, { recursive: true });
  for (const note of notes) {
    const path = placed.get(note.id)!;
    const body = bodies
      .get(note.id)!
      .replace(LINK, (whole, encoded: string, query: string | undefined) => {
        const target = placed.get(decodeURIComponent(encoded));
        if (!target) {
          unresolved += 1;
          return whole;
        }
        const page = new URLSearchParams(query ?? "").get("page");
        const relative = posix.relative(posix.dirname(path), target);
        return `${encodePath(relative)}${page && target.endsWith(".pdf") ? `#page=${page}` : ""}`;
      });
    const output = join(folder, ...path.split("/"));
    await mkdir(join(output, ".."), { recursive: true });
    await writeFile(output, body, { flag: "wx" });
  }
  for (const copy of copies) {
    const output = join(folder, ...copy.to.split("/"));
    await mkdir(join(output, ".."), { recursive: true });
    await copyFile(copy.from, output);
  }
  return { folder, notes: notes.length, files: copies.length, unresolved };
}
