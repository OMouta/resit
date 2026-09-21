import { Notification } from "electron";

import {
  localInstant,
  type PlanFile,
  type StudySession,
} from "../../shared/planning";
import type { ReminderSettings } from "../../shared/settings";
import { loadSettings } from "../settings";
import type { OpenWorkspace } from "../workspace/workspace";
import { readPlan, upcomingSessions } from "./store";
import { t } from "../i18n";

/** Reminders further ahead are set the next time the plan is read. */
const LOOKAHEAD_MS = 36 * 60 * 60_000;
/** Timers this long drift; the plan is read again well before that matters. */
const RECHECK_MS = 6 * 60 * 60_000;

interface Source {
  workspace: () => OpenWorkspace | null;
  /** The student clicked a reminder. */
  onOpen: (session: StudySession) => void;
}

let source: Source | null = null;
let timers: NodeJS.Timeout[] = [];
/** Bumped on each refresh, so a slower earlier one sets no timers. */
let generation = 0;

export function startReminders(next: Source): void {
  source = next;
}

function clear(): void {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
}

/** When each reminder is due, soonest first. Pure, so it can be tested. */
export function reminderTimes(
  plan: PlanFile,
  settings: ReminderSettings,
  at: Date,
): { session: StudySession; at: Date }[] {
  if (!settings.enabled) return [];
  return upcomingSessions(plan, at)
    .map((session) => ({
      session,
      at: new Date(
        localInstant(session.date, session.start).getTime() -
          settings.minutesBefore * 60_000,
      ),
    }))
    .filter(
      (entry) =>
        entry.at.getTime() > at.getTime() &&
        entry.at.getTime() - at.getTime() <= LOOKAHEAD_MS,
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

function show(session: StudySession, settings: ReminderSettings): void {
  if (!Notification.isSupported()) return;
  const starts =
    settings.minutesBefore === 0
      ? t("Starts now, {start}–{end}", {
          start: session.start,
          end: session.end,
        })
      : t("Starts at {start}, ends at {end}", {
          start: session.start,
          end: session.end,
        });
  const notification = new Notification({ title: session.title, body: starts });
  notification.on("click", () => source?.onOpen(session));
  notification.show();
}

/**
 * Sets a timer for each reminder in the next day and a half. Called when a
 * workspace opens or closes, the plan changes, or the setting changes.
 */
export async function refreshReminders(): Promise<void> {
  const current = ++generation;
  clear();
  const workspace = source?.workspace();
  if (!workspace) return;
  const settings = (await loadSettings()).reminders;
  if (!settings.enabled) return;
  let plan: PlanFile;
  try {
    plan = await readPlan(workspace);
  } catch (error) {
    console.error("Reminders were not set", error);
    return;
  }
  if (current !== generation) return;
  const at = new Date();
  for (const entry of reminderTimes(plan, settings, at))
    timers.push(
      setTimeout(
        () => show(entry.session, settings),
        entry.at.getTime() - at.getTime(),
      ),
    );
  timers.push(setTimeout(() => void refreshReminders(), RECHECK_MS));
}
