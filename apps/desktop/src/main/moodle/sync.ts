import {
  itemKey,
  type MoodleCourseContents,
  type MoodleDownloadResult,
  type MoodleFileRef,
  type MoodleItem,
  type MoodleLink,
  type MoodleSkipped,
} from "../../shared/moodle";
import { slugify, splitExtension } from "../workspace/files";
import {
  importDownload,
  replaceDownload,
  subjectSidecars,
  WorkspaceError,
  type OpenWorkspace,
} from "../workspace/workspace";
import {
  courseContents,
  downloadFile,
  type MoodleSection,
  type MoodleSession,
} from "./client";

/** Held in memory while it is written, so a course video cannot fill it. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
const CONCURRENCY = 3;

/** Moodle activities whose files resit stores. Others are listed as skipped. */
const FILE_MODULES = new Set(["resource", "folder"]);

/** Section 0 holds the course's loose material and gets no folder. */
function sectionFolder(section: MoodleSection): string {
  const name = section.name.trim();
  if (section.section === 0 && (!name || /^general$/i.test(name))) return "";
  // Dashes Moodle section titles like to use would otherwise survive slugging.
  return slugify((name || `topic-${section.section}`).replace(/[–—]/g, " "));
}

function count(
  skipped: Map<MoodleSkipped["reason"], MoodleSkipped>,
  reason: MoodleSkipped["reason"],
  detail: string,
): void {
  const existing = skipped.get(reason);
  if (existing) {
    existing.count += 1;
    if (!existing.detail.includes(detail))
      existing.detail = `${existing.detail}, ${detail}`;
    return;
  }
  skipped.set(reason, { reason, detail, count: 1 });
}

/** What a course offers, compared with what the subject already holds. */
export function planCourse(
  sections: MoodleSection[],
  link: MoodleLink,
  existing: Map<string, { resourceId: string; ref: MoodleFileRef }>,
): MoodleCourseContents {
  const items: MoodleItem[] = [];
  const skipped = new Map<MoodleSkipped["reason"], MoodleSkipped>();

  for (const section of sections) {
    const folder = sectionFolder(section);
    const sectionName = section.name.trim();
    for (const module of section.modules) {
      if (module.uservisible === false) continue;
      const files = (module.contents ?? []).filter(
        (content) => content.type === "file",
      );
      if (files.length === 0) continue;
      if (!FILE_MODULES.has(module.modname)) {
        count(skipped, "unsupported", module.modname);
        continue;
      }
      for (const file of files) {
        if (!file.fileurl || file.isexternalfile) {
          count(skipped, "external", "linked from another site");
          continue;
        }
        if (file.filesize > MAX_FILE_BYTES) {
          count(skipped, "too-large", file.filename);
          continue;
        }
        const key = itemKey(module.id, `${file.filepath}${file.filename}`);
        const known = existing.get(key);
        const state = !known
          ? "new"
          : known.ref.filesize === file.filesize &&
              known.ref.timemodified === file.timemodified
            ? "current"
            : "updated";
        items.push({
          key,
          moduleId: module.id,
          section: folder,
          sectionName,
          name:
            files.length === 1 && module.name
              ? module.name
              : splitExtension(file.filename).name,
          filename: file.filename,
          filesize: file.filesize,
          timemodified: file.timemodified,
          fileUrl: file.fileurl,
          state,
          ...(known ? { resourceId: known.resourceId } : {}),
        });
      }
    }
  }
  return { course: link, items, skipped: [...skipped.values()] };
}

function subjectLink(workspace: OpenWorkspace, subjectId: string): MoodleLink {
  const subject = workspace.subjects.get(subjectId);
  if (!subject) throw new WorkspaceError("That subject no longer exists.");
  if (!subject.info.moodle)
    throw new WorkspaceError("That subject does not follow a Moodle course.");
  return subject.info.moodle;
}

/** Files already downloaded into the subject, keyed the way the plan is. */
async function downloaded(
  workspace: OpenWorkspace,
  subjectId: string,
  link: MoodleLink,
): Promise<Map<string, { resourceId: string; ref: MoodleFileRef }>> {
  const map = new Map<string, { resourceId: string; ref: MoodleFileRef }>();
  for (const { resource, sidecar } of await subjectSidecars(
    workspace,
    subjectId,
  )) {
    const ref = sidecar.moodle;
    if (!ref || ref.courseId !== link.courseId || ref.siteUrl !== link.siteUrl)
      continue;
    map.set(ref.key, { resourceId: resource.id, ref });
  }
  return map;
}

export async function listItems(
  workspace: OpenWorkspace,
  session: MoodleSession,
  subjectId: string,
): Promise<MoodleCourseContents> {
  const link = subjectLink(workspace, subjectId);
  const sections = await courseContents(session, link.courseId);
  return planCourse(
    sections,
    link,
    await downloaded(workspace, subjectId, link),
  );
}

export interface MoodleProgress {
  key: string;
  filename: string;
  done: number;
  total: number;
}

/**
 * Downloads the chosen files. The renderer sends keys only; the course is read
 * again here so every path and address comes from Moodle, not from the caller.
 */
export async function downloadItems(
  workspace: OpenWorkspace,
  session: MoodleSession,
  input: {
    subjectId: string;
    keys: string[];
    onProgress?: (progress: MoodleProgress) => void;
  },
): Promise<MoodleDownloadResult> {
  const link = subjectLink(workspace, input.subjectId);
  const { items } = await listItems(workspace, session, input.subjectId);
  const wanted = new Set(input.keys);
  const queue = items.filter(
    (item) => wanted.has(item.key) && item.state !== "current",
  );

  const result: MoodleDownloadResult = { added: 0, replaced: 0, failures: [] };
  let next = 0;
  let done = 0;

  const worker = async () => {
    for (let index = next++; index < queue.length; index = next++) {
      const item = queue[index];
      if (!item) return;
      try {
        const bytes = await downloadFile(session, item.fileUrl, MAX_FILE_BYTES);
        const ref: MoodleFileRef = {
          siteUrl: link.siteUrl,
          courseId: link.courseId,
          moduleId: item.moduleId,
          key: item.key,
          filename: item.filename,
          filesize: item.filesize,
          timemodified: item.timemodified,
        };
        if (item.state === "updated" && item.resourceId) {
          await replaceDownload(workspace, {
            resourceId: item.resourceId,
            bytes,
            moodle: ref,
          });
          result.replaced += 1;
        } else {
          await importDownload(workspace, {
            subjectId: input.subjectId,
            ...(item.section ? { folder: item.section } : {}),
            filename: item.filename,
            title: item.name,
            bytes,
            moodle: ref,
          });
          result.added += 1;
        }
      } catch (error) {
        result.failures.push({
          key: item.key,
          filename: item.filename,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      done += 1;
      input.onProgress?.({
        key: item.key,
        filename: item.filename,
        done,
        total: queue.length,
      });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
  );
  return result;
}
