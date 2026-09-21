import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  PinIcon,
  PlusIcon,
  WaypointsIcon,
  XIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import {
  subjectColorClasses,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

export interface DocumentTabItem {
  id: string;
  title: string;
  kind:
    | "note"
    | "pdf"
    | "image"
    | "attachment"
    | "project"
    | "study"
    | "graph"
    | "schedule"
    | "activity";
  subject?: { name: string; color: SubjectColor };
  /** Show the subject beside the title (title collision or foreign subject). */
  showSubject?: boolean;
  pinned?: boolean;
  dirty?: boolean;
  missing?: boolean;
  preview?: boolean;
}

export interface DocumentTabsProps {
  tabs: DocumentTabItem[];
  activeId?: string | undefined;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** A tab was dragged past the strip; the pane owner decides the destination. */
  onDragOut?: (id: string) => void;
  onNewTab?: () => void;
  /** Extra controls after the strip (split, more). */
  end?: ReactNode;
  className?: string;
}

/** Ids of tabs whose titles collide with another tab in the same strip. */
export function tabsNeedingSubject(
  tabs: readonly DocumentTabItem[],
): Set<string> {
  const byTitle = new Map<string, DocumentTabItem[]>();
  for (const tab of tabs)
    byTitle.set(tab.title, [...(byTitle.get(tab.title) ?? []), tab]);
  const ids = new Set<string>();
  for (const group of byTitle.values())
    if (group.length > 1) for (const tab of group) ids.add(tab.id);
  return ids;
}

const icons = {
  note: FileTextIcon,
  pdf: FileTextIcon,
  image: ImageIcon,
  attachment: PaperclipIcon,
  project: FileTextIcon,
  study: FileTextIcon,
  graph: WaypointsIcon,
  schedule: CalendarIcon,
  activity: ClipboardListIcon,
};

/**
 * Horizontal document tab strip. Overflowing tabs scroll and are listed in
 * an overflow menu. Drag to reorder with the pointer; keyboard: arrows move,
 * Enter activates, Delete closes.
 */
export function DocumentTabs({
  tabs,
  activeId,
  onActivate,
  onClose,
  onReorder,
  onDragOut,
  onNewTab,
  end,
  className,
}: DocumentTabsProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [drag, setDrag] = useState<{
    id: string;
    from: number;
    over: number | null;
  } | null>(null);

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const bounds = strip.getBoundingClientRect();
    const out: string[] = [];
    for (const element of strip.querySelectorAll<HTMLElement>(
      "[data-tab-id]",
    )) {
      const rect = element.getBoundingClientRect();
      if (rect.right > bounds.right + 1 || rect.left < bounds.left - 1)
        out.push(element.dataset.tabId ?? "");
    }
    setHidden(out);
  }, []);

  useEffect(() => {
    measure();
    const strip = stripRef.current;
    if (!strip) return;
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    strip.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      strip.removeEventListener("scroll", measure);
    };
  }, [measure, tabs]);

  useEffect(() => {
    if (!activeId) return;
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const items = Array.from(
      stripRef.current?.querySelectorAll<HTMLElement>("[data-tab-id]") ?? [],
    );
    const focus = (next: number) =>
      items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focus(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focus(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focus(0);
        break;
      case "End":
        event.preventDefault();
        focus(items.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onActivate(tabs[index]?.id ?? "");
        break;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        onClose(tabs[index]?.id ?? "");
        break;
      default:
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "w"
        ) {
          event.preventDefault();
          onClose(tabs[index]?.id ?? "");
        }
    }
  };

  const onPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    index: number,
    id: string,
  ) => {
    if (!onReorder || event.button !== 0) return;
    const strip = stripRef.current;
    if (!strip) return;
    const startX = event.clientX;
    let started = false;
    const move = (moveEvent: globalThis.PointerEvent) => {
      if (!started && Math.abs(moveEvent.clientX - startX) < 4) return;
      started = true;
      const items = Array.from(
        strip.querySelectorAll<HTMLElement>("[data-tab-id]"),
      );
      let over = items.length - 1;
      for (let i = 0; i < items.length; i += 1) {
        const rect = items[i]!.getBoundingClientRect();
        if (moveEvent.clientX < rect.left + rect.width / 2) {
          over = i;
          break;
        }
      }
      const bounds = strip.getBoundingClientRect();
      const outside =
        moveEvent.clientY < bounds.top - 24 ||
        moveEvent.clientY > bounds.bottom + 24;
      setDrag({ id, from: index, over: outside ? null : over });
    };
    const up = (upEvent: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag((current) => {
        if (started && current) {
          if (current.over === null) onDragOut?.(id);
          else if (current.over !== index && current.over !== index + 1)
            onReorder(
              index,
              current.over > index ? current.over - 1 : current.over,
            );
        }
        return null;
      });
      if (!started) onActivate(id);
      upEvent.preventDefault();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className={cn(
        "flex h-tab min-w-0 items-stretch border-b bg-sidebar",
        className,
      )}
    >
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Open documents"
        className="scrollbar-none relative flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none]"
      >
        {tabs.map((tab, index) => {
          const Icon = icons[tab.kind];
          const active = tab.id === activeId;
          const colors = tab.subject
            ? subjectColorClasses[tab.subject.color]
            : null;
          const insertBefore = drag?.over === index && drag.id !== tab.id;
          return (
            <div
              key={tab.id}
              role="tab"
              data-tab-id={tab.id}
              aria-selected={active}
              aria-label={`${tab.title}${tab.subject && tab.showSubject ? `, ${tab.subject.name}` : ""}${tab.dirty ? ", unsaved" : ""}${tab.missing ? ", missing" : ""}`}
              tabIndex={active ? 0 : -1}
              onKeyDown={(event) => onKeyDown(event, index)}
              onPointerDown={(event) => onPointerDown(event, index, tab.id)}
              onAuxClick={(event) => {
                if (event.button === 1) onClose(tab.id);
              }}
              className={cn(
                "group/tab relative flex h-full max-w-60 shrink-0 cursor-pointer items-center gap-2 rounded-control px-3 text-sm outline-none select-none transition-colors duration-(--duration-fast)",
                tab.pinned ? "w-9 justify-center px-0" : "min-w-32",
                active
                  ? "bg-background text-foreground shadow-sm dark:bg-surface-raised"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                tab.preview && "italic",
                drag?.id === tab.id && "opacity-40",
                insertBefore &&
                  "before:absolute before:inset-y-1 before:-left-[3px] before:w-0.5 before:rounded-full before:bg-ring",
                "focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
              )}
              title={tab.title}
            >
              {tab.missing ? (
                <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
              ) : tab.pinned ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        colors?.text ?? "text-subtle-foreground",
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{tab.title}</TooltipContent>
                </Tooltip>
              ) : (
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    tab.kind === "pdf"
                      ? "text-destructive/70"
                      : "text-subtle-foreground",
                  )}
                />
              )}
              {!tab.pinned ? (
                <span className="flex min-w-0 flex-1 flex-col leading-none">
                  <span className="truncate">{tab.title}</span>
                  {tab.subject && tab.showSubject ? (
                    <span className="mt-0.5 flex items-center gap-1 truncate text-2xs text-subtle-foreground">
                      <span
                        className={cn("size-1.5 rounded-full", colors?.dot)}
                        aria-hidden
                      />
                      {tab.subject.name}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {!tab.pinned ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Close ${tab.title}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(tab.id);
                  }}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-sm text-subtle-foreground hover:bg-control-active hover:text-foreground",
                    tab.dirty &&
                      "before:size-2 before:rounded-full before:bg-foreground/70 hover:before:hidden [&>svg]:hidden hover:[&>svg]:block",
                  )}
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : null}
              {tab.pinned ? (
                <PinIcon
                  className="absolute top-1 right-1 size-2.5 text-subtle-foreground"
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
        {drag && drag.over === tabs.length ? (
          <span aria-hidden className="my-1 w-0.5 shrink-0 bg-ring" />
        ) : null}
      </div>
      {hidden.length > 0 || onNewTab || end ? (
        <div className="flex shrink-0 items-center gap-0.5 border-l px-1.5">
          {hidden.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${hidden.length} more tabs`}
                  className="flex h-6 items-center gap-0.5 rounded-sm px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ChevronDownIcon className="size-3.5" />
                  {hidden.length}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-72">
                {tabs
                  .filter((tab) => hidden.includes(tab.id))
                  .map((tab) => (
                    <DropdownMenuItem
                      key={tab.id}
                      onSelect={() => onActivate(tab.id)}
                    >
                      <span className="truncate">{tab.title}</span>
                      {tab.subject?.name ? (
                        <span className="ml-auto text-xs text-subtle-foreground">
                          {tab.subject.name}
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {onNewTab ? (
            <button
              type="button"
              aria-label="New tab"
              onClick={onNewTab}
              className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <PlusIcon className="size-4" />
            </button>
          ) : null}
          {end}
        </div>
      ) : null}
    </div>
  );
}
