import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  Notification: { isSupported: () => false },
}));

import { calendarFile } from "../../apps/desktop/src/main/planning/ics";
import { reminderTimes } from "../../apps/desktop/src/main/planning/reminders";
import {
  proposeChanges,
  readPlan,
  resolveProposals,
  saveAssessment,
  saveSession,
  setAvailability,
  setSessionStatus,
} from "../../apps/desktop/src/main/planning/store";
import {
  createWorkspace,
  openWorkspace,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import type { PlanFile } from "../../apps/desktop/src/shared/planning";

let directory: string;
let workspace: OpenWorkspace;
let subjectId: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-planning-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies 2026/27",
    subject: { name: "Mathematics", color: "blue" },
  });
  subjectId = snapshot(workspace).subjects[0]!.id;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const monday = "2026-10-05";
const tuesday = "2026-10-06";
const before = new Date("2026-10-01T09:00:00");

describe("study plan", () => {
  it("saves sessions and marks them done, keeping their ID", async () => {
    const session = await saveSession(workspace, {
      title: "Limits worksheet",
      subjectId,
      kind: "exercises",
      date: monday,
      start: "18:00",
      end: "19:30",
    });
    const edited = await saveSession(workspace, {
      id: session.id,
      title: "Limits worksheet, part 2",
      subjectId,
      kind: "exercises",
      date: monday,
      start: "18:30",
      end: "19:30",
    });
    expect(edited.id).toBe(session.id);
    const done = await setSessionStatus(workspace, session.id, "done");
    expect(done.completedAt).toBeDefined();

    const reopened = await openWorkspace(workspace.root);
    const plan = await readPlan(reopened);
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]).toMatchObject({
      title: "Limits worksheet, part 2",
      start: "18:30",
      status: "done",
    });
  });

  it("refuses a session that ends before it starts", async () => {
    await expect(
      saveSession(workspace, {
        title: "Backwards",
        kind: "reading",
        date: monday,
        start: "19:00",
        end: "18:00",
      }),
    ).rejects.toThrow(/end after it starts/);
  });

  it("merges overlapping study times on the same day", async () => {
    const slots = await setAvailability(workspace, [
      { weekday: 1, start: "18:00", end: "20:00" },
      { weekday: 1, start: "19:30", end: "21:00" },
      { weekday: 3, start: "09:00", end: "11:00" },
    ]);
    expect(slots).toEqual([
      { weekday: 1, start: "18:00", end: "21:00" },
      { weekday: 3, start: "09:00", end: "11:00" },
    ]);
  });
});

describe("the assistant's suggestions", () => {
  beforeEach(async () => {
    await setAvailability(workspace, [
      { weekday: 1, start: "18:00", end: "21:00" },
      { weekday: 2, start: "18:00", end: "21:00" },
    ]);
    await saveSession(workspace, {
      title: "Physics lab report",
      kind: "reading",
      date: monday,
      start: "18:00",
      end: "19:00",
    });
  });

  it("saves nothing when a suggestion overlaps, falls outside study times, or is in the past", async () => {
    const result = await proposeChanges(
      workspace,
      {
        sessions: [
          {
            title: "Clash",
            subjectId,
            kind: "reading",
            date: monday,
            start: "18:30",
            end: "19:30",
          },
          {
            title: "Too late",
            subjectId,
            kind: "reading",
            date: tuesday,
            start: "21:00",
            end: "22:00",
          },
          {
            title: "Yesterday",
            subjectId,
            kind: "reading",
            date: "2026-09-28",
            start: "18:00",
            end: "19:00",
          },
        ],
        moves: [],
      },
      before,
    );
    expect(result.problems).toHaveLength(3);
    expect(result.problems[0]).toMatch(/overlaps "Physics lab report"/);
    expect(result.problems[1]).toMatch(/outside the student's study times/);
    expect(result.problems[2]).toMatch(/in the past/);
    expect((await readPlan(workspace)).sessions).toHaveLength(1);
  });

  it("keeps suggestions apart from the plan until the student accepts them", async () => {
    const { problems, sessionIds } = await proposeChanges(
      workspace,
      {
        sessions: [
          {
            title: "Squeeze theorem",
            subjectId,
            kind: "exercises",
            date: monday,
            start: "19:00",
            end: "20:00",
            reason: "Test on Friday",
          },
          {
            title: "Flashcards",
            subjectId,
            kind: "flashcards",
            date: tuesday,
            start: "18:00",
            end: "18:30",
          },
        ],
        moves: [],
      },
      before,
    );
    expect(problems).toEqual([]);
    let plan = await readPlan(workspace);
    expect(plan.sessions.filter((session) => session.proposal)).toHaveLength(2);
    // The time a suggestion holds is not offered twice.
    const again = await proposeChanges(
      workspace,
      {
        sessions: [
          {
            title: "Also 19:00",
            kind: "reading",
            date: monday,
            start: "19:15",
            end: "19:45",
          },
        ],
        moves: [],
      },
      before,
    );
    expect(again.problems[0]).toMatch(/overlaps "Squeeze theorem"/);

    await resolveProposals(workspace, [sessionIds[0]!], true);
    await resolveProposals(workspace, [sessionIds[1]!], false);
    plan = await readPlan(workspace);
    expect(plan.sessions.map((session) => session.title)).toEqual([
      "Physics lab report",
      "Squeeze theorem",
    ]);
    expect(plan.sessions[1]!.proposal).toBeUndefined();
    expect(plan.sessions[1]!.author).toBe("assistant");
  });

  it("moves a session only when the student accepts the new time", async () => {
    const [existing] = (await readPlan(workspace)).sessions;
    const { problems } = await proposeChanges(
      workspace,
      {
        sessions: [],
        moves: [
          {
            sessionId: existing!.id,
            date: tuesday,
            start: "19:00",
            end: "20:00",
          },
        ],
      },
      before,
    );
    expect(problems).toEqual([]);
    expect((await readPlan(workspace)).sessions[0]).toMatchObject({
      date: monday,
      move: { date: tuesday, start: "19:00" },
    });
    await resolveProposals(workspace, [existing!.id], true);
    const [moved] = (await readPlan(workspace)).sessions;
    expect(moved).toMatchObject({
      date: tuesday,
      start: "19:00",
      end: "20:00",
    });
    expect(moved!.move).toBeUndefined();
  });
});

describe("calendar export", () => {
  const plan = (
    sessions: PlanFile["sessions"],
    assessments: PlanFile["assessments"] = [],
  ): PlanFile => ({
    format: "resit-plan",
    formatVersion: 1,
    availability: [],
    assessments,
    sessions,
  });
  const at = "2026-09-01T00:00:00.000Z";
  const session = (
    id: string,
    date: string,
    extra: Partial<PlanFile["sessions"][number]> = {},
  ) => ({
    id,
    title: "Limits; squeeze, and \\ bounds",
    kind: "reading" as const,
    date,
    start: "18:00",
    end: "19:00",
    status: "planned" as const,
    createdAt: at,
    updatedAt: at,
    ...extra,
  });

  it("keeps a session's local time across a change to summer time", () => {
    const previous = process.env.TZ;
    process.env.TZ = "Europe/Lisbon";
    try {
      const file = calendarFile(
        plan([session("a", "2026-03-28"), session("b", "2026-03-30")]),
        new Map(),
      );
      // 18:00 in Lisbon is 18:00 UTC in winter and 17:00 UTC in summer.
      expect(file).toContain("DTSTART:20260328T180000Z");
      expect(file).toContain("DTSTART:20260330T170000Z");
    } finally {
      process.env.TZ = previous;
    }
  });

  it("leaves out skipped sessions and suggestions, and escapes and folds text", () => {
    const file = calendarFile(
      plan(
        [
          session("kept", monday, { notes: "Worksheet 1, questions 1–4" }),
          session("skipped", monday, { status: "skipped" }),
          session("suggested", monday, { proposal: {} }),
        ],
        [
          {
            id: "exam",
            title: "Mathematics exam",
            subjectId,
            date: "2026-10-20",
            createdAt: at,
            updatedAt: at,
          },
        ],
      ),
      new Map([[subjectId, "Mathematics"]]),
    );
    expect(file).toContain("UID:session-kept@resit.study");
    expect(file).not.toContain("session-skipped");
    expect(file).not.toContain("session-suggested");
    expect(file).toContain("SUMMARY:Limits\\; squeeze\\, and \\\\ bounds");
    expect(file).toContain("DTSTART;VALUE=DATE:20261020");
    expect(file).toContain("DTEND;VALUE=DATE:20261021");
    expect(file.endsWith("\r\n")).toBe(true);
    for (const line of file.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("reminders", () => {
  it("fires before accepted, planned sessions only, and only when turned on", async () => {
    await saveSession(workspace, {
      title: "Limits",
      kind: "reading",
      date: monday,
      start: "18:00",
      end: "19:00",
    });
    const skipped = await saveSession(workspace, {
      title: "Skipped",
      kind: "reading",
      date: monday,
      start: "20:00",
      end: "21:00",
    });
    await setSessionStatus(workspace, skipped.id, "skipped");
    await proposeChanges(
      workspace,
      {
        sessions: [
          {
            title: "Suggested",
            kind: "reading",
            date: monday,
            start: "19:00",
            end: "20:00",
          },
        ],
        moves: [],
      },
      before,
    );
    const current = await readPlan(workspace);
    const at = new Date(`${monday}T08:00:00`);
    expect(
      reminderTimes(current, { enabled: false, minutesBefore: 10 }, at),
    ).toEqual([]);
    const times = reminderTimes(
      current,
      { enabled: true, minutesBefore: 10 },
      at,
    );
    expect(times.map((entry) => entry.session.title)).toEqual(["Limits"]);
    expect(times[0]!.at).toEqual(new Date(`${monday}T17:50:00`));
  });
});

describe("assessments", () => {
  it("saves an assessment with or without a time", async () => {
    const exam = await saveAssessment(workspace, {
      title: "Test 1",
      subjectId,
      date: "2026-10-20",
      time: "09:00",
    });
    await saveAssessment(workspace, {
      id: exam.id,
      title: "Test 1",
      subjectId,
      date: "2026-10-21",
    });
    const [stored] = (await readPlan(workspace)).assessments;
    expect(stored).toMatchObject({ date: "2026-10-21" });
    expect(stored!.time).toBeUndefined();
  });
});
