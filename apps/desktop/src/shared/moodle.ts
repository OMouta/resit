import { z } from "zod";

/** A subject's link to one Moodle course. Stored in `subject.json`. */
export const moodleLinkSchema = z.object({
  siteUrl: z.url(),
  courseId: z.number().int().positive(),
  shortname: z.string(),
  fullname: z.string(),
});
export type MoodleLink = z.infer<typeof moodleLinkSchema>;

/**
 * Where a downloaded file came from. Stored in the resource's sidecar, so the
 * workspace itself records what has been synced and no manifest can disagree
 * with the files on disk.
 */
export const moodleFileRefSchema = z.object({
  siteUrl: z.string(),
  courseId: z.number().int().positive(),
  moduleId: z.number().int().nonnegative(),
  /** Identifies the Moodle file across syncs. See `itemKey`. */
  key: z.string(),
  filename: z.string(),
  filesize: z.number().int().nonnegative(),
  timemodified: z.number().int().nonnegative(),
});
export type MoodleFileRef = z.infer<typeof moodleFileRefSchema>;

export function itemKey(moduleId: number, path: string): string {
  return `${moduleId}:${path}`;
}

/** Machine-level connection state. The token never reaches the renderer. */
export type MoodleConnection =
  | { status: "disconnected" }
  | {
      status: "connected";
      siteUrl: string;
      siteName: string;
      fullName: string;
      username: string;
    }
  | { status: "failed"; siteUrl: string; message: string };

export interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
}

/**
 * A course title carries a department code and a term around the part a
 * student would call the subject: "DEE-EC - Projeto de Engenharia em
 * Eletrotecnia - 1º Semestre 2026/2027" is the subject "Projeto de Engenharia
 * em Eletrotecnia". Only a suggestion; the field stays editable.
 */
export function subjectNameFromCourse(course: MoodleCourse): string {
  const parts = course.fullname
    .split(/\s+[-–—|]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const name = parts.find(
    (part) =>
      // A year, a term, or an all-caps code is not the subject's name.
      !/\d{4}/.test(part) &&
      !/\b(semestre|semester|trimestre|ano|year|s[12])\b/i.test(part) &&
      !/^[^\p{Ll}]+$/u.test(part),
  );
  return (name ?? parts[0] ?? course.fullname).slice(0, 80);
}

/** One downloadable Moodle file, compared against what the subject already has. */
export interface MoodleItem {
  key: string;
  moduleId: number;
  /** Folder inside the subject. Empty for the course's loose material. */
  section: string;
  /** The section's name in Moodle, for display. */
  sectionName: string;
  /** Title for the resource: the activity name, or the filename in a folder. */
  name: string;
  filename: string;
  filesize: number;
  timemodified: number;
  fileUrl: string;
  state: "new" | "updated" | "current";
  /** The resource already in the workspace, when there is one. */
  resourceId?: string;
}

/** Why something in the course was left out, so the dialog can say so. */
export interface MoodleSkipped {
  reason: "unsupported" | "external" | "too-large";
  detail: string;
  count: number;
}

export interface MoodleCourseContents {
  course: MoodleLink;
  items: MoodleItem[];
  skipped: MoodleSkipped[];
}

export interface MoodleDownloadResult {
  added: number;
  replaced: number;
  failures: { key: string; filename: string; message: string }[];
}

const moodleActivityDateSchema = z.object({
  /** Moodle's name for the date, such as `duedate` or `timeclose`. */
  type: z.string(),
  /** Moodle's own label, in the site's language. */
  label: z.string(),
  at: z.iso.datetime({ offset: true }),
});
export type MoodleActivityDate = z.infer<typeof moodleActivityDateSchema>;

/** Something in a course resit does not download: an assignment, a quiz, a forum. */
const moodleActivitySchema = z.object({
  moduleId: z.number().int().nonnegative(),
  name: z.string(),
  /** Moodle's activity type: `assign`, `quiz`, `forum`, … */
  modname: z.string(),
  sectionName: z.string(),
  /** The activity's page in Moodle. */
  url: z.string(),
  dates: z.array(moodleActivityDateSchema),
  /**
   * The assignment brief, a page's or book's text, or the description the
   * course shows, as Markdown.
   */
  brief: z.string().optional(),
  /** When a page or book last changed, so its text is read again only then. */
  contentModified: z.number().int().nonnegative().optional(),
  /** Files attached to an assignment brief, keyed like download items. */
  attachments: z
    .array(z.object({ key: z.string(), filename: z.string() }))
    .optional(),
});
export type MoodleActivity = z.infer<typeof moodleActivitySchema>;

/** One section of the course page, with the modules it shows, in order. */
const moodleCourseSectionSchema = z.object({
  name: z.string(),
  /** The text Moodle shows at the top of the section, as Markdown. */
  summary: z.string().optional(),
  moduleIds: z.array(z.number().int().nonnegative()),
});
export type MoodleCourseSection = z.infer<typeof moodleCourseSectionSchema>;

/**
 * `subjects/<folder>/activities.json`. resit rewrites it whenever it reads
 * the course, so it is never edited by hand.
 */
export const activitiesFileSchema = z.object({
  format: z.literal("resit-moodle-activities"),
  formatVersion: z.number().int().positive(),
  siteUrl: z.string(),
  courseId: z.number().int().positive(),
  checkedAt: z.iso.datetime({ offset: true }),
  /** Labels are here as activities of type `label`, with their text as the brief. */
  activities: z.array(moodleActivitySchema),
  sections: z.array(moodleCourseSectionSchema).optional(),
});
export type ActivitiesFile = z.infer<typeof activitiesFileSchema>;

/** The course's own page in Moodle. */
export function courseUrl(link: { siteUrl: string; courseId: number }): string {
  return `${link.siteUrl}/course/view.php?id=${link.courseId}`;
}

/** A subject's activities as resit last saw them in Moodle. */
export interface SubjectActivities {
  subjectId: string;
  checkedAt: string;
  sections?: MoodleCourseSection[];
  activities: (Omit<MoodleActivity, "attachments"> & {
    attachments?: {
      key: string;
      filename: string;
      /** Set once the file has been downloaded into the subject. */
      resourceId?: string;
    }[];
  })[];
}
