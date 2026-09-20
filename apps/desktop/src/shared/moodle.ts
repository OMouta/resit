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
