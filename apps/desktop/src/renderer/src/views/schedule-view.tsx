import {
  CalendarClockIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SkipForwardIcon,
  XIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { InlineMessage } from "@resit/ui/components/inline-message";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";
import type { AgendaStatus } from "@resit/ui/patterns/study/agenda-item";
import {
  AssessmentCard,
  CalendarActivityCard,
  TimeGrid,
  TimeGridCard,
  type TimeGridBlock,
  type TimeRange,
} from "@resit/ui/patterns/study/calendar";

import type {
  MoodleActivityDate,
  MoodleConnection,
  SubjectActivities,
} from "../../../shared/moodle";
import {
  isOverdue,
  isoWeekday,
  localInstant,
  minutesOf,
  type Availability,
  type PlanFile,
  type StudySession,
  type TimeSlot,
} from "../../../shared/planning";
import type { SubjectInfo, WorkspaceSnapshot } from "../../../shared/workspace";
import { api, errorMessage } from "../lib/api";
import {
  activityType,
  checkedLabel,
  dateLabel,
  hasPage,
  isDeadline,
  isLabel,
  isSubmitted,
  openInBrowser,
  submissionLabel,
  useMoodleActivities,
  waitingFiles,
} from "../lib/moodle-activities";
import { useNotices } from "../lib/notices";
import { addDays, today, usePlan, weekOf } from "../lib/plan";
import { usePractice } from "../lib/practice";
import { useWidth } from "../lib/use-width";
import {
  AssessmentDialog,
  AvailabilityDialog,
  type AssessmentRequest,
} from "../planning/plan-dialogs";
import { SessionDialog, type SessionRequest } from "../planning/session-dialog";

type Activity = SubjectActivities["activities"][number];

/** Older than this, opening the schedule checks Moodle again. */
const RECHECK_MS = 10 * 60_000;
/** Older than this, the check time is shown as a warning. */
const STALE_MS = 2 * 24 * 60 * 60_000;
/** Narrower than this, the week is a list of days instead of a grid. */
const GRID_WIDTH = 720;

export interface ScheduleViewProps {
  snapshot: WorkspaceSnapshot;
  moodle: MoodleConnection;
  /** The tab is on top, so a stale schedule is worth checking. */
  active: boolean;
  onOpenActivity: (subjectId: string, activity: Activity) => void;
  /** The course page resit saved for a subject that follows Moodle. */
  onOpenCourse: (subjectId: string) => void;
  onOpenSettings: () => void;
  onOpenResource: (resourceId: string) => void;
  onOpenQuiz: (subjectId: string, quiz: { id: string; title: string }) => void;
  /** Opens Practice and starts reviewing a subject's due cards. */
  onReview: (subjectId: string) => void;
}

function dayKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-control items-center justify-between gap-2">
      <h2 className="px-2 text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

function sessionStatus(session: StudySession): AgendaStatus {
  if (session.status === "done") return "completed";
  if (session.status === "skipped") return "skipped";
  return isOverdue(session) ? "overdue" : "scheduled";
}

/** Your own study plan beside the dates from Moodle. */
export function ScheduleView(props: ScheduleViewProps) {
  const { snapshot } = props;
  const notices = useNotices();
  const { t, tx, date: formatDate, weekday } = useLocale();
  const { plan: saved, error } = usePlan();
  /** What a drag changed, shown until the saved plan catches up. */
  const [override, setOverride] = useState<PlanFile | null>(null);
  useEffect(() => setOverride(null), [saved]);
  const plan = override ?? saved;
  const [editingTimes, setEditingTimes] = useState(false);
  const subjectIds = useMemo(
    () => snapshot.subjects.map((subject) => subject.id),
    [snapshot.subjects],
  );
  const { practice } = usePractice(subjectIds);
  const records = useMoodleActivities();
  const [week, setWeek] = useState(today);
  const [sessionRequest, setSessionRequest] = useState<SessionRequest | null>(
    null,
  );
  const [assessmentRequest, setAssessmentRequest] =
    useState<AssessmentRequest | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);

  const subjects = useMemo(
    () => new Map(snapshot.subjects.map((subject) => [subject.id, subject])),
    [snapshot.subjects],
  );
  const liveSubjects = snapshot.subjects.filter((subject) => !subject.archived);

  const start = (session: StudySession) => {
    const target = session.target;
    if (!target) return;
    if (target.type === "resource") props.onOpenResource(target.resourceId);
    else if (target.type === "quiz") {
      const quiz = practice?.subjects
        .find((entry) => entry.subjectId === target.subjectId)
        ?.quizzes.find((entry) => entry.id === target.quizId);
      props.onOpenQuiz(target.subjectId, {
        id: target.quizId,
        title: quiz?.title ?? session.title,
      });
    } else props.onReview(target.subjectId);
  };

  const moveSession = async (session: StudySession, range: TimeRange) => {
    if (!plan) return;
    setOverride({
      ...plan,
      sessions: plan.sessions.map((entry) =>
        entry.id === session.id
          ? { ...entry, date: range.day, start: range.start, end: range.end }
          : entry,
      ),
    });
    try {
      await api.saveSession({
        id: session.id,
        title: session.title,
        subjectId: session.subjectId,
        kind: session.kind,
        date: range.day,
        start: range.start,
        end: range.end,
        target: session.target,
        notes: session.notes,
      });
    } catch (reason) {
      setOverride(null);
      notices.fail(t("The session was not moved"), reason);
    }
  };

  const changeTimes = async (times: Availability[]) => {
    if (!plan) return;
    setOverride({ ...plan, availability: times });
    try {
      await api.setAvailability(times);
    } catch (reason) {
      setOverride(null);
      notices.fail(t("The study times were not saved"), reason);
    }
  };

  const resolve = async (ids: string[], accept: boolean) => {
    try {
      await api.resolveProposals({ ids, accept });
    } catch (reason) {
      notices.fail(
        accept
          ? t("The suggestion was not accepted")
          : t("The suggestion was not declined"),
        reason,
      );
    }
  };

  const exportCalendar = async () => {
    try {
      const path = await api.exportCalendar();
      if (path)
        notices.notify({
          tone: "success",
          title: t("The study plan was exported"),
          detail: path,
        });
    } catch (reason) {
      notices.fail(t("The calendar was not exported"), reason);
    }
  };

  const days = weekOf(week);
  const compact = width > 0 && width < GRID_WIDTH;
  const thisWeek = weekOf(today())[0] === days[0];

  return (
    <div ref={rootRef} className="h-full">
      <ScrollArea className="h-full bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-8 pt-12 pb-24">
          <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <h1 className="text-3xl font-bold tracking-[-0.025em]">
              {t("Schedule")}
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={!plan}
                onClick={() =>
                  setSessionRequest({
                    initial: {
                      date: thisWeek ? today() : (days[0] ?? today()),
                    },
                  })
                }
              >
                <PlusIcon /> {t("New session")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="subtle"
                    size="icon"
                    aria-label={t("More planning actions")}
                    disabled={!plan}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setAssessmentRequest({})}>
                    <GraduationCapIcon /> {t("New assessment")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAvailabilityOpen(true)}>
                    <ClockIcon /> {t("Study times…")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportCalendar()}>
                    <DownloadIcon /> {t("Export to a calendar file…")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {error && !plan ? (
            <InlineMessage tone="error" title={t("The plan could not be read")}>
              <p>{error}</p>
            </InlineMessage>
          ) : null}

          {plan ? (
            <>
              <Decisions
                plan={plan}
                subjects={subjects}
                onEdit={(session) => setSessionRequest({ session })}
                onResolve={(ids, accept) => void resolve(ids, accept)}
              />
              <section aria-label={t("Week")} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="px-2 text-base font-semibold">
                    {thisWeek
                      ? t("This week")
                      : t("Week of {date}", {
                          date: formatDate(
                            localInstant(days[0] ?? week, "12:00"),
                            {
                              year: undefined,
                            },
                          ),
                        })}
                  </h2>
                  <div className="flex items-center gap-1">
                    {editingTimes ? (
                      <Button
                        variant="secondary"
                        onClick={() => setEditingTimes(false)}
                      >
                        <CheckIcon /> {t("Done")}
                      </Button>
                    ) : compact ? null : (
                      <Button
                        variant="subtle"
                        onClick={() => setEditingTimes(true)}
                      >
                        <ClockIcon /> {t("Study times")}
                      </Button>
                    )}
                    {thisWeek ? null : (
                      <Button variant="subtle" onClick={() => setWeek(today())}>
                        {t("Today")}
                      </Button>
                    )}
                    <ToolbarButton
                      label={t("Previous week")}
                      onClick={() => setWeek((value) => addDays(value, -7))}
                    >
                      <ChevronLeftIcon />
                    </ToolbarButton>
                    <ToolbarButton
                      label={t("Next week")}
                      onClick={() => setWeek((value) => addDays(value, 7))}
                    >
                      <ChevronRightIcon />
                    </ToolbarButton>
                  </div>
                </div>
                {editingTimes ? (
                  <p className="px-2 text-sm text-muted-foreground">
                    {t(
                      "Drag across a day to add a study time. It repeats every week.",
                    )}
                  </p>
                ) : null}
                <Week
                  days={days}
                  plan={plan}
                  subjects={subjects}
                  records={records}
                  compact={compact}
                  editingTimes={editingTimes && !compact}
                  onCreateSession={(range) =>
                    setSessionRequest({
                      initial: {
                        date: range.day,
                        start: range.start,
                        end: range.end,
                      },
                    })
                  }
                  onMoveSession={(session, range) =>
                    void moveSession(session, range)
                  }
                  onResolve={(ids, accept) => void resolve(ids, accept)}
                  onChangeTimes={(times) => void changeTimes(times)}
                  onEditTimes={() => setAvailabilityOpen(true)}
                  dayLabel={(day) =>
                    `${weekday(localInstant(day, "12:00"))}, ${formatDate(localInstant(day, "12:00"), { year: undefined })}`
                  }
                  onOpenSession={(session) => setSessionRequest({ session })}
                  onOpenAssessment={(assessment) =>
                    setAssessmentRequest({ assessment })
                  }
                  onOpenDeadline={(subjectId, activity) =>
                    hasPage(activity)
                      ? props.onOpenActivity(subjectId, activity)
                      : openInBrowser(activity)
                  }
                />
                {plan.availability.length === 0 && !editingTimes ? (
                  <p className="px-2 text-sm text-muted-foreground">
                    {tx(
                      "{link} so the assistant plans sessions when you are free.",
                      {
                        link: (
                          <button
                            type="button"
                            className="text-link hover:underline"
                            onClick={() =>
                              compact
                                ? setAvailabilityOpen(true)
                                : setEditingTimes(true)
                            }
                          >
                            {t("Set your study times")}
                          </button>
                        ),
                      },
                    )}
                  </p>
                ) : null}
              </section>
              <Assessments
                plan={plan}
                subjects={subjects}
                onAdd={() => setAssessmentRequest({})}
                onOpen={(assessment) => setAssessmentRequest({ assessment })}
              />
            </>
          ) : error ? null : (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-row w-40" />
              <Skeleton className="h-56 w-full" />
            </div>
          )}

          <MoodleSections {...props} records={records} />
        </div>
      </ScrollArea>
      <SessionDialog
        request={sessionRequest}
        snapshot={snapshot}
        plan={plan}
        practice={practice}
        onClose={() => setSessionRequest(null)}
        onStart={start}
      />
      <AssessmentDialog
        request={assessmentRequest}
        subjects={liveSubjects}
        onClose={() => setAssessmentRequest(null)}
      />
      <AvailabilityDialog
        open={availabilityOpen}
        availability={plan?.availability ?? []}
        onClose={() => setAvailabilityOpen(false)}
      />
    </div>
  );
}

function SubjectDot({ subject }: { subject: SubjectInfo | undefined }) {
  if (!subject) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        subjectColorClasses[subject.color].dot,
      )}
    />
  );
}

/** The assistant's suggestions and missed sessions, which wait for the student. */
function Decisions({
  plan,
  subjects,
  onEdit,
  onResolve: resolve,
}: {
  plan: PlanFile;
  subjects: ReadonlyMap<string, SubjectInfo>;
  onEdit: (session: StudySession) => void;
  onResolve: (ids: string[], accept: boolean) => void;
}) {
  const notices = useNotices();
  const { t, tc, date: formatDate } = useLocale();
  const suggested = plan.sessions
    .filter((session) => session.proposal || session.move)
    .sort((a, b) =>
      `${(a.move ?? a).date}${(a.move ?? a).start}`.localeCompare(
        `${(b.move ?? b).date}${(b.move ?? b).start}`,
      ),
    );
  const missed = plan.sessions
    .filter((session) => isOverdue(session) && !session.move)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  if (suggested.length === 0 && missed.length === 0) return null;

  const when = (slot: { date: string; start: string; end: string }) =>
    `${formatDate(localInstant(slot.date, "12:00"), { weekday: "short", year: undefined })}, ${slot.start}–${slot.end}`;

  const mark = async (id: string, status: "done" | "skipped") => {
    try {
      await api.setSessionStatus({ id, status });
    } catch (reason) {
      notices.fail(t("The session was not changed"), reason);
    }
  };

  return (
    <section aria-label={t("Needs a decision")} className="flex flex-col gap-4">
      {suggested.length > 0 ? (
        <div className="flex flex-col gap-1">
          <SectionTitle
            action={
              suggested.length > 1 ? (
                <div className="flex gap-1">
                  <Button
                    variant="subtle"
                    onClick={() =>
                      resolve(
                        suggested.map((session) => session.id),
                        false,
                      )
                    }
                  >
                    {t("Decline all")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      resolve(
                        suggested.map((session) => session.id),
                        true,
                      )
                    }
                  >
                    <CheckIcon /> {t("Accept all")}
                  </Button>
                </div>
              ) : undefined
            }
          >
            Suggested by the assistant · {suggested.length}
          </SectionTitle>
          <ul className="flex flex-col">
            {suggested.map((session) => {
              const subject = session.subjectId
                ? subjects.get(session.subjectId)
                : undefined;
              const reason = session.move?.reason ?? session.proposal?.reason;
              return (
                <li
                  key={session.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <CalendarClockIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm">
                      <SubjectDot subject={subject} />
                      <span className="truncate font-medium">
                        {session.move
                          ? `Move “${session.title}”`
                          : session.title}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {session.move
                        ? `${when(session)} → ${when(session.move)}`
                        : when(session)}
                      {reason ? ` · ${reason}` : ""}
                    </span>
                  </span>
                  <Button
                    variant="subtle"
                    onClick={() => resolve([session.id], false)}
                  >
                    <XIcon /> {t("Decline")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => resolve([session.id], true)}
                  >
                    <CheckIcon /> {t("Accept")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {missed.length > 0 ? (
        <div className="flex flex-col gap-1">
          <SectionTitle>Missed · {missed.length}</SectionTitle>
          <ul className="flex flex-col">
            {missed.map((session) => {
              const subject = session.subjectId
                ? subjects.get(session.subjectId)
                : undefined;
              return (
                <li
                  key={session.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <SubjectDot subject={subject} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {session.title}
                    </span>
                    <span className="truncate text-xs text-warning">
                      {when(session)}
                    </span>
                  </span>
                  <Button variant="subtle" onClick={() => onEdit(session)}>
                    <CalendarClockIcon /> {t("Move…")}
                  </Button>
                  <Button
                    variant="subtle"
                    onClick={() => void mark(session.id, "skipped")}
                  >
                    <SkipForwardIcon /> {t("Skip")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void mark(session.id, "done")}
                  >
                    <CheckIcon /> {tc("verb", "Done")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

interface Deadline {
  subjectId: string;
  activity: Activity;
  date: MoodleActivityDate;
}

/** The week's sessions, assessments, and Moodle deadlines, day by day. */
function Week({
  days,
  plan,
  subjects,
  records,
  compact,
  editingTimes,
  dayLabel,
  onOpenSession,
  onOpenAssessment,
  onOpenDeadline,
  onCreateSession,
  onMoveSession,
  onResolve,
  onChangeTimes,
  onEditTimes,
}: {
  days: string[];
  plan: PlanFile;
  subjects: ReadonlyMap<string, SubjectInfo>;
  records: SubjectActivities[] | null;
  compact: boolean;
  /** Drawing on the grid edits the weekly study times instead of sessions. */
  editingTimes: boolean;
  dayLabel: (day: string) => string;
  onOpenSession: (session: StudySession) => void;
  onOpenAssessment: (assessment: PlanFile["assessments"][number]) => void;
  onOpenDeadline: (subjectId: string, activity: Activity) => void;
  onCreateSession: (range: TimeRange) => void;
  onMoveSession: (session: StudySession, range: TimeRange) => void;
  onResolve: (ids: string[], accept: boolean) => void;
  onChangeTimes: (times: Availability[]) => void;
  /** The list of study times, which also works from the keyboard. */
  onEditTimes: () => void;
}) {
  const { t, time } = useLocale();
  const byDay = useMemo(() => {
    const deadlines = new Map<string, Deadline[]>();
    for (const record of records ?? []) {
      if (!subjects.has(record.subjectId)) continue;
      for (const activity of record.activities)
        for (const date of activity.dates) {
          if (!isDeadline(date)) continue;
          const at = new Date(date.at);
          const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
          deadlines.set(day, [
            ...(deadlines.get(day) ?? []),
            { subjectId: record.subjectId, activity, date },
          ]);
        }
    }
    return deadlines;
  }, [records, subjects]);

  /** Assessments and Moodle deadlines: dated, but not blocks of time. */
  const dated = (day: string) => {
    const assessments = plan.assessments.filter(
      (assessment) => assessment.date === day,
    );
    const deadlines = byDay.get(day) ?? [];
    if (assessments.length === 0 && deadlines.length === 0) return null;
    return (
      <>
        {assessments.map((assessment) => {
          const subject = assessment.subjectId
            ? subjects.get(assessment.subjectId)
            : undefined;
          return (
            <button
              key={assessment.id}
              type="button"
              onClick={() => onOpenAssessment(assessment)}
              className="flex w-full items-start gap-1 rounded-md bg-danger-soft px-2 py-1.5 text-left text-xs text-destructive hover:brightness-95 focus-visible:shadow-focus focus-visible:outline-none"
            >
              <GraduationCapIcon
                className="mt-0.5 size-3 shrink-0"
                aria-hidden
              />
              <span className="line-clamp-2 font-medium">
                {assessment.time ? `${assessment.time} ` : ""}
                {assessment.title}
                {subject ? (
                  <span className="sr-only">, {subject.name}</span>
                ) : null}
              </span>
            </button>
          );
        })}
        {deadlines.map(({ subjectId, activity, date }) => {
          const subject = subjects.get(subjectId);
          return (
            <button
              key={`${activity.moduleId}:${date.type}`}
              type="button"
              onClick={() => onOpenDeadline(subjectId, activity)}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-md border-l-[3px] px-2 py-1 text-left text-2xs hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
                subject ? subjectColorClasses[subject.color].border : "",
                isSubmitted(activity) && "opacity-60",
              )}
            >
              <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                {t(dateLabel(date))} {time(date.at)}
                {isSubmitted(activity) ? (
                  <CheckIcon
                    aria-label={t("Submitted")}
                    className="size-3 text-success"
                  />
                ) : null}
              </span>
              <span className="line-clamp-2 font-medium">{activity.name}</span>
            </button>
          );
        })}
      </>
    );
  };

  if (compact)
    return (
      <div className="flex flex-col divide-y rounded-lg border">
        {days.map((day) => {
          // A session with a suggested new time shows at both, the new one dashed.
          const sessions = [
            ...plan.sessions
              .filter((session) => session.date === day)
              .map((session) => ({
                session,
                slot: session as TimeSlot,
                pending: Boolean(session.proposal),
              })),
            ...plan.sessions.flatMap((session) =>
              session.move?.date === day
                ? [{ session, slot: session.move, pending: true }]
                : [],
            ),
          ].sort((a, b) => a.slot.start.localeCompare(b.slot.start));
          return (
            <div key={day} className="flex flex-col gap-1.5 px-3 py-2.5">
              <span
                className={cn(
                  "text-xs font-medium text-muted-foreground",
                  day === today() && "text-primary",
                )}
              >
                {dayLabel(day)}
              </span>
              <div className="flex flex-col gap-1">
                {dated(day)}
                {sessions.map(({ session, slot, pending }) => {
                  const subject = session.subjectId
                    ? subjects.get(session.subjectId)
                    : undefined;
                  return (
                    <CalendarActivityCard
                      key={`${session.id}-${slot === session ? "at" : "to"}`}
                      title={
                        pending
                          ? t("{title} (suggested)", { title: session.title })
                          : session.title
                      }
                      subjectName={subject?.name ?? t("No subject")}
                      subjectColor={subject?.color ?? "gray"}
                      kind={session.kind}
                      start={localInstant(slot.date, slot.start)}
                      end={localInstant(slot.date, slot.end)}
                      // A suggested new time is not missed, whatever the old one was.
                      status={
                        slot === session ? sessionStatus(session) : "scheduled"
                      }
                      onOpen={() => onOpenSession(session)}
                      className={cn(pending && "border-dashed opacity-75")}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );

  const inWeek = (day: string) => days.includes(day);
  const timeBlocks: TimeGridBlock[] = editingTimes
    ? plan.availability.flatMap((slot, index) => {
        const day = days[slot.weekday - 1];
        if (!day) return [];
        const remove = () =>
          onChangeTimes(plan.availability.filter((_, at) => at !== index));
        return [
          {
            id: `time:${index}`,
            day,
            start: slot.start,
            end: slot.end,
            label: t("Study time, {start} to {end}", {
              start: slot.start,
              end: slot.end,
            }),
            editable: true,
            onOpen: onEditTimes,
            className:
              "border border-success/50 bg-success-soft text-success hover:brightness-95",
            children: (
              <div className="flex items-start justify-between gap-1 px-2 py-1">
                <span className="text-2xs font-medium tabular-nums">
                  {slot.start}–{slot.end}
                </span>
                <button
                  type="button"
                  aria-label={t("Remove this study time")}
                  onClick={remove}
                  className="-mr-1 rounded-sm p-0.5 hover:bg-success/15 focus-visible:shadow-focus focus-visible:outline-none"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ),
          },
        ];
      })
    : [];

  const sessionBlocks: TimeGridBlock[] = editingTimes
    ? []
    : plan.sessions.flatMap((session) => {
        const subject = session.subjectId
          ? subjects.get(session.subjectId)
          : undefined;
        const border = subjectColorClasses[subject?.color ?? "gray"].border;
        const body = (
          slot: TimeSlot,
          title: string,
          actions: ReactNode = null,
        ) => (
          <TimeGridCard
            kind={session.kind}
            start={localInstant(slot.date, slot.start)}
            end={localInstant(slot.date, slot.end)}
            title={title}
            struck={session.status === "done" || session.status === "skipped"}
            actions={actions}
          />
        );
        const decide = (
          <>
            <button
              type="button"
              aria-label={t("Accept")}
              onClick={() => onResolve([session.id], true)}
              className="rounded-sm bg-primary p-0.5 text-primary-foreground hover:brightness-110 focus-visible:shadow-focus focus-visible:outline-none"
            >
              <CheckIcon className="size-3" />
            </button>
            <button
              type="button"
              aria-label={t("Decline")}
              onClick={() => onResolve([session.id], false)}
              className="rounded-sm p-0.5 hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
            >
              <XIcon className="size-3" />
            </button>
          </>
        );
        const blocks: TimeGridBlock[] = [];
        const status = sessionStatus(session);
        if (inWeek(session.date))
          blocks.push({
            id: session.id,
            day: session.date,
            start: session.start,
            end: session.end,
            label: t("{title}, {subject}, {start} to {end}", {
              title: session.title,
              subject: subject?.name ?? t("No subject"),
              start: session.start,
              end: session.end,
            }),
            editable: !session.proposal && session.status === "planned",
            onOpen: () => onOpenSession(session),
            className: cn(
              "border-l-[3px] shadow-control",
              border,
              session.proposal
                ? "border border-dashed bg-background/90"
                : "bg-control hover:bg-control-hover",
              status === "completed" && "opacity-60",
              status === "overdue" && "bg-warning-soft",
              status === "skipped" && "border-dashed opacity-70",
            ),
            children: body(
              session,
              session.proposal
                ? t("{title} (suggested)", { title: session.title })
                : session.title,
              session.proposal ? decide : null,
            ),
          });
        if (session.move && inWeek(session.move.date))
          blocks.push({
            id: `${session.id}:move`,
            day: session.move.date,
            start: session.move.start,
            end: session.move.end,
            label: t("New time suggested for {title}", {
              title: session.title,
            }),
            onOpen: () => onOpenSession(session),
            className: cn(
              "border border-l-[3px] border-dashed bg-background/90 shadow-control",
              border,
            ),
            children: body(
              session.move,
              t("{title} (suggested)", { title: session.title }),
              decide,
            ),
          });
        return blocks;
      });

  const blocks = [...timeBlocks, ...sessionBlocks];
  const bands = editingTimes
    ? []
    : plan.availability.flatMap((slot) => {
        const day = days[slot.weekday - 1];
        return day ? [{ day, start: slot.start, end: slot.end }] : [];
      });
  // Early and late sessions widen the hours shown.
  const hours = [...blocks, ...bands].flatMap((range) => [
    minutesOf(range.start) / 60,
    minutesOf(range.end) / 60,
  ]);
  const fromHour = Math.floor(Math.min(8, ...hours));
  const toHour = Math.ceil(Math.max(22, ...hours));
  const hasDated = days.some((day) => dated(day) !== null);

  return (
    <TimeGrid
      days={days}
      today={today()}
      fromHour={fromHour}
      toHour={toHour}
      bands={bands}
      blocks={blocks}
      allDay={hasDated ? dated : undefined}
      createLabel={editingTimes ? t("Study time") : t("New session")}
      onCreate={(range) => {
        if (!editingTimes) {
          onCreateSession(range);
          return;
        }
        onChangeTimes([
          ...plan.availability,
          {
            weekday: isoWeekday(range.day),
            start: range.start,
            end: range.end,
          },
        ]);
      }}
      onChange={(id, range) => {
        if (id.startsWith("time:")) {
          const index = Number(id.slice("time:".length));
          onChangeTimes(
            plan.availability.map((slot, at) =>
              at === index
                ? {
                    weekday: isoWeekday(range.day),
                    start: range.start,
                    end: range.end,
                  }
                : slot,
            ),
          );
          return;
        }
        const session = plan.sessions.find((entry) => entry.id === id);
        if (session) onMoveSession(session, range);
      }}
    />
  );
}

function Assessments({
  plan,
  subjects,
  onAdd,
  onOpen,
}: {
  plan: PlanFile;
  subjects: ReadonlyMap<string, SubjectInfo>;
  onAdd: () => void;
  onOpen: (assessment: PlanFile["assessments"][number]) => void;
}) {
  const { t } = useLocale();
  const now = new Date();
  const upcoming = plan.assessments
    .filter(
      (assessment) =>
        localInstant(assessment.date, "23:59").getTime() >= now.getTime(),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section aria-label={t("Assessments")} className="flex flex-col gap-2">
      <SectionTitle
        action={
          <Button variant="subtle" onClick={onAdd}>
            <PlusIcon /> {t("Add")}
          </Button>
        }
      >
        {t("Assessments")}
      </SectionTitle>
      {upcoming.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">
          {t("No exams or tests coming up.")}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {upcoming.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              title={assessment.title}
              subjectName={
                assessment.subjectId
                  ? (subjects.get(assessment.subjectId)?.name ?? "")
                  : ""
              }
              date={localInstant(assessment.date, assessment.time ?? "12:00")}
              now={now}
              onOpen={() => onOpen(assessment)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface Entry {
  subject: SubjectInfo;
  activity: Activity;
  date: MoodleActivityDate;
}

/** Dates from Moodle across every followed subject, soonest first. */
function MoodleSections({
  snapshot,
  moodle,
  active,
  onOpenActivity,
  onOpenCourse,
  onOpenSettings,
  records,
}: ScheduleViewProps & { records: SubjectActivities[] | null }) {
  const { t, relative, time, weekday, date, number } = useLocale();
  const [checking, setChecking] = useState(false);
  const [failures, setFailures] = useState<
    { subjectId: string; message: string }[]
  >([]);
  const lastCheck = useRef(0);

  const connected = moodle.status === "connected";
  const followed = useMemo(
    () => snapshot.subjects.filter((subject) => subject.moodle),
    [snapshot.subjects],
  );
  const bySubject = useMemo(
    () => new Map((records ?? []).map((record) => [record.subjectId, record])),
    [records],
  );
  // The least recent check; none while a followed subject was never checked.
  const checkedAt = followed.map(
    (subject) => bySubject.get(subject.id)?.checkedAt,
  );
  const oldest = checkedAt.every((at): at is string => at !== undefined)
    ? Math.min(...checkedAt.map((at) => Date.parse(at)))
    : null;
  const needsCheck =
    followed.length > 0 &&
    (oldest === null || Date.now() - oldest > RECHECK_MS);

  const check = useCallback(async () => {
    lastCheck.current = Date.now();
    setChecking(true);
    try {
      setFailures(await api.refreshMoodleActivities());
    } catch (error) {
      setFailures([{ subjectId: "", message: errorMessage(error) }]);
    } finally {
      setChecking(false);
    }
  }, []);

  // Opening the schedule checks Moodle when what it shows is old, once.
  useEffect(() => {
    if (!active || !connected || records === null || !needsCheck) return;
    if (Date.now() - lastCheck.current < RECHECK_MS) return;
    void check();
  }, [active, connected, records, needsCheck, check]);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entries: Entry[] = [];
    for (const subject of followed) {
      for (const activity of bySubject.get(subject.id)?.activities ?? [])
        for (const entry of activity.dates)
          if (Date.parse(entry.at) >= today.getTime())
            entries.push({ subject, activity, date: entry });
    }
    entries.sort((a, b) => Date.parse(a.date.at) - Date.parse(b.date.at));
    const days = new Map<string, { day: Date; entries: Entry[] }>();
    for (const entry of entries) {
      const at = new Date(entry.date.at);
      const group = days.get(dayKey(at));
      if (group) group.entries.push(entry);
      else days.set(dayKey(at), { day: at, entries: [entry] });
    }
    return [...days.values()];
  }, [followed, bySubject]);

  if (followed.length === 0) return null;

  // What teachers posted in the last two weeks, newest first.
  const since = Date.now() - 14 * 86_400_000;
  const recent = followed
    .flatMap((subject) =>
      (bySubject.get(subject.id)?.announcements ?? [])
        .filter((post) => Date.parse(post.postedAt) >= since)
        .map((post) => ({ subject, post })),
    )
    .sort((a, b) => b.post.postedAt.localeCompare(a.post.postedAt))
    .slice(0, 5);

  const dayTitle = (day: Date) => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (dayKey(day) === dayKey(today)) return t("Today");
    if (dayKey(day) === dayKey(tomorrow)) return t("Tomorrow");
    return t("{weekday}, {date}", {
      weekday: weekday(day),
      date: date(day, { year: undefined }),
    });
  };

  const failedNames = failures
    .map(
      (failure) =>
        snapshot.subjects.find((subject) => subject.id === failure.subjectId)
          ?.name,
    )
    .filter(Boolean);

  return (
    <section aria-label={t("Moodle")} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-8">
        <div className="flex flex-col gap-0.5 px-2">
          <h2 className="text-base font-semibold">{t("From Moodle")}</h2>
          <p
            className={cn(
              "text-sm text-muted-foreground",
              oldest !== null &&
                Date.now() - oldest > STALE_MS &&
                "text-warning",
            )}
            aria-live="polite"
          >
            {checking
              ? t("Checking Moodle…")
              : oldest === null
                ? records === null
                  ? ""
                  : t("Not checked yet")
                : checkedLabel(oldest, { t, relative })}
          </p>
        </div>
        {connected ? (
          <ToolbarButton
            label={t("Check Moodle again")}
            disabled={checking}
            onClick={() => void check()}
          >
            <RefreshCwIcon className={cn(checking && "animate-spin")} />
          </ToolbarButton>
        ) : (
          <Button variant="secondary" onClick={onOpenSettings}>
            {t("Connect Moodle")}
          </Button>
        )}
      </div>

      {failures.length > 0 ? (
        <InlineMessage tone="warning">
          <p>
            {failedNames.length > 0
              ? `${t("{names} could not be checked.", {
                  names: failedNames.join(", "),
                })} `
              : ""}
            {failures[0]?.message}
          </p>
        </InlineMessage>
      ) : null}

      {records === null || (checking && oldest === null) ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-row w-40" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <section aria-label={t("Upcoming")} className="flex flex-col gap-6">
          {upcoming.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              {t("Nothing coming up in the courses you follow.")}
            </p>
          ) : null}
          {upcoming.map(({ day, entries }) => (
            <div key={dayKey(day)} className="flex flex-col gap-1">
              <SectionTitle>{dayTitle(day)}</SectionTitle>
              <ul className="flex flex-col">
                {entries.map((entry) => (
                  <UpcomingRow
                    key={`${entry.activity.moduleId}:${entry.date.type}:${entry.date.at}`}
                    entry={entry}
                    time={time(entry.date.at)}
                    onOpen={
                      hasPage(entry.activity)
                        ? () => onOpenActivity(entry.subject.id, entry.activity)
                        : undefined
                    }
                    onOpenInMoodle={() => openInBrowser(entry.activity)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {recent.length > 0 ? (
        <section
          aria-label={t("Announcements")}
          className="flex flex-col gap-1"
        >
          <SectionTitle>{t("Announcements")}</SectionTitle>
          <ul className="flex flex-col">
            {recent.map(({ subject, post }) => (
              <li key={`${subject.id}:${post.id}`} className="flex">
                <RowBody onOpen={() => onOpenCourse(subject.id)}>
                  <SubjectDot subject={subject} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className="truncate text-sm font-medium"
                      title={post.subject}
                    >
                      {post.subject}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {subject.name} · {post.author}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relative(post.postedAt)}
                  </span>
                </RowBody>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {records && records.length > 0 ? (
        <section aria-label={t("Courses")} className="flex flex-col gap-1">
          <SectionTitle>{t("Courses")}</SectionTitle>
          <ul className="flex flex-col">
            {followed.map((subject) => {
              const record = bySubject.get(subject.id);
              if (!record) return null;
              const count = record.activities.filter(
                (activity) => !isLabel(activity),
              ).length;
              const waiting = waitingFiles(record).length;
              return (
                <li key={subject.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCourse(subject.id)}
                    className="flex h-control w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
                  >
                    <SubjectDot subject={subject} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {subject.name}
                    </span>
                    {waiting > 0 ? (
                      <span className="shrink-0 text-xs font-medium text-primary tabular-nums">
                        {waiting === 1
                          ? t("1 new file")
                          : t("{count} new files", { count: number(waiting) })}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {count === 1
                        ? t("1 activity")
                        : t("{count} activities", { count: number(count) })}
                    </span>
                    <ChevronRightIcon
                      aria-hidden
                      className="size-4 shrink-0 text-subtle-foreground"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

/** The row's main area opens the activity's page, when it has one. */
function RowBody({
  onOpen,
  children,
}: {
  onOpen: (() => void) | undefined;
  children: ReactNode;
}) {
  const className =
    "flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left";
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        className,
        "hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

function UpcomingRow({
  entry,
  time,
  onOpen,
  onOpenInMoodle,
}: {
  entry: Entry;
  time: string;
  onOpen: (() => void) | undefined;
  onOpenInMoodle: () => void;
}) {
  const { t } = useLocale();
  const { subject, activity, date } = entry;
  const passed = Date.parse(date.at) < Date.now();
  const deadline = isDeadline(date);
  const status = deadline ? submissionLabel(activity) : null;
  return (
    <li
      className={cn(
        "flex items-center gap-1",
        (passed || isSubmitted(activity)) && "opacity-60",
      )}
    >
      <RowBody onOpen={onOpen}>
        <span className="w-12 shrink-0 text-sm tabular-nums text-muted-foreground">
          {time}
        </span>
        <SubjectDot subject={subject} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium" title={activity.name}>
            {activity.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {subject.name} · {t(activityType(activity.modname))}
          </span>
        </span>
        {status ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 text-xs",
              isSubmitted(activity) ? "text-success" : "text-warning",
            )}
          >
            {isSubmitted(activity) ? (
              <CheckIcon aria-hidden className="size-3.5" />
            ) : null}
            {t(status)}
          </span>
        ) : null}
        <span
          className={cn(
            "shrink-0 text-xs",
            deadline && !passed && !isSubmitted(activity)
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          {t(dateLabel(date))}
        </span>
      </RowBody>
      <ToolbarButton label={t("Open in Moodle")} onClick={onOpenInMoodle}>
        <ExternalLinkIcon />
      </ToolbarButton>
    </li>
  );
}
