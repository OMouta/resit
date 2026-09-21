import {
  AlertCircleIcon,
  CheckIcon,
  CloudOffIcon,
  GitCompareIcon,
  Loader2Icon,
  LockIcon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";
import { cn } from "@resit/ui/lib/utils";

export type SaveState =
  "saved" | "saving" | "unsaved" | "error" | "read-only" | "conflict";

const meta: Record<
  SaveState,
  { label: string; icon: typeof CheckIcon; className: string; action?: string }
> = {
  saved: {
    label: msg("Saved"),
    icon: CheckIcon,
    className: "text-muted-foreground",
  },
  saving: {
    label: msg("Saving…"),
    icon: Loader2Icon,
    className: "text-muted-foreground",
  },
  unsaved: {
    label: msg("Unsaved changes"),
    icon: CloudOffIcon,
    className: "text-foreground",
  },
  error: {
    label: msg("Not saved"),
    icon: AlertCircleIcon,
    className: "text-destructive",
    action: msg("Retry"),
  },
  "read-only": {
    label: msg("Read-only"),
    icon: LockIcon,
    className: "text-muted-foreground",
  },
  conflict: {
    label: msg("Conflict"),
    icon: GitCompareIcon,
    className: "text-warning",
    action: msg("Review"),
  },
};

export interface SaveStatusProps {
  state: SaveState;
  /** One line of detail, shown in the tooltip and the full-width line. */
  detail?: string | undefined;
  onAction?: (state: SaveState) => void;
  /** Icon only, with the label in the tooltip, for narrow toolbars. */
  compact?: boolean;
  className?: string;
}

/** Compact indicator for toolbars. Unsaved is visibly different from saved. */
export function SaveStatus({
  state,
  detail,
  onAction,
  compact = false,
  className,
}: SaveStatusProps) {
  const { t } = useLocale();
  const { icon: Icon, className: tone } = meta[state];
  const label = t(meta[state].label);
  const action = meta[state].action ? t(meta[state].action) : undefined;
  const tip = compact ? [label, detail].filter(Boolean).join(". ") : detail;
  const content = (
    <span
      data-slot="save-status"
      data-state={state}
      role="status"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium",
        tone,
        state === "unsaved" && "bg-accent",
        state === "error" && "bg-danger-soft",
        state === "conflict" && "bg-warning-soft",
        className,
      )}
    >
      {state === "unsaved" ? (
        <span className="size-2 rounded-full bg-foreground" aria-hidden />
      ) : (
        <Icon
          className={cn("size-3.5", state === "saving" && "animate-spin")}
          aria-hidden
        />
      )}
      {compact ? <span className="sr-only">{label}</span> : label}
      {action && onAction ? (
        <Button
          size="sm"
          variant="ghost"
          className="-mr-1 h-5 px-1.5 text-xs"
          onClick={() => onAction(state)}
        >
          {action}
        </Button>
      ) : null}
    </span>
  );
  if (!tip) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/** Full-width footer line with the same states and the detail visible. */
export function SaveStatusLine({
  state,
  detail,
  onAction,
  className,
}: SaveStatusProps) {
  const { t } = useLocale();
  const { icon: Icon, className: tone } = meta[state];
  const label = t(meta[state].label);
  const action = meta[state].action ? t(meta[state].action) : undefined;
  return (
    <div
      role="status"
      data-state={state}
      className={cn(
        "flex h-9 items-center gap-2 border-t px-3 text-xs",
        state === "error" && "bg-danger-soft",
        state === "conflict" && "bg-warning-soft",
        state === "unsaved" && "bg-accent",
        className,
      )}
    >
      <Icon
        className={cn("size-3.5", tone, state === "saving" && "animate-spin")}
        aria-hidden
      />
      <span className={cn("font-medium", tone)}>{label}</span>
      {detail ? (
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {detail}
        </span>
      ) : null}
      {action && onAction ? (
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() => onAction(state)}
        >
          {action}
        </Button>
      ) : null}
    </div>
  );
}
