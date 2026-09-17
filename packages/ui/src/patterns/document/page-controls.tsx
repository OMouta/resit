import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@resit/ui/components/input";
import { cn } from "@resit/ui/lib/utils";

import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";

export interface PageControlsProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  /** Initial text of the page field. Only for previews of the invalid state. */
  defaultDraft?: string;
  className?: string;
}

function parsePage(draft: string, pageCount: number): number | null {
  if (!/^\d+$/.test(draft.trim())) return null;
  const value = Number(draft);
  return value >= 1 && value <= pageCount ? value : null;
}

export function PageControls({
  page,
  pageCount,
  onPageChange,
  disabled = false,
  defaultDraft,
  className,
}: PageControlsProps) {
  const [draft, setDraft] = useState(defaultDraft ?? String(page));
  useEffect(() => {
    setDraft(String(page));
  }, [page]);

  const parsed = parsePage(draft, pageCount);
  const invalid = parsed === null;
  const commit = () => {
    if (parsed === null) return;
    if (parsed !== page) onPageChange(parsed);
  };

  return (
    <div
      role="group"
      aria-label="Page"
      className={cn("flex items-center gap-0.5", className)}
    >
      <ToolbarButton
        label="First page"
        shortcut="home"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(1)}
      >
        <ChevronsLeftIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Previous page"
        shortcut="arrowleft"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon />
      </ToolbarButton>
      <span className="flex items-center gap-1 px-1 text-sm tabular-nums">
        <Input
          aria-label="Page number"
          aria-invalid={invalid || undefined}
          title={
            invalid ? `Enter a page between 1 and ${pageCount}` : undefined
          }
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setDraft(String(page));
              event.currentTarget.blur();
            }
          }}
          onFocus={(event) => event.currentTarget.select()}
          className="w-10 px-1 text-center"
        />
        <span className="text-muted-foreground">/ {pageCount}</span>
      </span>
      <ToolbarButton
        label="Next page"
        shortcut="arrowright"
        disabled={disabled || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon />
      </ToolbarButton>
      <ToolbarButton
        label="Last page"
        shortcut="end"
        disabled={disabled || page >= pageCount}
        onClick={() => onPageChange(pageCount)}
      >
        <ChevronsRightIcon />
      </ToolbarButton>
    </div>
  );
}
