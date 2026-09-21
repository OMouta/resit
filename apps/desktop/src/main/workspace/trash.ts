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
import { t } from "../i18n";

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
  "quiz",
  "project",
];

function trashDir(workspace: OpenWorkspace): string {
  return join(workspace.root, ".resit", "trash");
}

/** How many notes and imported files a deleted subject holds. */
async function resourceCount(path: string): Promise<number> {
  let count = 0;
  for (const entry of await readdir(path, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (entry.isDirectory())
      count += await resourceCount(join(path, entry.name));
    else if (
      entry.name.endsWith(".md") ||
      entry.name.endsWith(".resource.json")
    )
      count += 1;
  }
  return count;
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
      ...(kind === "subject"
        ? { ownedCount: await resourceCount(join(path, first.to)) }
        : {}),
    });
  }
  return entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** A deletion's folder inside the trash, or an error if there is none. */
async function trashEntryDir(
  workspace: OpenWorkspace,
  id: string,
): Promise<string> {
  const directory = trashDir(workspace);
  const path = join(directory, id);
  if (
    !/^[\w.-]+$/.test(id) ||
    path === directory ||
    !isInside(directory, path) ||
    !(await isDirectory(path))
  )
    throw new WorkspaceError(t("That deleted item is no longer in the trash."));
  return path;
}

/** Removes one deletion from disk for good. History copies stay. */
export async function deleteFromTrash(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  await rm(await trashEntryDir(workspace, id), {
    recursive: true,
    force: true,
  });
}

/** Removes everything in the trash from disk. */
export async function emptyTrash(workspace: OpenWorkspace): Promise<void> {
  const directory = trashDir(workspace);
  for (const name of await readdir(directory).catch(() => []))
    await rm(join(directory, name), { recursive: true, force: true });
}

/**
 * Moves a deletion back where it came from. A name taken since the delete
 * gets a numbered suffix rather than overwriting the file that holds it.
 */
export async function restoreFromTrash(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  const path = await trashEntryDir(workspace, id);
  const parsed = trashRecordSchema.safeParse(
    await readJson(join(path, "trash.json")).catch(() => null),
  );
  if (!parsed.success)
    throw new WorkspaceError(
      t("This deletion has no record of where it came from."),
    );

  for (const file of parsed.data.files) {
    const source = join(path, file.to);
    if (!isInside(path, source) || !(await exists(source))) continue;
    const target = resolve(workspace.root, file.from);
    const reserved = join(workspace.root, ".resit");
    if (!isInside(workspace.root, target) || isInside(reserved, target))
      throw new WorkspaceError(
        t("{path} is not a place inside this workspace.", { path: file.from }),
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
