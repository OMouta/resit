import {
  CalendarIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { InlineMessage } from "@resit/ui/components/inline-message";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";

import type {
  MoodleActivityDate,
  MoodleConnection,
  SubjectActivities,
} from "../../../shared/moodle";
import type { SubjectInfo, WorkspaceSnapshot } from "../../../shared/workspace";
import { api, errorMessage } from "../lib/api";
import {
  activityType,
  checkedLabel,
  dateLabel,
  isDeadline,
  useMoodleActivities,
} from "../lib/moodle-activities";

type Activity = SubjectActivities["activities"][number];

/** Older than this, opening the schedule checks Moodle again. */
const RECHECK_MS = 10 * 60_000;
/** Older than this, the check time is shown as a warning. */
const STALE_MS = 2 * 24 * 60 * 60_000;

interface Entry {
  subject: SubjectInfo;
  activity: Activity;
  date: MoodleActivityDate;
}

function dayKey(value: Date): string {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

/** Dates from Moodle across every followed subject, soonest first. */
export function ScheduleView({
  snapshot,
  moodle,
  active,
  onOpenSettings,
}: {
  snapshot: WorkspaceSnapshot;
  moodle: MoodleConnection;
  /** The tab is on top, so a stale schedule is worth checking. */
  active: boolean;
  onOpenSettings: () => void;
}) {
  const { relative, time, weekday, date, number } = useLocale();
  const records = useMoodleActivities();
  const [checking, setChecking] = useState(false);
  const [failures, setFailures] = useState<
    { subjectId: string; message: string }[]
  >([]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
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

  const dayTitle = (day: Date) => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (dayKey(day) === dayKey(today)) return "Today";
    if (dayKey(day) === dayKey(tomorrow)) return "Tomorrow";
    return `${weekday(day)}, ${date(day, { year: undefined })}`;
  };

  const openInMoodle = (activity: Activity) =>
    void api.openExternal(activity.url).catch(() => undefined);

  if (followed.length === 0)
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <EmptyState
          icon={<CalendarIcon />}
          title="No subject follows a Moodle course"
          description="Follow one from a subject's Moodle menu and its deadlines appear here."
        />
      </div>
    );

  const failedNames = failures
    .map(
      (failure) =>
        snapshot.subjects.find((subject) => subject.id === failure.subjectId)
          ?.name,
    )
    .filter(Boolean);

  return (
    <ScrollArea className="h-full bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pt-12 pb-24">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-[-0.025em]">Schedule</h1>
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
                ? "Checking Moodle…"
                : oldest === null
                  ? records === null
                    ? ""
                    : "Not checked yet"
                  : checkedLabel(oldest, relative)}
            </p>
          </div>
          {connected ? (
            <ToolbarButton
              label="Check Moodle again"
              disabled={checking}
              onClick={() => void check()}
            >
              <RefreshCwIcon className={cn(checking && "animate-spin")} />
            </ToolbarButton>
          ) : (
            <Button variant="secondary" onClick={onOpenSettings}>
              Connect Moodle
            </Button>
          )}
        </header>

        {failures.length > 0 ? (
          <InlineMessage tone="warning">
            <p>
              {failedNames.length > 0
                ? `${failedNames.join(", ")} could not be checked. `
                : ""}
              {failures[0]?.message}
            </p>
          </InlineMessage>
        ) : null}

        {records === null || (checking && oldest === null) ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-row w-40" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <section aria-label="Upcoming" className="flex flex-col gap-6">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing coming up in the courses you follow.
              </p>
            ) : null}
            {upcoming.map(({ day, entries }) => (
              <div key={dayKey(day)} className="flex flex-col gap-1">
                <h2 className="px-2 text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                  {dayTitle(day)}
                </h2>
                <ul className="flex flex-col">
                  {entries.map((entry) => (
                    <UpcomingRow
                      key={`${entry.activity.moduleId}:${entry.date.type}:${entry.date.at}`}
                      entry={entry}
                      time={time(entry.date.at)}
                      onOpenInMoodle={() => openInMoodle(entry.activity)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {records && records.length > 0 ? (
          <section aria-label="Activities" className="flex flex-col gap-1">
            <h2 className="px-2 text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              Activities
            </h2>
            {followed.map((subject) => {
              const record = bySubject.get(subject.id);
              if (!record) return null;
              const open = expanded.has(subject.id);
              return (
                <div key={subject.id} className="flex flex-col">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (open) next.delete(subject.id);
                        else next.add(subject.id);
                        return next;
                      })
                    }
                    className="flex h-control items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
                  >
                    <ChevronRightIcon
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 text-subtle-foreground transition-transform duration-(--duration-fast)",
                        open && "rotate-90",
                      )}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        subjectColorClasses[subject.color].dot,
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {subject.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {number(record.activities.length)}
                    </span>
                  </button>
                  {open ? (
                    <ul className="flex flex-col pl-6">
                      {record.activities.length === 0 ? (
                        <li className="flex h-control items-center px-2 text-sm text-muted-foreground">
                          The course has no activities.
                        </li>
                      ) : null}
                      {record.activities.map((activity) => (
                        <ActivityRow
                          key={activity.moduleId}
                          activity={activity}
                          onOpenInMoodle={() => openInMoodle(activity)}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}

function UpcomingRow({
  entry,
  time,
  onOpenInMoodle,
}: {
  entry: Entry;
  time: string;
  onOpenInMoodle: () => void;
}) {
  const { subject, activity, date } = entry;
  const passed = Date.parse(date.at) < Date.now();
  const deadline = isDeadline(date);
  return (
    <li className={cn("flex items-center gap-1", passed && "opacity-60")}>
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2">
        <span className="w-12 shrink-0 text-sm tabular-nums text-muted-foreground">
          {time}
        </span>
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            subjectColorClasses[subject.color].dot,
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium" title={activity.name}>
            {activity.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {subject.name} · {activityType(activity.modname)}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-xs",
            deadline && !passed
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          {dateLabel(date)}
        </span>
      </div>
      <ToolbarButton label="Open in Moodle" onClick={onOpenInMoodle}>
        <ExternalLinkIcon />
      </ToolbarButton>
    </li>
  );
}

function ActivityRow({
  activity,
  onOpenInMoodle,
}: {
  activity: Activity;
  onOpenInMoodle: () => void;
}) {
  const { dateTime } = useLocale();
  const next = activity.dates.find(
    (entry) => Date.parse(entry.at) >= Date.now(),
  );
  return (
    <li className="flex items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm" title={activity.name}>
            {activity.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[
              activityType(activity.modname),
              activity.sectionName,
              next ? `${dateLabel(next)} ${dateTime(next.at)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </div>
      <ToolbarButton label="Open in Moodle" onClick={onOpenInMoodle}>
        <ExternalLinkIcon />
      </ToolbarButton>
    </li>
  );
}
