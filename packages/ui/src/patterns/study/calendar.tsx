import { GraduationCapIcon } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

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
  agendaStatusLabel,
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
  const { time, t } = useLocale();
  const Icon = activityIcons[kind];
  const colors = subjectColorClasses[subjectColor];
  const statusLabel = t(agendaStatusLabel(status));
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("{title}, {subject}, {start} to {end}, {status}", {
            title,
            subject: subjectName,
            start: time(start),
            end: time(end),
            status: statusLabel,
          })}
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
        {subjectName} · {statusLabel}
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
  const { date: formatDate, t } = useLocale();
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
        <span className="block text-2xs text-muted-foreground">
          {days === 1 ? t("day") : t("days")}
        </span>
      </span>
    </button>
  );
}

/** A day and a stretch of time on it, as `HH:MM` wall-clock times. */
export interface TimeRange {
  day: string;
  start: string;
  end: string;
}

export interface TimeGridBlock extends TimeRange {
  id: string;
  /** Accessible name: what it is, and when. */
  label: string;
  /** Dragging moves it to another time or day; its lower edge sets the end. */
  editable?: boolean;
  onOpen?: () => void;
  children: ReactNode;
  className?: string;
}

export interface TimeGridProps {
  /** ISO dates, Monday to Sunday. */
  days: string[];
  today?: string | undefined;
  /** The hours shown, from the start of `fromHour` to the start of `toHour`. */
  fromHour: number;
  toHour: number;
  /** Stretches drawn behind the blocks, such as weekly study times. */
  bands?: TimeRange[];
  blocks: TimeGridBlock[];
  /** What has a day but no time, such as deadlines, above the hours. */
  allDay?: ((day: string) => ReactNode) | undefined;
  /** A stretch drawn on empty time. A click without dragging gives an hour. */
  onCreate?: ((range: TimeRange) => void) | undefined;
  /** An editable block was moved, or its end dragged. */
  onChange?: ((id: string, range: TimeRange) => void) | undefined;
  /** What a stretch being drawn will become, such as "New session". */
  createLabel?: string | undefined;
  className?: string;
}

const HOUR_PX = 44;
/** Times snap to quarter hours. */
const SNAP = 15;
const LAST_MINUTE = 23 * 60 + 59;
/** Pointer travel, in pixels, that turns a press into a drag. */
const DRAG_PX = 4;

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function clock(value: number): string {
  const minutes = Math.min(Math.max(Math.round(value), 0), LAST_MINUTE);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Side-by-side lanes for blocks on one day that share time: each block's
 * lane, and how many lanes its group of overlapping blocks needs.
 */
function lanes(
  ranges: { start: number; end: number }[],
): { lane: number; count: number }[] {
  const result = ranges.map(() => ({ lane: 0, count: 1 }));
  const order = ranges
    .map((range, index) => ({ ...range, index }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let group: number[] = [];
  let ends: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const index of group) result[index]!.count = ends.length;
  };
  for (const item of order) {
    if (item.start >= groupEnd) {
      close();
      group = [];
      ends = [];
    }
    let lane = ends.findIndex((end) => end <= item.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = item.end;
    result[item.index]!.lane = lane;
    group.push(item.index);
    groupEnd = Math.max(groupEnd, item.end);
  }
  close();
  return result;
}

type Drag =
  | { kind: "create"; day: string; anchor: number; at: number; moved: boolean }
  | {
      kind: "move";
      id: string;
      day: string;
      start: number;
      length: number;
      grab: number;
      x: number;
      y: number;
      moved: boolean;
    }
  | {
      kind: "resize";
      id: string;
      day: string;
      start: number;
      end: number;
      y: number;
      moved: boolean;
    };

/**
 * A week of days with the hours down the side. Blocks sit at their times;
 * drawing on empty time creates, dragging a block moves it, and dragging
 * its lower edge changes its end. Every change also has a keyboard path in
 * the caller, through `onOpen`.
 */
export function TimeGrid({
  days,
  today,
  fromHour,
  toHour,
  bands = [],
  blocks,
  allDay,
  onCreate,
  onChange,
  createLabel,
  className,
}: TimeGridProps) {
  const { weekday, date, time } = useLocale();
  const bodyRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [now, setNow] = useState(() => new Date());

  const first = fromHour * 60;
  const last = Math.min(toHour * 60, 24 * 60);
  const height = ((last - first) / 60) * HOUR_PX;
  const top = (minutes: number) => ((minutes - first) / 60) * HOUR_PX;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!drag) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrag(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [drag]);

  /** The quarter hour under the pointer. */
  const minuteAt = (clientY: number, round: "floor" | "nearest") => {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return first;
    const raw = first + ((clientY - rect.top) / HOUR_PX) * 60;
    const snapped =
      round === "floor"
        ? Math.floor(raw / SNAP) * SNAP
        : Math.round(raw / SNAP) * SNAP;
    return Math.min(Math.max(snapped, first), last);
  };

  const dayAt = (clientX: number, fallback: string) => {
    let nearest = fallback;
    let distance = Infinity;
    for (const [day, column] of columnRefs.current) {
      const rect = column.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return day;
      const gap = Math.min(
        Math.abs(clientX - rect.left),
        Math.abs(clientX - rect.right),
      );
      if (gap < distance) {
        distance = gap;
        nearest = day;
      }
    }
    return nearest;
  };

  const startCreate = (event: PointerEvent<HTMLDivElement>, day: string) => {
    if (!onCreate || event.button !== 0) return;
    const anchor = minuteAt(event.clientY, "floor");
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ kind: "create", day, anchor, at: anchor, moved: false });
  };

  const startBlock = (
    event: PointerEvent<HTMLDivElement>,
    block: TimeGridBlock,
  ) => {
    // A press on a block never draws a new one behind it.
    event.stopPropagation();
    if (event.button !== 0 || !block.editable || !onChange) return;
    // Buttons inside a block act on their own.
    if ((event.target as Element).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = minutesOf(block.start);
    const end = minutesOf(block.end);
    if ((event.target as Element).closest("[data-resize]"))
      setDrag({
        kind: "resize",
        id: block.id,
        day: block.day,
        start,
        end,
        y: event.clientY,
        moved: false,
      });
    else
      setDrag({
        kind: "move",
        id: block.id,
        day: block.day,
        start,
        length: end - start,
        grab: minuteAt(event.clientY, "nearest") - start,
        x: event.clientX,
        y: event.clientY,
        moved: false,
      });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (drag.kind === "create") {
      const at = minuteAt(event.clientY, "nearest");
      setDrag({ ...drag, at, moved: drag.moved || at !== drag.anchor });
    } else if (drag.kind === "move") {
      const moved =
        drag.moved ||
        Math.abs(event.clientX - drag.x) > DRAG_PX ||
        Math.abs(event.clientY - drag.y) > DRAG_PX;
      if (!moved) return;
      const start = Math.min(
        Math.max(minuteAt(event.clientY, "nearest") - drag.grab, first),
        last - drag.length,
      );
      setDrag({
        ...drag,
        start: Math.round(start / SNAP) * SNAP,
        day: dayAt(event.clientX, drag.day),
        moved,
      });
    } else {
      const moved = drag.moved || Math.abs(event.clientY - drag.y) > DRAG_PX;
      if (!moved) return;
      const end = Math.max(
        minuteAt(event.clientY, "nearest"),
        drag.start + SNAP,
      );
      setDrag({ ...drag, end, moved });
    }
  };

  const onPointerUp = () => {
    if (!drag) return;
    setDrag(null);
    if (drag.kind === "create") {
      const low = Math.min(drag.anchor, drag.at);
      const high = Math.max(drag.anchor, drag.at);
      const end = drag.moved && high - low >= SNAP ? high : low + 60;
      onCreate?.({
        day: drag.day,
        start: clock(low),
        end: clock(Math.min(end, last)),
      });
      return;
    }
    const block = blocks.find((entry) => entry.id === drag.id);
    if (!block) return;
    if (!drag.moved) {
      block.onOpen?.();
      return;
    }
    if (drag.kind === "move")
      onChange?.(block.id, {
        day: drag.day,
        start: clock(drag.start),
        end: clock(drag.start + drag.length),
      });
    else
      onChange?.(block.id, {
        day: block.day,
        start: block.start,
        end: clock(drag.end),
      });
  };

  /** Where each block is drawn now, following a drag in progress. */
  const placed = blocks.map((block) => {
    if (drag && drag.kind !== "create" && drag.id === block.id && drag.moved) {
      if (drag.kind === "move")
        return {
          block,
          day: drag.day,
          start: drag.start,
          end: drag.start + drag.length,
          dragging: true,
        };
      return {
        block,
        day: block.day,
        start: drag.start,
        end: drag.end,
        dragging: true,
      };
    }
    return {
      block,
      day: block.day,
      start: minutesOf(block.start),
      end: minutesOf(block.end),
      dragging: false,
    };
  });

  const hours = Array.from(
    { length: (last - first) / 60 },
    (_, index) => fromHour + index,
  );
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const allDayCells = allDay ? days.map((day) => allDay(day)) : null;
  const columns = "grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]";

  return (
    <div
      data-slot="time-grid"
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-background select-none",
        className,
      )}
    >
      <div className={cn(columns, "border-b")}>
        <div />
        {days.map((day) => (
          <div
            key={day}
            className={cn(
              "flex flex-col border-l px-2 py-1.5",
              day === today && "bg-info-soft/30",
            )}
          >
            <span className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              {weekday(`${day}T12:00:00Z`).slice(0, 3)}
            </span>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                day === today && "text-primary",
              )}
            >
              {date(`${day}T12:00:00Z`, {
                day: "numeric",
                month: undefined,
                year: undefined,
              })}
            </span>
          </div>
        ))}
      </div>
      {allDayCells ? (
        <div className={cn(columns, "border-b")}>
          <div />
          {days.map((day, index) => (
            <div key={day} className="flex min-w-0 flex-col gap-1 border-l p-1">
              {allDayCells[index]}
            </div>
          ))}
        </div>
      ) : null}
      <div
        ref={bodyRef}
        className={cn(columns, "relative")}
        style={{ height }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        <div className="relative">
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-2xs tabular-nums text-subtle-foreground first:translate-y-0"
              style={{ top: top(hour * 60) }}
            >
              {hour === fromHour ? null : time(new Date(2000, 0, 1, hour, 0))}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const own = placed.filter((entry) => entry.day === day);
          const layout = lanes(own);
          return (
            <div
              key={day}
              ref={(element) => {
                if (element) columnRefs.current.set(day, element);
                else columnRefs.current.delete(day);
              }}
              className={cn(
                "relative border-l",
                day === today && "bg-info-soft/30",
              )}
              onPointerDown={(event) => startCreate(event, day)}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                  style={{ top: top(hour * 60) }}
                />
              ))}
              {bands
                .filter((band) => band.day === day)
                .map((band) => (
                  <div
                    key={`${band.start}-${band.end}`}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 border-l-2 border-success/50 bg-success-soft/60"
                    style={{
                      top: top(minutesOf(band.start)),
                      height:
                        top(minutesOf(band.end)) - top(minutesOf(band.start)),
                    }}
                  />
                ))}
              {day === today && nowMinutes >= first && nowMinutes <= last ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
                  style={{ top: top(nowMinutes) }}
                />
              ) : null}
              {own.map(({ block, start, end, dragging }, index) => {
                const { lane, count } = layout[index] ?? {
                  lane: 0,
                  count: 1,
                };
                const editable = Boolean(block.editable && onChange);
                return (
                  <div
                    key={block.id}
                    role="button"
                    tabIndex={0}
                    aria-label={block.label}
                    onPointerDown={(event) => startBlock(event, block)}
                    onClick={editable ? undefined : block.onOpen}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      block.onOpen?.();
                    }}
                    className={cn(
                      "@container absolute flex flex-col overflow-hidden rounded-md text-left text-xs focus-visible:shadow-focus focus-visible:outline-none",
                      editable
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-pointer",
                      dragging && "shadow-md",
                      block.className,
                    )}
                    style={{
                      top: top(Math.max(start, first)) + 1,
                      height: Math.max(
                        top(Math.min(end, last)) -
                          top(Math.max(start, first)) -
                          2,
                        18,
                      ),
                      left: `calc(${(lane / count) * 100}% + 2px)`,
                      width: `calc(${100 / count}% - 4px)`,
                      zIndex: dragging ? 20 : 1,
                    }}
                  >
                    {block.children}
                    {editable ? (
                      <div
                        data-resize
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                      />
                    ) : null}
                  </div>
                );
              })}
              {drag?.kind === "create" && drag.day === day ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0.5 z-20 flex flex-col rounded-md border border-dashed border-primary bg-selection px-2 py-1 text-xs"
                  style={{
                    top: top(Math.min(drag.anchor, drag.at)),
                    height: Math.max(
                      top(
                        drag.moved
                          ? Math.max(drag.anchor, drag.at)
                          : drag.anchor + 60,
                      ) - top(Math.min(drag.anchor, drag.at)),
                      18,
                    ),
                  }}
                >
                  <span className="tabular-nums text-muted-foreground">
                    {clock(Math.min(drag.anchor, drag.at))}–
                    {clock(
                      drag.moved
                        ? Math.max(drag.anchor, drag.at)
                        : drag.anchor + 60,
                    )}
                  </span>
                  {createLabel ? (
                    <span className="font-medium">{createLabel}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** What a session shows inside a TimeGrid block: its times and title. */
export function TimeGridCard({
  kind,
  start,
  end,
  title,
  struck = false,
  actions,
}: {
  kind: ActivityKind;
  start: string | Date;
  end: string | Date;
  title: string;
  /** Done or skipped. */
  struck?: boolean;
  /** Buttons along the bottom, such as accepting a suggestion. */
  actions?: ReactNode;
}) {
  const { time } = useLocale();
  const Icon = activityIcons[kind];
  return (
    <div className="flex h-full min-h-0 flex-col gap-0.5 px-2 py-1">
      {/* A narrow block, beside another at the same time, keeps its title. */}
      <span className="flex items-center gap-1 text-2xs tabular-nums text-muted-foreground @max-[6.5rem]:hidden">
        <Icon className="size-3 shrink-0" aria-hidden />
        {time(start)}–{time(end)}
      </span>
      <span
        className={cn("line-clamp-2 font-medium", struck && "line-through")}
      >
        {title}
      </span>
      {actions ? (
        <span className="mt-auto flex gap-1 pb-0.5">{actions}</span>
      ) : null}
    </div>
  );
}
