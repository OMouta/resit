import { useEffect, useState } from "react";

import type { LocaleFormatters } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";

import type {
  MoodleActivityDate,
  SubjectActivities,
} from "../../../shared/moodle";
import { api } from "./api";

/**
 * Every followed subject's Moodle activities as last saved. Reloads when
 * resit reads a course again or the workspace changes. `null` while loading.
 */
export function useMoodleActivities(): SubjectActivities[] | null {
  const [subjects, setSubjects] = useState<SubjectActivities[] | null>(null);
  useEffect(() => {
    let current = true;
    const load = () =>
      api.listMoodleActivities().then(
        (next) => {
          if (current) setSubjects(next);
        },
        () => {
          if (current) setSubjects([]);
        },
      );
    void load();
    const stop = api.onEvent((event) => {
      if (
        event.type === "moodle-activities-changed" ||
        event.type === "workspace-changed"
      )
        void load();
    });
    return () => {
      current = false;
      stop();
    };
  }, []);
  return subjects;
}

/**
 * Moodle's own labels are in the site's language and in the tense of the
 * moment resit checked ("Opened", "Opens"), so the common dates get ours.
 */
const DATE_LABELS: Record<string, string> = {
  duedate: msg("Due"),
  cutoffdate: msg("Closes"),
  timeclose: msg("Closes"),
  timeopen: msg("Opens"),
  allowsubmissionsfromdate: msg("Opens"),
  timeavailablefrom: msg("Opens"),
  timeavailableto: msg("Closes"),
  submissionstart: msg("Opens"),
  submissionend: msg("Due"),
};

/** English for `t`, or Moodle's own label, which `t` leaves alone. */
export function dateLabel(date: MoodleActivityDate): string {
  return DATE_LABELS[date.type] ?? (date.label || msg("Date"));
}

/** A due date or a closing time: what a student must beat. */
export function isDeadline(date: MoodleActivityDate): boolean {
  const label = DATE_LABELS[date.type];
  return label === "Due" || label === "Closes";
}

const TYPE_NAMES: Record<string, string> = {
  assign: msg("Assignment"),
  quiz: msg("Quiz"),
  forum: msg("Forum"),
  url: msg("Link"),
  page: msg("Page"),
  book: msg("Book"),
  choice: msg("Choice"),
  feedback: msg("Feedback"),
  lesson: msg("Lesson"),
  workshop: msg("Workshop"),
  glossary: msg("Glossary"),
  wiki: msg("Wiki"),
  data: msg("Database"),
  scorm: msg("SCORM package"),
  h5pactivity: "H5P",
  lti: msg("External tool"),
  bigbluebuttonbn: msg("Video meeting"),
};

/** English for `t`, or Moodle's module name. */
export function activityType(modname: string): string {
  return TYPE_NAMES[modname] ?? modname;
}

type Activity = SubjectActivities["activities"][number];

/** Labels are text on the course page, not activities a student opens. */
export function isLabel(activity: Activity): boolean {
  return activity.modname === "label";
}

/** Opens a link activity's own address, or anything else in Moodle. */
export function openInBrowser(activity: Activity): void {
  void api.openExternal(activity.link ?? activity.url).catch(() => undefined);
}

/** resit has something to show for it beyond a link to Moodle. */
export function hasPage(activity: Activity): boolean {
  return Boolean(activity.brief || activity.attachments?.length);
}

/** "Checked 3 hours ago", without the "Checked now" Intl would give. */
export function checkedLabel(
  at: string | number,
  { t, relative }: Pick<LocaleFormatters, "t" | "relative">,
): string {
  const time = new Date(at);
  return Date.now() - time.getTime() < 60_000
    ? t("Checked just now")
    : t("Checked {time}", { time: relative(time) });
}
