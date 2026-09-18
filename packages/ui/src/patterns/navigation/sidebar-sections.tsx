import { ChevronRightIcon } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@resit/ui/lib/utils";

export interface SidebarSectionProps {
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  /** Shown at the right of the header on hover or focus (an icon button). */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Collapsible sidebar group: chevron, title, count, optional action. */
export function SidebarSection({
  title,
  count,
  expanded,
  onToggle,
  action,
  children,
  className,
}: SidebarSectionProps) {
  const contentId = useId();
  return (
    <section
      data-slot="sidebar-section"
      className={cn("flex flex-col", className)}
    >
      <div className="group/section flex h-row items-center gap-1 px-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => onToggle(!expanded)}
          className="flex h-full min-w-0 flex-1 items-center gap-1 rounded-control px-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground focus-visible:shadow-focus"
        >
          <ChevronRightIcon
            aria-hidden
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-(--duration-fast)",
              expanded && "rotate-90",
            )}
          />
          <span className="truncate">{title}</span>
          {count !== undefined ? (
            <span className="ml-1 text-2xs tabular-nums text-subtle-foreground">
              {count}
            </span>
          ) : null}
        </button>
        {action ? (
          <div className="flex shrink-0 opacity-0 transition-opacity duration-(--duration-fast) group-focus-within/section:opacity-100 group-hover/section:opacity-100">
            {action}
          </div>
        ) : null}
      </div>
      <div id={contentId} hidden={!expanded} className="flex flex-col">
        {children}
      </div>
    </section>
  );
}

export interface SidebarNavItemProps extends Omit<
  ComponentProps<"button">,
  "children"
> {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
}

/** Top-level sidebar entry (Projects, Library, Study, and so on). */
export function SidebarNavItem({
  icon,
  label,
  count,
  active = false,
  className,
  ...props
}: SidebarNavItemProps) {
  return (
    <button
      type="button"
      data-slot="sidebar-nav-item"
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-row w-full min-w-0 items-center gap-2 rounded-control px-2 text-left text-sm outline-none transition-colors duration-(--duration-fast) focus-visible:shadow-focus [&_svg]:size-4 [&_svg]:shrink-0",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="flex shrink-0 items-center">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className="ml-auto text-xs tabular-nums text-subtle-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}
