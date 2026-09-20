import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { z } from "zod";

import type { TrashEntry, TrashKind } from "../../shared/workspace";

import {
  exists,
  isDirectory,
  isInside,
  readJson,
  slugify,
  splitExtension,
  uniquePath,
} from "./files";
import { scanWorkspace, WorkspaceError, type OpenWorkspace } from "./workspace";

const trashRecordSchema = z.looseObject({
  kind: z.string().min(1),
  title: z.string().optional(),
  deletedAt: z.string(),
  files: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })),
});

const KINDS: TrashKind[] = [
  "note",
  "pdf",
  "image",
  "attachment",
  "subject",
  "folder",
  "conversation",
];

function trashDir(workspace: OpenWorkspace): string {
  return join(workspace.root, ".resit", "trash");
}

/** The subject a deleted path belonged to, by its folder name. */
function subjectFor(workspace: OpenWorkspace, path: string): string | null {
  const segments = path.split("/");
  if (segments[0] !== "subjects" || !segments[1]) return null;
  for (const entry of workspace.subjects.values())
    if (basename(entry.dir) === segments[1]) return entry.info.name;
  return null;
}

async function conversationTitle(path: string): Promise<string | undefined> {
  try {
    const meta = (await readJson(join(path, "conversation.json"))) as {
      title?: unknown;
    };
    return typeof meta.title === "string" && meta.title
      ? meta.title
      : undefined;
  } catch {
    return undefined;
  }
}

/** Everything the app moved to `.resit/trash`, newest first. */
export async function listTrash(
  workspace: OpenWorkspace,
): Promise<TrashEntry[]> {
  const directory = trashDir(workspace);
  if (!(await isDirectory(directory))) return [];
  const entries: TrashEntry[] = [];
  for (const folder of await readdir(directory, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const path = join(directory, folder.name);
    const parsed = trashRecordSchema.safeParse(
      await readJson(join(path, "trash.json")).catch(() => null),
    );
    if (!parsed.success) continue;
    const record = parsed.data;
    const first = record.files[0];
    if (!first) continue;
    const kind = (KINDS as string[]).includes(record.kind)
      ? (record.kind as TrashKind)
      : "attachment";
    entries.push({
      id: folder.name,
      kind,
      title:
        record.title ??
        (kind === "conversation"
          ? ((await conversationTitle(join(path, first.to))) ?? "Conversation")
          : splitExtension(basename(first.from)).name),
      subjectName: subjectFor(workspace, first.from),
      deletedAt: record.deletedAt,
      originalPath: first.from,
    });
  }
  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/**
 * Moves a deletion back where it came from. A name taken since the delete
 * gets a numbered suffix rather than overwriting the file that holds it.
 */
export async function restoreFromTrash(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  const directory = trashDir(workspace);
  const path = join(directory, id);
  if (!isInside(directory, path) || !(await isDirectory(path)))
    throw new WorkspaceError("That deleted item is no longer in the trash.");
  const parsed = trashRecordSchema.safeParse(
    await readJson(join(path, "trash.json")).catch(() => null),
  );
  if (!parsed.success)
    throw new WorkspaceError(
      "This deletion has no record of where it came from.",
    );

  for (const file of parsed.data.files) {
    const source = join(path, file.to);
    if (!isInside(path, source) || !(await exists(source))) continue;
    const target = resolve(workspace.root, file.from);
    const reserved = join(workspace.root, ".resit");
    if (!isInside(workspace.root, target) || isInside(reserved, target))
      throw new WorkspaceError(
        `${file.from} is not a place inside this workspace.`,
      );
    await mkdir(dirname(target), { recursive: true });
    if (!(await exists(target))) {
      await rename(source, target);
      continue;
    }
    const { name, extension } = splitExtension(basename(target));
    await rename(
      source,
      await uniquePath(dirname(target), slugify(name), extension),
    );
  }

  const left = (await readdir(path)).filter((name) => name !== "trash.json");
  if (left.length === 0) await rm(path, { recursive: true, force: true });
  await scanWorkspace(workspace);
}
