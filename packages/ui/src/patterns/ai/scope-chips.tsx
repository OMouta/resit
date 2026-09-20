import {
  BoxIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HighlighterIcon,
  ImageIcon,
  PaperclipIcon,
  SquareDashedIcon,
  TextQuoteIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import type { ScopeItem } from "@resit/ui/patterns/ai/types";

function iconFor(item: ScopeItem) {
  switch (item.kind) {
    case "project":
      return FolderKanbanIcon;
    case "resource":
      return item.resourceKind === "image"
        ? ImageIcon
        : item.resourceKind === "attachment"
          ? PaperclipIcon
          : FileTextIcon;
    case "page":
      return FileTextIcon;
    case "region":
      return SquareDashedIcon;
    case "selection":
      return TextQuoteIcon;
    case "annotation":
      return HighlighterIcon;
    case "block":
      return BoxIcon;
    default:
      return null;
  }
}

function describe(item: ScopeItem): string {
  switch (item.kind) {
    case "subject":
      return `Subject: ${item.label}`;
    case "project":
      return `Project: ${item.label}`;
    case "resource":
      return `${item.label}${item.retrievable ? " (large, available by retrieval)" : ""}`;
    case "page":
      return `Page ${item.page}`;
    case "region":
      return `Region on page ${item.page}: ${item.description}`;
    case "selection":
      return `Selection: “${item.text}”`;
    case "annotation":
      return `Highlight on page ${item.page}: “${item.text}”`;
    case "block":
      return `Block: ${item.label}`;
  }
}

export interface ScopeChipProps {
  item: ScopeItem;
  onRemove?: ((item: ScopeItem) => void) | undefined;
  onOpen?: ((item: ScopeItem) => void) | undefined;
  className?: string;
}

/** One scope or attachment entry. Subject chips carry the subject colour plus its name. */
export function ScopeChip({
  item,
  onRemove,
  onOpen,
  className,
}: ScopeChipProps) {
  const Icon = iconFor(item);
  const colors =
    item.kind === "subject" ? subjectColorClasses[item.color] : null;
  const label =
    item.kind === "page"
      ? `p. ${item.page}`
      : item.kind === "selection"
        ? `“${item.text}”`
        : item.label;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-slot="scope-chip"
          data-kind={item.kind}
          className={cn(
            "inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-control-border bg-control pr-1 pl-2 text-xs text-foreground shadow-control",
            item.kind === "subject" &&
              cn(
                colors?.softBg,
                colors?.text,
                "border-transparent font-medium",
              ),
            item.kind === "region" && "border-dashed",
            !onRemove && "pr-2",
            className,
          )}
        >
          {colors ? (
            <span
              className={cn("size-1.5 shrink-0 rounded-full", colors.dot)}
              aria-hidden
            />
          ) : null}
          {Icon ? (
            <Icon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          <button
            type="button"
            className="min-w-0 truncate text-left outline-none focus-visible:underline"
            onClick={() => onOpen?.(item)}
            aria-label={describe(item)}
          >
            {label}
          </button>
          {item.kind === "resource" && item.retrievable ? (
            <span className="shrink-0 text-2xs text-subtle-foreground">
              retrieval
            </span>
          ) : null}
          {onRemove ? (
            <Button
              variant="subtle"
              size="icon-sm"
              className="size-5 rounded-sm"
              aria-label={`Remove ${item.label} from scope`}
              onClick={() => onRemove(item)}
            >
              <XIcon />
            </Button>
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent>{describe(item)}</TooltipContent>
    </Tooltip>
  );
}

export interface ScopeChipListProps {
  items: ScopeItem[];
  /** Chips beyond this count collapse into "+n". */
  max?: number;
  readOnly?: boolean;
  onRemove?: (item: ScopeItem) => void;
  onOpen?: (item: ScopeItem) => void;
  onShowAll?: () => void;
  emptyLabel?: string;
  className?: string;
}

export function ScopeChipList({
  items,
  max = 6,
  readOnly = false,
  onRemove,
  onOpen,
  onShowAll,
  emptyLabel = "No scope. The conversation sees nothing until you add a subject, project, or resource.",
  className,
}: ScopeChipListProps) {
  const visible = items.slice(0, max);
  const hidden = items.length - visible.length;
  if (items.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul
      aria-label="Conversation scope"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {visible.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="min-w-0 max-w-full">
          <ScopeChip
            item={item}
            onRemove={readOnly ? undefined : onRemove}
            onOpen={onOpen}
          />
        </li>
      ))}
      {hidden > 0 ? (
        <li>
          <Button variant="subtle" size="sm" onClick={onShowAll}>
            +{hidden}
          </Button>
        </li>
      ) : null}
    </ul>
  );
}

/** Shown when the focused tab is outside the conversation scope. */
export function ScopeMismatchNotice({
  title,
  subjectName,
  onAddToScope,
  onNewConversation,
  onDismiss,
  className,
}: {
  title: string;
  subjectName: string;
  onAddToScope: () => void;
  onNewConversation: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm",
        className,
      )}
    >
      <p>
        <span className="font-medium">{title}</span> is not included in this
        conversation.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onAddToScope}>
          Add to scope
        </Button>
        <Button size="sm" variant="outline" onClick={onNewConversation}>
          New conversation for {subjectName}
        </Button>
        {onDismiss ? (
          <Button
            size="sm"
            variant="subtle"
            onClick={onDismiss}
            className="ml-auto"
          >
            Keep as is
          </Button>
        ) : null}
      </div>
    </div>
  );
}
