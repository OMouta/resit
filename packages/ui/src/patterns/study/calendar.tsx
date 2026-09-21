import { GraduationCapIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useLocale } from "@resit/ui/hooks/use-locale";
import {
  subjectColorClasses,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import {
  activityIcons,
  type ActivityKind,
  type AgendaStatus,
} from "@resit/ui/patterns/study/agenda-item";

export interface CalendarActivityCardProps {
  title: string;
  subjectName: string;
  subjectColor: SubjectColor;
  kind: ActivityKind;
  start: string | Date;
  end: string | Date;
  status: AgendaStatus;
  onOpen?: () => void;
  className?: string;
}

/** Compact card for a calendar cell. Colour stripe plus subject name in the tooltip and label. */
export function CalendarActivityCard({
  title,
  subjectName,
  subjectColor,
  kind,
  start,
  end,
  status,
  onOpen,
  className,
}: CalendarActivityCardProps) {
  const { time } = useLocale();
  const Icon = activityIcons[kind];
  const colors = subjectColorClasses[subjectColor];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${title}, ${subjectName}, ${time(start)} to ${time(end)}, ${status}`}
          className={cn(
            "flex w-full flex-col gap-0.5 rounded-md border-l-[3px] bg-control px-2 py-1.5 text-left text-xs shadow-control hover:bg-control-hover focus-visible:shadow-focus focus-visible:outline-none",
            colors.border,
            status === "completed" && "opacity-60",
            status === "overdue" && "bg-warning-soft",
            (status === "suspended" || status === "skipped") &&
              "border-dashed opacity-70",
            className,
          )}
        >
          <span className="flex items-center gap-1 text-2xs tabular-nums text-muted-foreground">
            <Icon className="size-3" aria-hidden />
            {time(start)}–{time(end)}
          </span>
          <span
            className={cn(
              "line-clamp-2 font-medium",
              (status === "completed" || status === "skipped") &&
                "line-through",
            )}
          >
            {title}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {subjectName} · {status}
      </TooltipContent>
    </Tooltip>
  );
}

export function AssessmentCard({
  title,
  subjectName,
  date,
  now,
  onOpen,
  className,
}: {
  title: string;
  subjectName: string;
  date: string | Date;
  now?: Date | undefined;
  onOpen?: () => void;
  className?: string;
}) {
  const { date: formatDate } = useLocale();
  const target = new Date(date);
  const base = now ?? new Date();
  const days = Math.ceil((target.getTime() - base.getTime()) / 86_400_000);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left shadow-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-danger-soft text-destructive">
        <GraduationCapIcon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">
          {subjectName} · {formatDate(target)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-lg font-semibold tabular-nums">{days}</span>
        <span className="block text-2xs text-muted-foreground">days</span>
      </span>
    </button>
  );
}

export interface WeekGridProps {
  /** ISO dates, Monday to Sunday. */
  days: string[];
  today?: string | undefined;
  availability?: { day: string; from: string; to: string }[];
  /** Cards per day, already positioned by the caller. */
  children: (day: string) => ReactNode;
  className?: string;
}

/** Seven columns with day headers and availability blocks; no time math inside. */
export function WeekGrid({
  days,
  today,
  availability = [],
  children,
  className,
}: WeekGridProps) {
  const { weekday, date } = useLocale();
  return (
    <div
      data-slot="week-grid"
      className={cn(
        "grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border @container",
        className,
      )}
    >
      {days.map((day) => {
        const slots = availability.filter((slot) => slot.day === day);
        const isToday = day === today;
        return (
          <div
            key={day}
            className={cn(
              "flex min-h-56 min-w-0 flex-col bg-background",
              isToday && "bg-info-soft/30",
            )}
          >
            <header
              className={cn(
                "flex flex-col border-b px-2 py-1.5",
                isToday && "border-b-primary",
              )}
            >
              <span className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                {weekday(`${day}T12:00:00Z`).slice(0, 3)}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  isToday && "text-primary",
                )}
              >
                {date(`${day}T12:00:00Z`, {
                  day: "numeric",
                  month: undefined,
                  year: undefined,
                })}
              </span>
            </header>
            <div className="flex flex-col gap-1 p-1.5">
              {slots.map((slot) => (
                <div
                  key={`${slot.from}-${slot.to}`}
                  className="rounded-sm border border-dashed border-success/40 bg-success-soft/50 px-1.5 py-0.5 text-2xs tabular-nums text-success"
                >
                  {slot.from}–{slot.to}
                </div>
              ))}
              {children(day)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
