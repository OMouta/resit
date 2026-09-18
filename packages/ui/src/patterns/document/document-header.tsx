import { LockIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@resit/ui/components/badge";
import { useLocale } from "@resit/ui/hooks/use-locale";
import {
  subjectColorClasses,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

export interface DocumentHeaderProps {
  title: string;
  subject?: { name: string; color: SubjectColor };
  /** Workspace-relative path, shown as a breadcrumb. */
  path: string;
  modifiedAt?: string | Date;
  readOnly?: boolean;
  onRename?: (title: string) => void;
  actions?: ReactNode;
  className?: string;
}

/** Title block at the top of a note or document view. */
export function DocumentHeader({
  title,
  subject,
  path,
  modifiedAt,
  readOnly = false,
  onRename,
  actions,
  className,
}: DocumentHeaderProps) {
  const { relative } = useLocale();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const segments = path.split("/").slice(0, -1);
  const colors = subject ? subjectColorClasses[subject.color] : null;

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onRename?.(next);
    else setDraft(title);
  };

  return (
    <header
      data-slot="document-header"
      className={cn(
        "flex flex-col gap-3 px-8 pt-10 pb-4 @container",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {subject ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium",
              colors?.softBg,
              colors?.text,
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", colors?.dot)}
              aria-hidden
            />
            {subject.name}
          </span>
        ) : null}
        <nav
          aria-label="Location"
          className="flex min-w-0 items-center gap-1 truncate"
        >
          {segments.map((segment, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 ? (
                <span className="text-subtle-foreground">/</span>
              ) : null}
              <span className="truncate">{segment}</span>
            </span>
          ))}
        </nav>
        {readOnly ? (
          <Badge variant="outline" className="gap-1">
            <LockIcon /> Read-only
          </Badge>
        ) : null}
        {modifiedAt ? (
          <span className="ml-auto shrink-0">
            Edited {relative(modifiedAt)}
          </span>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <input
            autoFocus
            aria-label="Document title"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
                setDraft(title);
                setEditing(false);
              }
            }}
            className="w-full min-w-0 rounded-md bg-transparent text-2xl font-semibold tracking-[-0.02em] outline-none focus-visible:shadow-focus"
          />
        ) : (
          <h1
            className={cn(
              "min-w-0 text-2xl font-semibold tracking-[-0.02em] text-balance @md:text-3xl",
              onRename &&
                !readOnly &&
                "-mx-1 cursor-text rounded-md px-1 hover:bg-accent",
            )}
            onClick={() => {
              if (onRename && !readOnly) setEditing(true);
            }}
            title={onRename && !readOnly ? "Click to rename" : undefined}
          >
            {title}
          </h1>
        )}
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
