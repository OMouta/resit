import type { ComponentProps } from "react";

import {
  subjectColorClasses,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

export interface ProjectRowSubject {
  name: string;
  color: SubjectColor;
}

export interface ProjectRowProps extends Omit<
  ComponentProps<"button">,
  "children"
> {
  name: string;
  subjects: ProjectRowSubject[];
  resourceCount: number;
  active?: boolean;
}

const MAX_DOTS = 3;

/** Sidebar row for a project: name, a stack of subject dots, resource count. */
export function ProjectRow({
  name,
  subjects,
  resourceCount,
  active = false,
  className,
  ...props
}: ProjectRowProps) {
  const shown = subjects.slice(0, MAX_DOTS);
  const extra = subjects.length - shown.length;
  const subjectNames = subjects.map((subject) => subject.name).join(", ");
  return (
    <button
      type="button"
      data-slot="project-row"
      aria-current={active ? "true" : undefined}
      title={subjectNames ? `${name} (${subjectNames})` : name}
      className={cn(
        "flex h-row w-full min-w-0 items-center gap-2 rounded-control px-2 text-left text-sm outline-none transition-colors duration-(--duration-fast) focus-visible:shadow-focus",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    >
      <span className="flex shrink-0 items-center" aria-hidden>
        {shown.map((subject, index) => (
          <span
            key={`${subject.name}-${index}`}
            className={cn(
              "size-2.5 rounded-full ring-2 ring-sidebar",
              index > 0 && "-ml-1",
              subjectColorClasses[subject.color].dot,
            )}
          />
        ))}
        {extra > 0 ? (
          <span className="ml-1 text-2xs tabular-nums text-subtle-foreground">
            +{extra}
          </span>
        ) : null}
      </span>
      {subjectNames ? <span className="sr-only">{subjectNames}</span> : null}
      <span className="truncate">{name}</span>
      <span className="ml-auto text-xs tabular-nums text-subtle-foreground">
        {resourceCount}
      </span>
    </button>
  );
}
