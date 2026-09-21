import { useEffect, useState } from "react";

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
  duedate: "Due",
  cutoffdate: "Closes",
  timeclose: "Closes",
  timeopen: "Opens",
  allowsubmissionsfromdate: "Opens",
  timeavailablefrom: "Opens",
  timeavailableto: "Closes",
  submissionstart: "Opens",
  submissionend: "Due",
};

export function dateLabel(date: MoodleActivityDate): string {
  return DATE_LABELS[date.type] ?? (date.label || "Date");
}

/** A due date or a closing time: what a student must beat. */
export function isDeadline(date: MoodleActivityDate): boolean {
  const label = DATE_LABELS[date.type];
  return label === "Due" || label === "Closes";
}

const TYPE_NAMES: Record<string, string> = {
  assign: "Assignment",
  quiz: "Quiz",
  forum: "Forum",
  url: "Link",
  page: "Page",
  book: "Book",
  choice: "Choice",
  feedback: "Feedback",
  lesson: "Lesson",
  workshop: "Workshop",
  glossary: "Glossary",
  wiki: "Wiki",
  data: "Database",
  scorm: "SCORM package",
  h5pactivity: "H5P",
  lti: "External tool",
  bigbluebuttonbn: "Video meeting",
};

export function activityType(modname: string): string {
  return TYPE_NAMES[modname] ?? modname;
}

/** "Checked 3 hours ago", without the "Checked now" Intl would give. */
export function checkedLabel(
  at: string | number,
  relative: (value: Date) => string,
): string {
  const time = new Date(at);
  return Date.now() - time.getTime() < 60_000
    ? "Checked just now"
    : `Checked ${relative(time)}`;
}
