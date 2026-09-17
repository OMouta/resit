import {
  AlertTriangleIcon,
  HighlighterIcon,
  MessageSquareIcon,
  PencilIcon,
  SquareDashedIcon,
  Trash2Icon,
  UnderlineIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";
import {
  annotationColorClasses,
  type AnnotationColor,
} from "@resit/ui/patterns/document/pdf-toolbar";

export type AnnotationKind = "highlight" | "underline" | "region" | "comment";

export interface AnnotationRowProps {
  id: string;
  kind: AnnotationKind;
  color: AnnotationColor;
  page: number;
  /** Quoted text for highlights and underlines. */
  text?: string;
  /** Text alternative for regions. */
  description?: string;
  comment?: string;
  createdAt: string | Date;
  selected?: boolean;
  /** The PDF changed since this annotation was made. */
  orphaned?: boolean;
  onSelect?: (id: string) => void;
  onGoToPage?: (page: number) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

const kindIcons = {
  highlight: HighlighterIcon,
  underline: UnderlineIcon,
  region: SquareDashedIcon,
  comment: MessageSquareIcon,
};

const kindLabels: Record<AnnotationKind, string> = {
  highlight: "Highlight",
  underline: "Underline",
  region: "Region",
  comment: "Comment",
};

/** One annotation in the PDF sidebar list. */
export function AnnotationRow({
  id,
  kind,
  color,
  page,
  text,
  description,
  comment,
  createdAt,
  selected = false,
  orphaned = false,
  onSelect,
  onGoToPage,
  onEdit,
  onDelete,
  className,
}: AnnotationRowProps) {
  const { dateTime } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const Icon = kindIcons[kind];
  const colors = annotationColorClasses[color];
  const quote = text ?? description;
  const long = (quote?.length ?? 0) > 120;

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect?.(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect?.(id);
      }}
      className={cn(
        "group/annotation flex gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:shadow-focus",
        selected && "border-border bg-selection hover:bg-selection",
        className,
      )}
    >
      <span
        className={cn(
          "mt-1 flex size-5 shrink-0 items-center justify-center rounded-md",
          colors.fill,
        )}
        aria-hidden
      >
        <Icon className="size-3.5 text-foreground/80" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {kindLabels[kind]} · {colors.label}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onGoToPage?.(page);
            }}
            className="rounded-sm text-link hover:underline focus-visible:shadow-focus focus-visible:outline-none"
          >
            p. {page}
          </button>
          <span className="ml-auto shrink-0 tabular-nums">
            {dateTime(createdAt)}
          </span>
        </div>
        {quote ? (
          <p
            className={cn(
              "text-foreground",
              text && "italic",
              !expanded && long && "line-clamp-2",
            )}
          >
            {text ? `“${text}”` : quote}
          </p>
        ) : null}
        {long ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
            className="w-fit text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
        {comment ? <p className="text-foreground/90">{comment}</p> : null}
        {orphaned ? (
          <p className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangleIcon className="size-3.5" /> Anchored to a previous
            revision of the PDF
          </p>
        ) : null}
      </div>
      <div className="hidden shrink-0 items-start gap-0.5 group-hover/annotation:flex group-focus-within/annotation:flex">
        {onEdit ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label="Edit annotation"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(id);
                }}
              >
                <PencilIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
        ) : null}
        {onDelete ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label="Delete annotation"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(id);
                }}
              >
                <Trash2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to trash</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
