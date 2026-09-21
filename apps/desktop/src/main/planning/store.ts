import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
  busySessions,
  localInstant,
  minutesOf,
  overlaps,
  planFileSchema,
  withinAvailability,
  type Assessment,
  type AssessmentInput,
  type Availability,
  type PlanFile,
  type SessionInput,
  type SessionStatus,
  type StudySession,
  type TimeSlot,
} from "../../shared/planning";
import { exists, readJson, writeJson } from "../workspace/files";
import {
  withLock,
  WorkspaceError,
  type OpenWorkspace,
} from "../workspace/workspace";
import { t } from "../i18n";

export const PLAN_FORMAT_VERSION = 1;
const MAX_SESSIONS = 5000;
/** Longer than this is a day off, not a session. */
const MAX_SESSION_MINUTES = 8 * 60;

const now = () => new Date().toISOString();

export function planPath(workspace: OpenWorkspace): string {
  return join(workspace.root, "plan.json");
}

function emptyPlan(): PlanFile {
  return {
    format: "resit-plan",
    formatVersion: PLAN_FORMAT_VERSION,
    availability: [],
    assessments: [],
    sessions: [],
  };
}

/**
 * The workspace's study plan. A missing file means no plan yet; one that
 * cannot be parsed is an error, because it holds the student's plans.
 */
export async function readPlan(workspace: OpenWorkspace): Promise<PlanFile> {
  const path = planPath(workspace);
  if (!(await exists(path))) return emptyPlan();
  let raw: unknown;
  try {
    raw = await readJson(path);
  } catch {
    throw new WorkspaceError(
      t("plan.json is not valid JSON. It was left unchanged."),
    );
  }
  const parsed = planFileSchema.safeParse(raw);
  if (!parsed.success)
    throw new WorkspaceError(
      t("plan.json could not be read: {problem}. It was left unchanged.", {
        problem: parsed.error.issues[0]?.message ?? t("unknown problem"),
      }),
    );
  if (parsed.data.formatVersion > PLAN_FORMAT_VERSION)
    throw new WorkspaceError(
      t("This plan was written by a newer version of resit."),
    );
  return parsed.data;
}

function editPlan<T>(
  workspace: OpenWorkspace,
  change: (plan: PlanFile) => T,
): Promise<T> {
  return withLock(workspace, "plan", async () => {
    const plan = await readPlan(workspace);
    const result = change(plan);
    await writeJson(planPath(workspace), {
      ...plan,
      formatVersion: PLAN_FORMAT_VERSION,
    });
    return result;
  });
}

function checkSlot(slot: TimeSlot, what = t("The session")): void {
  const length = minutesOf(slot.end) - minutesOf(slot.start);
  if (length <= 0)
    throw new WorkspaceError(t("{what} has to end after it starts.", { what }));
  if (length > MAX_SESSION_MINUTES)
    throw new WorkspaceError(t("{what} is longer than eight hours.", { what }));
  if (Number.isNaN(localInstant(slot.date, slot.start).getTime()))
    throw new WorkspaceError(
      t("{what} is on a day that does not exist.", { what }),
    );
}

function checkSubject(workspace: OpenWorkspace, subjectId?: string): void {
  if (subjectId && !workspace.subjects.has(subjectId))
    throw new WorkspaceError(t("That subject no longer exists."));
}

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sessionFields(input: SessionInput) {
  const notes = cleanText(input.notes);
  return {
    title: input.title.trim(),
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    kind: input.kind,
    date: input.date,
    start: input.start,
    end: input.end,
    ...(input.target ? { target: input.target } : {}),
    ...(notes ? { notes } : {}),
  };
}

/** Adds a session, or changes one the student already has. */
export async function saveSession(
  workspace: OpenWorkspace,
  input: SessionInput & { id?: string | undefined },
): Promise<StudySession> {
  if (!input.title.trim())
    throw new WorkspaceError(t("A session needs a title."));
  checkSlot(input);
  checkSubject(workspace, input.subjectId);
  return editPlan(workspace, (plan) => {
    const at = now();
    if (input.id) {
      const index = plan.sessions.findIndex((entry) => entry.id === input.id);
      const current = plan.sessions[index];
      if (!current)
        throw new WorkspaceError(t("That session is no longer in the plan."));
      const {
        subjectId: _subject,
        target: _target,
        notes: _notes,
        move: _move,
        ...rest
      } = current;
      const next: StudySession = {
        ...rest,
        ...sessionFields(input),
        updatedAt: at,
      };
      plan.sessions[index] = next;
      return next;
    }
    if (plan.sessions.length >= MAX_SESSIONS)
      throw new WorkspaceError(
        t("The plan is full. Delete old sessions first."),
      );
    const session: StudySession = {
      id: randomUUID(),
      ...sessionFields(input),
      status: "planned",
      createdAt: at,
      updatedAt: at,
    };
    plan.sessions.push(session);
    return session;
  });
}

export function deleteSession(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  return editPlan(workspace, (plan) => {
    const remaining = plan.sessions.filter((entry) => entry.id !== id);
    if (remaining.length === plan.sessions.length)
      throw new WorkspaceError(t("That session is no longer in the plan."));
    plan.sessions = remaining;
  });
}

/** Marks a session done or skipped, or back to planned. */
export function setSessionStatus(
  workspace: OpenWorkspace,
  id: string,
  status: SessionStatus,
): Promise<StudySession> {
  return editPlan(workspace, (plan) => {
    const index = plan.sessions.findIndex((entry) => entry.id === id);
    const current = plan.sessions[index];
    if (!current)
      throw new WorkspaceError(t("That session is no longer in the plan."));
    if (current.proposal)
      throw new WorkspaceError(t("Accept the suggested session first."));
    const at = now();
    const { completedAt: _completed, ...rest } = current;
    const next: StudySession = {
      ...rest,
      status,
      ...(status === "done" ? { completedAt: at } : {}),
      updatedAt: at,
    };
    plan.sessions[index] = next;
    return next;
  });
}

/**
 * Accepts or declines the assistant's suggestions: new sessions, and new
 * times for existing ones. Nothing it suggests changes the plan until then.
 */
export function resolveProposals(
  workspace: OpenWorkspace,
  ids: string[],
  accept: boolean,
): Promise<void> {
  const wanted = new Set(ids);
  return editPlan(workspace, (plan) => {
    const at = now();
    plan.sessions = plan.sessions.flatMap((session) => {
      if (!wanted.has(session.id)) return [session];
      if (session.proposal) {
        if (!accept) return [];
        const { proposal: _proposal, ...rest } = session;
        return [{ ...rest, updatedAt: at }];
      }
      if (session.move) {
        const { move, ...rest } = session;
        return [
          accept
            ? {
                ...rest,
                date: move.date,
                start: move.start,
                end: move.end,
                updatedAt: at,
              }
            : { ...rest, updatedAt: at },
        ];
      }
      return [session];
    });
  });
}

export async function saveAssessment(
  workspace: OpenWorkspace,
  input: AssessmentInput & { id?: string | undefined },
): Promise<Assessment> {
  if (!input.title.trim())
    throw new WorkspaceError(t("An assessment needs a title."));
  checkSubject(workspace, input.subjectId);
  return editPlan(workspace, (plan) => {
    const at = now();
    const notes = cleanText(input.notes);
    const fields = {
      title: input.title.trim(),
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      date: input.date,
      ...(input.time ? { time: input.time } : {}),
      ...(notes ? { notes } : {}),
    };
    if (input.id) {
      const index = plan.assessments.findIndex(
        (entry) => entry.id === input.id,
      );
      const current = plan.assessments[index];
      if (!current)
        throw new WorkspaceError(
          t("That assessment is no longer in the plan."),
        );
      const next: Assessment = {
        id: current.id,
        createdAt: current.createdAt,
        ...fields,
        updatedAt: at,
      };
      plan.assessments[index] = next;
      return next;
    }
    const assessment: Assessment = {
      id: randomUUID(),
      ...fields,
      createdAt: at,
      updatedAt: at,
    };
    plan.assessments.push(assessment);
    return assessment;
  });
}

export function deleteAssessment(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  return editPlan(workspace, (plan) => {
    const remaining = plan.assessments.filter((entry) => entry.id !== id);
    if (remaining.length === plan.assessments.length)
      throw new WorkspaceError(t("That assessment is no longer in the plan."));
    plan.assessments = remaining;
  });
}

/** Replaces the weekly study times. Overlapping times on a day are merged. */
export async function setAvailability(
  workspace: OpenWorkspace,
  slots: Availability[],
): Promise<Availability[]> {
  for (const slot of slots)
    if (minutesOf(slot.end) <= minutesOf(slot.start))
      throw new WorkspaceError(t("A study time has to end after it starts."));
  const merged: Availability[] = [];
  const sorted = [...slots].sort(
    (a, b) => a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start),
  );
  for (const slot of sorted) {
    const last = merged.at(-1);
    if (
      last &&
      last.weekday === slot.weekday &&
      minutesOf(slot.start) <= minutesOf(last.end)
    ) {
      if (minutesOf(slot.end) > minutesOf(last.end)) last.end = slot.end;
    } else merged.push({ ...slot });
  }
  return editPlan(workspace, (plan) => {
    plan.availability = merged;
    return merged;
  });
}

export interface ProposedSession extends SessionInput {
  reason?: string | undefined;
}

export interface ProposedMove {
  sessionId: string;
  date: string;
  start: string;
  end: string;
  reason?: string | undefined;
}

function describeSlot(slot: TimeSlot): string {
  return `${slot.date} ${slot.start}–${slot.end}`;
}

/**
 * Checks the assistant's suggestions against the plan and saves them as
 * suggestions the student accepts or declines. Nothing is saved when any of
 * them does not fit; the problems come back instead.
 */
export function proposeChanges(
  workspace: OpenWorkspace,
  input: { sessions: ProposedSession[]; moves: ProposedMove[] },
  at = new Date(),
): Promise<{ problems: string[]; sessionIds: string[] }> {
  for (const session of input.sessions)
    checkSubject(workspace, session.subjectId);
  return editPlan(workspace, (plan) => {
    const problems: string[] = [];
    const moving = new Set(input.moves.map((move) => move.sessionId));
    // Pending suggestions hold their time too, so two answers do not collide.
    const taken: { slot: TimeSlot; label: string }[] = plan.sessions
      .filter(
        (session) => session.status !== "skipped" && !moving.has(session.id),
      )
      .map((session) => ({
        slot: session.move ?? session,
        label: `"${session.title}"`,
      }));
    const place = (slot: TimeSlot, label: string) => {
      try {
        checkSlot(slot, label);
      } catch (error) {
        problems.push((error as Error).message);
        return;
      }
      if (localInstant(slot.date, slot.start).getTime() < at.getTime())
        problems.push(`${label} starts in the past (${describeSlot(slot)}).`);
      const clash = taken.find((entry) => overlaps(entry.slot, slot));
      if (clash)
        problems.push(
          `${label} (${describeSlot(slot)}) overlaps ${clash.label} at ${describeSlot(clash.slot)}.`,
        );
      if (
        plan.availability.length > 0 &&
        !withinAvailability(slot, plan.availability)
      )
        problems.push(
          `${label} (${describeSlot(slot)}) is outside the student's study times.`,
        );
      taken.push({ slot, label });
    };
    for (const move of input.moves) {
      const session = plan.sessions.find(
        (entry) => entry.id === move.sessionId,
      );
      if (!session || session.proposal || session.status !== "planned") {
        problems.push(
          `There is no planned session with the ID ${move.sessionId} to move.`,
        );
        continue;
      }
      place(move, `The new time for "${session.title}"`);
    }
    for (const session of input.sessions)
      place(session, `"${session.title.trim() || "Untitled"}"`);
    if (problems.length > 0) return { problems, sessionIds: [] };

    const stamp = now();
    const sessionIds: string[] = [];
    for (const move of input.moves) {
      const session = plan.sessions.find(
        (entry) => entry.id === move.sessionId,
      );
      if (!session) continue;
      const reason = cleanText(move.reason);
      session.move = {
        date: move.date,
        start: move.start,
        end: move.end,
        ...(reason ? { reason } : {}),
      };
      session.updatedAt = stamp;
      sessionIds.push(session.id);
    }
    for (const proposed of input.sessions) {
      const reason = cleanText(proposed.reason);
      const session: StudySession = {
        id: randomUUID(),
        ...sessionFields(proposed),
        status: "planned",
        author: "assistant",
        proposal: reason ? { reason } : {},
        createdAt: stamp,
        updatedAt: stamp,
      };
      plan.sessions.push(session);
      sessionIds.push(session.id);
    }
    return { problems, sessionIds };
  });
}

/** Sessions that need a reminder: accepted, planned, and still to start. */
export function upcomingSessions(plan: PlanFile, at: Date): StudySession[] {
  return busySessions(plan).filter(
    (session) =>
      session.status === "planned" &&
      localInstant(session.date, session.start).getTime() > at.getTime(),
  );
}
