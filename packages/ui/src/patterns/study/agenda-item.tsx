import {
  BookOpenIcon,
  CalendarClockIcon,
  CheckIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  LayersIcon,
  PauseIcon,
  PencilLineIcon,
  PlayIcon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
import { Progress } from "@resit/ui/components/progress";
import { useLocale } from "@resit/ui/hooks/use-locale";
import {
  subjectColorClasses,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

export type AgendaStatus =
  "scheduled" | "in-progress" | "completed" | "overdue" | "suspended";
export type ActivityKind =
  "reading" | "exercises" | "quiz" | "flashcards" | "assessment";

export const activityIcons: Record<ActivityKind, typeof BookOpenIcon> = {
  reading: BookOpenIcon,
  exercises: PencilLineIcon,
  quiz: ClipboardListIcon,
  flashcards: LayersIcon,
  assessment: GraduationCapIcon,
};

const statusMeta: Record<AgendaStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "text-muted-foreground" },
  "in-progress": { label: "In progress", className: "text-link" },
  completed: { label: "Done", className: "text-success" },
  overdue: { label: "Overdue", className: "text-warning" },
  suspended: { label: "Suspended", className: "text-subtle-foreground" },
};

export interface AgendaItemProps {
  id: string;
  title: string;
  subjectName: string;
  subjectColor: SubjectColor;
  kind: ActivityKind;
  start: string | Date;
  end: string | Date;
  status: AgendaStatus;
  resourceTitle?: string | undefined;
  progress?: { done: number; total: number } | undefined;
  onStart?: (id: string) => void;
  onContinue?: (id: string) => void;
  onComplete?: (id: string) => void;
  onReschedule?: (id: string) => void;
  onResume?: (id: string) => void;
  className?: string;
}

/** One planned study activity. Overdue items offer a new time; nothing moves on its own. */
export function AgendaItem({
  id,
  title,
  subjectName,
  subjectColor,
  kind,
  start,
  end,
  status,
  resourceTitle,
  progress,
  onStart,
  onContinue,
  onComplete,
  onReschedule,
  onResume,
  className,
}: AgendaItemProps) {
  const { time } = useLocale();
  const Icon = activityIcons[kind];
  const colors = subjectColorClasses[subjectColor];
  const meta = statusMeta[status];
  return (
    <div
      data-slot="agenda-item"
      data-status={status}
      className={cn(
        "flex gap-3 rounded-lg border bg-background p-3",
        status === "completed" && "opacity-75",
        status === "overdue" && "border-warning/40",
        status === "suspended" && "border-dashed",
        className,
      )}
    >
      <div className="flex w-14 shrink-0 flex-col text-xs tabular-nums text-muted-foreground">
        <span className="font-medium text-foreground">{time(start)}</span>
        <span>{time(end)}</span>
      </div>
      <span
        className={cn("w-0.5 shrink-0 self-stretch rounded-full", colors.dot)}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <Icon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-sm font-medium",
                status === "completed" &&
                  "line-through decoration-muted-foreground",
              )}
            >
              {title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {subjectName}
              {resourceTitle ? ` · ${resourceTitle}` : ""}
            </p>
          </div>
          <span className={cn("shrink-0 text-xs font-medium", meta.className)}>
            {meta.label}
          </span>
        </div>
        {progress ? (
          <div className="flex items-center gap-2">
            <Progress
              value={(progress.done / progress.total) * 100}
              className="h-1"
              tone={status === "completed" ? "success" : "default"}
              aria-label="Progress"
            />
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
              {progress.done}/{progress.total}
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {status === "scheduled" && onStart ? (
            <Button size="sm" onClick={() => onStart(id)}>
              <PlayIcon /> Start
            </Button>
          ) : null}
          {status === "in-progress" ? (
            <>
              {onContinue ? (
                <Button size="sm" onClick={() => onContinue(id)}>
                  Continue
                </Button>
              ) : null}
              {onComplete ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onComplete(id)}
                >
                  <CheckIcon /> Mark done
                </Button>
              ) : null}
            </>
          ) : null}
          {status === "overdue" ? (
            <>
              {onReschedule ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onReschedule(id)}
                >
                  <CalendarClockIcon /> Propose new time
                </Button>
              ) : null}
              {onComplete ? (
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => onComplete(id)}
                >
                  <CheckIcon /> Already done
                </Button>
              ) : null}
            </>
          ) : null}
          {status === "suspended" && onResume ? (
            <Button size="sm" variant="outline" onClick={() => onResume(id)}>
              <PlayIcon /> Resume
            </Button>
          ) : null}
          {status === "suspended" ? (
            <span className="flex items-center gap-1 text-xs text-subtle-foreground">
              <PauseIcon className="size-3.5" /> Not scheduled
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
