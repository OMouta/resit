import { AlertTriangleIcon, FileTextIcon, QuoteIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { cn } from "@resit/ui/lib/utils";

export interface CitationSource {
  resourceId: string;
  title: string;
  subjectName?: string;
  page?: number;
}

export interface CitationBlockProps {
  source: CitationSource;
  /** The quoted text, never translated. */
  quote?: ReactNode;
  /** Long quotes collapse to four lines with a toggle. */
  collapsible?: boolean;
  selected?: boolean;
  /** The linked resource or page does not resolve. */
  missing?: boolean;
  onOpen?: (source: CitationSource) => void;
  onLocate?: (source: CitationSource) => void;
  onRemove?: (source: CitationSource) => void;
  className?: string;
}

function SourceLine({
  source,
  missing,
}: {
  source: CitationSource;
  missing: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      {missing ? (
        <AlertTriangleIcon className="size-3.5 shrink-0 text-warning" />
      ) : (
        <FileTextIcon className="size-3.5 shrink-0 text-subtle-foreground" />
      )}
      <span
        className={cn(
          "truncate font-medium",
          missing
            ? "text-muted-foreground line-through decoration-warning/60"
            : "text-foreground",
        )}
      >
        {source.title}
      </span>
      {source.page !== undefined ? (
        <span className="shrink-0 text-muted-foreground">p. {source.page}</span>
      ) : null}
      {source.subjectName ? (
        <span className="shrink-0 text-subtle-foreground">
          · {source.subjectName}
        </span>
      ) : null}
    </span>
  );
}

/** Quotation from a source resource with the source line beneath it. */
export function CitationBlock({
  source,
  quote,
  collapsible = true,
  selected = false,
  missing = false,
  onOpen,
  onLocate,
  onRemove,
  className,
}: CitationBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = typeof quote === "string" && quote.length > 260;
  return (
    <figure
      data-slot="citation-block"
      className={cn(
        "group/citation relative my-3 rounded-lg border-l-[3px] bg-muted/50 py-2.5 pr-3 pl-4 transition-colors",
        missing
          ? "border-warning/70 bg-warning-soft/40"
          : "border-border-strong",
        selected && "bg-selection ring-1 ring-ring/40",
        className,
      )}
    >
      <QuoteIcon
        aria-hidden
        className="absolute top-2 right-2.5 size-4 text-border-strong"
      />
      {quote ? (
        <blockquote
          className={cn(
            "document pr-4 text-[0.95em] text-foreground/90",
            collapsible && isLong && !expanded && "line-clamp-4",
          )}
        >
          {quote}
        </blockquote>
      ) : null}
      {collapsible && isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {onOpen && !missing ? (
          <button
            type="button"
            onClick={() => onOpen(source)}
            className="min-w-0 rounded-sm text-left hover:underline focus-visible:shadow-focus focus-visible:outline-none"
          >
            <SourceLine source={source} missing={missing} />
          </button>
        ) : (
          <SourceLine source={source} missing={missing} />
        )}
        {missing ? (
          <span className="flex items-center gap-2 text-xs text-warning">
            Source not found
            {onLocate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLocate(source)}
              >
                Locate…
              </Button>
            ) : null}
            {onRemove ? (
              <Button
                variant="subtle"
                size="sm"
                onClick={() => onRemove(source)}
              >
                Remove link
              </Button>
            ) : null}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** Compact inline reference for chat and lists. */
export function CitationChip({
  source,
  missing = false,
  onOpen,
  className,
}: {
  source: CitationSource;
  missing?: boolean;
  onOpen?: (source: CitationSource) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(source)}
      title={`${source.title}${source.page !== undefined ? `, page ${source.page}` : ""}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border bg-control px-1.5 py-0.5 text-xs text-foreground shadow-control hover:bg-control-hover focus-visible:shadow-focus focus-visible:outline-none",
        missing && "border-warning/50 text-muted-foreground",
        className,
      )}
    >
      {missing ? (
        <AlertTriangleIcon className="size-3 shrink-0 text-warning" />
      ) : (
        <FileTextIcon className="size-3 shrink-0 text-subtle-foreground" />
      )}
      <span className="truncate">{source.title}</span>
      {source.page !== undefined ? (
        <span className="shrink-0 text-muted-foreground">p. {source.page}</span>
      ) : null}
    </button>
  );
}
