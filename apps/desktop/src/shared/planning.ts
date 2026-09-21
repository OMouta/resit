import { z } from "zod";

import { msg } from "@resit/ui/lib/i18n";

const timestamp = z.iso.datetime({ offset: true });
/** A calendar day, `2026-10-05`. */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** A time of day on the student's clock, `18:30`. */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const SESSION_KIND_VALUES = [
  "reading",
  "exercises",
  "quiz",
  "flashcards",
] as const;
export const sessionKindSchema = z.enum(SESSION_KIND_VALUES);
export type SessionKind = z.infer<typeof sessionKindSchema>;

export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  reading: msg("Reading"),
  exercises: msg("Exercises"),
  quiz: msg("Quiz"),
  flashcards: msg("Flashcards"),
};

/** What a session opens when the student starts it. */
export const sessionTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("resource"), resourceId: z.string().min(1) }),
  z.object({
    type: z.literal("quiz"),
    subjectId: z.string().min(1),
    quizId: z.string().min(1),
  }),
  z.object({ type: z.literal("cards"), subjectId: z.string().min(1) }),
]);
export type SessionTarget = z.infer<typeof sessionTargetSchema>;

export const SESSION_STATUS_VALUES = ["planned", "done", "skipped"] as const;
export type SessionStatus = (typeof SESSION_STATUS_VALUES)[number];

const slotSchema = z.object({
  date: dateSchema,
  start: timeSchema,
  end: timeSchema,
});
export type TimeSlot = z.infer<typeof slotSchema>;

/**
 * A study session. Times are wall-clock times on the date, so a session at
 * 18:00 stays at 18:00 across a change to or from summer time.
 */
export const sessionSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  subjectId: z.string().optional(),
  kind: sessionKindSchema.catch("reading"),
  ...slotSchema.shape,
  target: sessionTargetSchema.optional().catch(undefined),
  notes: z.string().optional(),
  status: z.enum(SESSION_STATUS_VALUES).catch("planned"),
  author: z.literal("assistant").optional().catch(undefined),
  /** Set while the session is the assistant's suggestion, before the student accepts it. */
  proposal: z.object({ reason: z.string().optional() }).optional(),
  /** A new time the assistant suggested for this session. */
  move: slotSchema.extend({ reason: z.string().optional() }).optional(),
  completedAt: timestamp.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type StudySession = z.infer<typeof sessionSchema>;

export const assessmentSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string().min(1),
  subjectId: z.string().optional(),
  date: dateSchema,
  time: timeSchema.optional(),
  notes: z.string().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Assessment = z.infer<typeof assessmentSchema>;

/** A time the student keeps free for study every week. 1 is Monday. */
export const availabilitySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  start: timeSchema,
  end: timeSchema,
});
export type Availability = z.infer<typeof availabilitySchema>;

/** `plan.json` at the workspace root. */
export const planFileSchema = z.looseObject({
  format: z.literal("resit-plan"),
  formatVersion: z.number().int().positive(),
  availability: z.array(availabilitySchema).catch([]),
  assessments: z.array(assessmentSchema),
  sessions: z.array(sessionSchema),
});
export type PlanFile = z.infer<typeof planFileSchema>;

export interface SessionInput {
  title: string;
  subjectId?: string | undefined;
  kind: SessionKind;
  date: string;
  start: string;
  end: string;
  target?: SessionTarget | undefined;
  notes?: string | undefined;
}

export interface AssessmentInput {
  title: string;
  subjectId?: string | undefined;
  date: string;
  time?: string | undefined;
  notes?: string | undefined;
}

/** A wall-clock time on a date, as an instant on this computer's clock. */
export function localInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

/** The local calendar date of an instant, `2026-10-05`. */
export function localDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

/** Monday is 1, Sunday is 7. */
export function isoWeekday(date: string): number {
  const day = localInstant(date, "12:00").getDay();
  return day === 0 ? 7 : day;
}

/** Minutes since midnight. */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** A planned session whose time has passed without it being marked done. */
export function isOverdue(session: StudySession, at = new Date()): boolean {
  return (
    session.status === "planned" &&
    !session.proposal &&
    localInstant(session.date, session.end).getTime() < at.getTime()
  );
}

/** Two slots on the same day that share any time. */
export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return (
    a.date === b.date &&
    minutesOf(a.start) < minutesOf(b.end) &&
    minutesOf(b.start) < minutesOf(a.end)
  );
}

/** The slot sits inside one of the student's weekly study times. */
export function withinAvailability(
  slot: TimeSlot,
  availability: Availability[],
): boolean {
  const weekday = isoWeekday(slot.date);
  return availability.some(
    (window) =>
      window.weekday === weekday &&
      minutesOf(window.start) <= minutesOf(slot.start) &&
      minutesOf(slot.end) <= minutesOf(window.end),
  );
}

/**
 * Sessions that take up time: planned or done, accepted by the student.
 * Skipped sessions and unanswered suggestions leave the time free.
 */
export function busySessions(plan: PlanFile): StudySession[] {
  return plan.sessions.filter(
    (session) => session.status !== "skipped" && !session.proposal,
  );
}
