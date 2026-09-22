import {
  activitiesFileSchema,
  courseUrl,
  itemKey,
  type ActivitiesFile,
  type MoodleActivity,
  type MoodleAnnouncement,
  type MoodleCourseContents,
  type MoodleCourseSection,
  type MoodleDownloadResult,
  type MoodleFileRef,
  type MoodleItem,
  type MoodleLink,
  type MoodleSkipped,
  type SubjectActivities,
} from "../../shared/moodle";
import {
  readJson,
  slugify,
  splitExtension,
  writeJson,
} from "../workspace/files";
import { replaceFileWithHistory } from "../workspace/history";
import {
  activitiesPath,
  importDownload,
  subjectSidecars,
  WorkspaceError,
  type OpenWorkspace,
} from "../workspace/workspace";
import { briefMarkdown } from "./brief";
import {
  courseAssignments,
  courseContents,
  courseForums,
  forumDiscussions,
  downloadFile,
  MoodleError,
  type MoodleAssignment,
  type MoodleSection,
  type MoodleSession,
} from "./client";
import { t } from "../i18n";

/** Held in memory while it is written, so a course video cannot fill it. */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
const CONCURRENCY = 3;

/**
 * Moodle activities whose files resit stores: an assignment's are the ones
 * attached to its brief. Others with files are listed as skipped.
 */
const FILE_MODULES = new Set(["resource", "folder", "assign"]);

/** Modules that are not activities a student opens. */
const NOT_ACTIVITIES = new Set(["resource", "folder", "subsection"]);

/** Modules whose HTML resit reads as text rather than downloading. */
const TEXT_MODULES = new Set(["page", "book"]);
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/** A page's or book's text as Markdown, and when Moodle last changed it. */
interface PageText {
  markdown: string;
  modified: number;
}

/** How many of the newest announcements resit keeps. */
const ANNOUNCEMENTS = 10;

/** A course as Moodle describes it, with its assignments keyed by module. */
interface CourseRead {
  sections: MoodleSection[];
  assignments: ReadonlyMap<number, MoodleAssignment>;
  pages: ReadonlyMap<number, PageText>;
  announcements: MoodleAnnouncement[] | undefined;
}

/** What resit saved the last time it read the subject's course, if anything. */
async function readSaved(
  workspace: OpenWorkspace,
  subjectId: string,
  link: MoodleLink,
): Promise<ActivitiesFile | null> {
  let file: ActivitiesFile;
  try {
    file = activitiesFileSchema.parse(
      await readJson(activitiesPath(workspace, subjectId)),
    );
  } catch {
    // Not read from Moodle yet, or damaged: the next check rewrites it.
    return null;
  }
  // Left over from a course the subject no longer follows.
  if (file.siteUrl !== link.siteUrl || file.courseId !== link.courseId)
    return null;
  return file;
}

/**
 * The text of the course's pages and books. Each is read again only when
 * Moodle says it changed, and one that cannot be read is left without text
 * rather than failing the whole course: the course page then links to it.
 */
async function readPages(
  session: MoodleSession,
  sections: MoodleSection[],
  saved: ActivitiesFile | null,
): Promise<Map<number, PageText>> {
  const before = new Map(
    (saved?.activities ?? []).map((activity) => [activity.moduleId, activity]),
  );
  const pages = new Map<number, PageText>();
  for (const module of sections.flatMap((section) => section.modules)) {
    if (module.uservisible === false || !TEXT_MODULES.has(module.modname))
      continue;
    const chapters = (module.contents ?? []).filter(
      (content) =>
        content.type === "file" &&
        content.filename === "index.html" &&
        content.fileurl,
    );
    if (chapters.length === 0) continue;
    const modified = Math.max(
      ...(module.contents ?? []).map((content) => content.timemodified),
    );
    const previous = before.get(module.id);
    if (previous?.brief && previous.contentModified === modified) {
      pages.set(module.id, { markdown: previous.brief, modified });
      continue;
    }
    try {
      const parts: string[] = [];
      for (const chapter of chapters) {
        const bytes = await downloadFile(
          session,
          chapter.fileurl ?? "",
          MAX_PAGE_BYTES,
        );
        const text = briefMarkdown(Buffer.from(bytes).toString("utf8"));
        // A book's chapters carry their titles; a page has one index.html.
        parts.push(
          module.modname === "book" && chapter.content
            ? `### ${chapter.content}\n\n${text}`
            : text,
        );
      }
      const markdown = parts.filter(Boolean).join("\n\n");
      if (markdown) pages.set(module.id, { markdown, modified });
    } catch (error) {
      if (!(error instanceof MoodleError)) throw error;
    }
  }
  return pages;
}

/**
 * The newest posts in the course's announcements forum. A site may not
 * offer the forum functions to the app's token; then the ones saved last
 * time stay.
 */
async function readAnnouncements(
  session: MoodleSession,
  link: MoodleLink,
  saved: ActivitiesFile | null,
): Promise<MoodleAnnouncement[] | undefined> {
  try {
    const news = (await courseForums(session, link.courseId)).find(
      (forum) => forum.type === "news",
    );
    if (!news) return [];
    const discussions = await forumDiscussions(session, news.id, ANNOUNCEMENTS);
    return discussions
      .map((post) => ({
        id: post.discussion,
        subject: post.subject,
        message: briefMarkdown(post.message),
        author: post.userfullname,
        postedAt: new Date(post.created * 1000).toISOString(),
        ...(post.pinned ? { pinned: true } : {}),
        url: `${link.siteUrl}/mod/forum/discuss.php?d=${post.discussion}`,
      }))
      .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  } catch (error) {
    if (!(error instanceof MoodleError)) throw error;
    return saved?.announcements;
  }
}

async function readCourse(
  workspace: OpenWorkspace,
  session: MoodleSession,
  subjectId: string,
  link: MoodleLink,
): Promise<CourseRead> {
  const sections = await courseContents(session, link.courseId);
  const hasAssignments = sections.some((section) =>
    section.modules.some((module) => module.modname === "assign"),
  );
  const assignments = hasAssignments
    ? await courseAssignments(session, link.courseId)
    : [];
  const saved = await readSaved(workspace, subjectId, link);
  return {
    sections,
    assignments: new Map(assignments.map((entry) => [entry.cmid, entry])),
    pages: await readPages(session, sections, saved),
    announcements: await readAnnouncements(session, link, saved),
  };
}

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
  assignments: ReadonlyMap<number, MoodleAssignment> = new Map(),
): MoodleCourseContents {
  const items: MoodleItem[] = [];
  const skipped = new Map<MoodleSkipped["reason"], MoodleSkipped>();

  for (const section of sections) {
    const folder = sectionFolder(section);
    const sectionName = section.name.trim();
    for (const module of section.modules) {
      // Pages and books are read as text onto the course page.
      if (module.uservisible === false || TEXT_MODULES.has(module.modname))
        continue;
      const files = (
        module.modname === "assign"
          ? (assignments.get(module.id)?.introattachments ?? [])
          : (module.contents ?? [])
      ).filter((content) => content.type === "file");
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

/**
 * Everything in a course that is more than a file, with its dates, and the
 * course page's sections. Labels, the text between activities, have no page
 * of their own, so they point at their section.
 */
function planActivities(
  { sections, assignments, pages }: CourseRead,
  link: MoodleLink,
): { activities: MoodleActivity[]; sections: MoodleCourseSection[] } {
  const activities: MoodleActivity[] = [];
  const page: MoodleCourseSection[] = [];
  for (const section of sections) {
    if (section.uservisible === false) continue;
    const summary = section.summary ? briefMarkdown(section.summary) : "";
    const moduleIds: number[] = [];
    page.push({
      name: section.name.trim(),
      ...(summary ? { summary } : {}),
      moduleIds,
    });
    for (const module of section.modules) {
      if (module.uservisible === false) continue;
      if (module.modname !== "subsection") moduleIds.push(module.id);
      if (module.modname === "label") {
        const text = module.description
          ? briefMarkdown(module.description)
          : "";
        if (text)
          activities.push({
            moduleId: module.id,
            name: module.name,
            modname: "label",
            sectionName: section.name.trim(),
            url: `${courseUrl(link)}#section-${section.section}`,
            dates: [],
            brief: text,
          });
        continue;
      }
      if (!module.url || NOT_ACTIVITIES.has(module.modname)) continue;
      const assignment = assignments.get(module.id);
      const text = pages.get(module.id);
      const brief =
        text?.markdown ??
        [assignment?.intro ?? module.description, assignment?.activity]
          .map((html) => (html ? briefMarkdown(html) : ""))
          .filter(Boolean)
          .join("\n\n");
      // The same files planCourse offers, so each one can be downloaded.
      const attachments = (assignment?.introattachments ?? [])
        .filter(
          (file) =>
            file.type === "file" &&
            file.fileurl &&
            !file.isexternalfile &&
            file.filesize <= MAX_FILE_BYTES,
        )
        .map((file) => ({
          key: itemKey(module.id, `${file.filepath}${file.filename}`),
          filename: file.filename,
        }));
      // A link activity's address is its one "url" content.
      const target = module.contents?.find(
        (content) => content.type === "url" && content.fileurl,
      )?.fileurl;
      activities.push({
        moduleId: module.id,
        name: module.name,
        modname: module.modname,
        sectionName: section.name.trim(),
        url: module.url,
        ...(module.modname === "url" && target ? { link: target } : {}),
        dates: (module.dates ?? [])
          .filter((date) => date.timestamp > 0)
          .map((date) => ({
            type: date.dataid ?? "",
            label: date.label.replace(/:\s*$/, "").trim(),
            at: new Date(date.timestamp * 1000).toISOString(),
          })),
        ...(brief ? { brief } : {}),
        ...(text ? { contentModified: text.modified } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
      });
    }
  }
  return { activities, sections: page };
}

async function saveActivities(
  workspace: OpenWorkspace,
  subjectId: string,
  link: MoodleLink,
  course: CourseRead,
): Promise<void> {
  const file: ActivitiesFile = {
    format: "resit-moodle-activities",
    formatVersion: 1,
    siteUrl: link.siteUrl,
    courseId: link.courseId,
    checkedAt: new Date().toISOString(),
    ...planActivities(course, link),
    ...(course.announcements ? { announcements: course.announcements } : {}),
  };
  await writeJson(activitiesPath(workspace, subjectId), file);
}

function subjectLink(workspace: OpenWorkspace, subjectId: string): MoodleLink {
  const subject = workspace.subjects.get(subjectId);
  if (!subject) throw new WorkspaceError(t("That subject no longer exists."));
  if (!subject.info.moodle)
    throw new WorkspaceError(
      t("That subject does not follow a Moodle course."),
    );
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
  const course = await readCourse(workspace, session, subjectId, link);
  await saveActivities(workspace, subjectId, link, course);
  return planCourse(
    course.sections,
    link,
    await downloaded(workspace, subjectId, link),
    course.assignments,
  );
}

/** Reads every followed course again and saves its activities. */
export async function refreshActivities(
  workspace: OpenWorkspace,
  session: MoodleSession,
): Promise<{ subjectId: string; message: string }[]> {
  const failures: { subjectId: string; message: string }[] = [];
  await Promise.all(
    [...workspace.subjects.values()].map(async ({ info }) => {
      if (!info.moodle) return;
      try {
        await saveActivities(
          workspace,
          info.id,
          info.moodle,
          await readCourse(workspace, session, info.id, info.moodle),
        );
      } catch (error) {
        failures.push({
          subjectId: info.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
  return failures;
}

/** What each followed subject's course held when resit last read it. */
export async function listActivities(
  workspace: OpenWorkspace,
): Promise<SubjectActivities[]> {
  const found: SubjectActivities[] = [];
  for (const { info } of workspace.subjects.values()) {
    const link = info.moodle;
    if (!link) continue;
    const file = await readSaved(workspace, info.id, link);
    if (!file) continue;
    const owned = file.activities.some((activity) => activity.attachments)
      ? await downloaded(workspace, info.id, link)
      : new Map<string, { resourceId: string }>();
    found.push({
      subjectId: info.id,
      checkedAt: file.checkedAt,
      ...(file.sections ? { sections: file.sections } : {}),
      ...(file.announcements ? { announcements: file.announcements } : {}),
      activities: file.activities.map(({ attachments, ...activity }) => ({
        ...activity,
        ...(attachments
          ? {
              attachments: attachments.map((attachment) => {
                const resourceId = owned.get(attachment.key)?.resourceId;
                return resourceId ? { ...attachment, resourceId } : attachment;
              }),
            }
          : {}),
      })),
    });
  }
  return found;
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
          await replaceFileWithHistory(workspace, {
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
