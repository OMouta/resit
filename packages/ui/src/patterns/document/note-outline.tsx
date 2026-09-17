import { ListTreeIcon } from "lucide-react";
import { useRef } from "react";

import { EmptyState } from "@resit/ui/components/empty-state";
import { useRovingFocus } from "@resit/ui/hooks/use-roving-focus";
import { cn } from "@resit/ui/lib/utils";

export interface OutlineHeading {
  id: string;
  /** 1–3; deeper levels indent the same as 3. */
  level: number;
  text: string;
}

export interface NoteOutlineProps {
  headings: readonly OutlineHeading[];
  /** Heading currently in view. */
  activeId?: string;
  onNavigate: (id: string) => void;
  className?: string;
}

export function NoteOutline({
  headings,
  activeId,
  onNavigate,
  className,
}: NoteOutlineProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const { onKeyDown } = useRovingFocus(listRef, {
    itemSelector: "[data-outline-item]",
    loop: true,
  });

  if (headings.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={<ListTreeIcon />}
        title="No headings yet"
        description="Headings in the note show up here."
        className={className}
      />
    );
  }

  const focusId =
    activeId && headings.some((h) => h.id === activeId)
      ? activeId
      : headings[0]?.id;

  return (
    <nav aria-label="Outline" className={cn("min-w-0", className)}>
      <ul
        ref={listRef}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-px py-1"
      >
        {headings.map((heading) => {
          const active = heading.id === activeId;
          const indent = Math.min(Math.max(heading.level, 1), 3) - 1;
          return (
            <li key={heading.id}>
              <button
                type="button"
                data-outline-item
                data-typeahead={heading.text}
                tabIndex={heading.id === focusId ? 0 : -1}
                aria-current={active ? "location" : undefined}
                title={heading.text}
                onClick={() => onNavigate(heading.id)}
                style={{ paddingLeft: 8 + indent * 12 }}
                className={cn(
                  "flex h-row w-full min-w-0 items-center rounded-control pr-2 text-left text-sm outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:shadow-focus",
                  active
                    ? "bg-selection font-medium text-foreground"
                    : heading.level === 1
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="truncate">{heading.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
