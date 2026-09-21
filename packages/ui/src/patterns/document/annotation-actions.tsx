import {
  LayersIcon,
  MessageSquarePlusIcon,
  SparklesIcon,
  TextQuoteIcon,
  Trash2Icon,
  UnderlineIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";
import { cn } from "@resit/ui/lib/utils";
import {
  annotationColorClasses,
  type AnnotationColor,
} from "@resit/ui/patterns/document/pdf-toolbar";

/** Each colour button's name, whole, so it reads right in every language. */
const highlightLabels: Record<AnnotationColor, string> = {
  yellow: msg("Yellow highlight"),
  green: msg("Green highlight"),
  blue: msg("Blue highlight"),
  pink: msg("Pink highlight"),
};

export interface AnnotationActionsProps {
  /** Pixels inside the positioned parent. The bar sits above this point. */
  at: { x: number; y: number };
  /** The colour to mark in, or the colour of the highlight being edited. */
  color: AnnotationColor;
  onColor: (color: AnnotationColor) => void;
  onUnderline?: (() => void) | undefined;
  onCite?: (() => void) | undefined;
  onAsk?: (() => void) | undefined;
  onCard?: (() => void) | undefined;
  onComment?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  /** True while editing a highlight, so the current colour is marked. */
  existing?: boolean;
  className?: string;
}

function Action({
  label,
  onClick,
  children,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "flex size-7 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:shadow-focus focus-visible:outline-none [&_svg]:size-4",
            destructive && "hover:bg-danger-soft hover:text-destructive",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Floating bar over a PDF: the colours to mark a selection in, and what to
 * do with the highlight it makes.
 */
export function AnnotationActions({
  at,
  color,
  onColor,
  onUnderline,
  onCite,
  onAsk,
  onCard,
  onComment,
  onDelete,
  existing = false,
  className,
}: AnnotationActionsProps) {
  const { t } = useLocale();
  return (
    <div
      role="toolbar"
      aria-label={existing ? t("Highlight actions") : t("Selection actions")}
      onMouseDown={(event) => {
        // Keep the text selection, and the bar itself, while an action is
        // chosen: the surface underneath clears both on a press.
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseUp={(event) => event.stopPropagation()}
      style={{ left: at.x, top: at.y }}
      className={cn(
        "absolute z-popover flex -translate-x-1/2 -translate-y-[calc(100%+10px)] items-center gap-0.5 rounded-panel border bg-surface-raised p-1 shadow-md",
        className,
      )}
    >
      {(Object.keys(annotationColorClasses) as AnnotationColor[]).map((key) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t(highlightLabels[key])}
              aria-pressed={existing ? key === color : undefined}
              onClick={() => onColor(key)}
              className={cn(
                "flex size-7 items-center justify-center rounded-control hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
                existing && key === color && "bg-accent",
              )}
            >
              <span
                className={cn(
                  "size-4 rounded-full shadow-hairline",
                  annotationColorClasses[key].swatch,
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {t(annotationColorClasses[key].label)}
          </TooltipContent>
        </Tooltip>
      ))}
      {onUnderline || onCite || onAsk || onCard || onComment || onDelete ? (
        <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
      ) : null}
      {onUnderline ? (
        <Action label={t("Underline")} onClick={onUnderline}>
          <UnderlineIcon />
        </Action>
      ) : null}
      {onCite ? (
        <Action label={t("Quote in note")} onClick={onCite}>
          <TextQuoteIcon />
        </Action>
      ) : null}
      {onAsk ? (
        <Action label={t("Ask about this")} onClick={onAsk}>
          <SparklesIcon />
        </Action>
      ) : null}
      {onCard ? (
        <Action label={t("Make a flashcard")} onClick={onCard}>
          <LayersIcon />
        </Action>
      ) : null}
      {onComment ? (
        <Action label={t("Comment")} onClick={onComment}>
          <MessageSquarePlusIcon />
        </Action>
      ) : null}
      {onDelete ? (
        <Action label={t("Delete highlight")} onClick={onDelete} destructive>
          <Trash2Icon />
        </Action>
      ) : null}
    </div>
  );
}
