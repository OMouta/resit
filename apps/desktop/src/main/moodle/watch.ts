import type { OpenWorkspace } from "../workspace/workspace";
import { moodleConnection, moodleSession } from "./credentials";
import { refreshActivities } from "./sync";

/** How often an open workspace reads its courses again. */
const INTERVAL_MS = 30 * 60_000;
/** The first read waits for the window to settle. */
const FIRST_MS = 5_000;

let timer: NodeJS.Timeout | null = null;
/** Bumped whenever the workspace changes, so an old check stops rescheduling. */
let generation = 0;

/**
 * Reads the followed courses when a workspace opens and every half hour
 * after, so new files, dates, and announcements show without a visit to
 * the schedule. Pass null when the workspace closes.
 */
export function watchMoodle(
  workspace: OpenWorkspace | null,
  onChecked: () => void,
): void {
  const current = ++generation;
  if (timer) clearTimeout(timer);
  timer = null;
  if (!workspace) return;

  const check = async () => {
    if (current !== generation) return;
    const follows = [...workspace.subjects.values()].some(
      ({ info }) => info.moodle,
    );
    if (follows && (await moodleConnection()).status === "connected") {
      try {
        const failures = await refreshActivities(
          workspace,
          await moodleSession(),
        );
        for (const failure of failures)
          console.error("A Moodle course was not read", failure);
        if (current === generation) onChecked();
      } catch (error) {
        console.error("Moodle was not checked", error);
      }
    }
    if (current !== generation) return;
    timer = setTimeout(() => void check(), INTERVAL_MS);
    timer.unref();
  };
  timer = setTimeout(() => void check(), FIRST_MS);
  timer.unref();
}
