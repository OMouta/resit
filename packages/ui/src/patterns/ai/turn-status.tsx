import {
  AlertCircleIcon,
  Loader2Icon,
  PlugZapIcon,
  SquareIcon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";

export type PanelStatus =
  | { kind: "idle" }
  | { kind: "streaming"; phase?: "thinking" | "writing" | "tools" }
  | { kind: "awaiting-review"; pending: number }
  | { kind: "stopped" }
  | { kind: "failed"; message: string }
  | { kind: "missing-provider"; providerName?: string };

export interface TurnStatusBarProps {
  status: PanelStatus;
  onRetry?: () => void;
  onReview?: () => void;
  onConnect?: () => void;
  className?: string;
}

/** Thin bar between transcript and composer. Idle turns show nothing. */
export function TurnStatusBar({
  status,
  onRetry,
  onReview,
  onConnect,
  className,
}: TurnStatusBarProps) {
  const { t } = useLocale();
  const base = "flex h-10 items-center gap-2 px-4 text-xs";
  switch (status.kind) {
    case "idle":
      return null;
    case "streaming":
      return (
        <div
          role="status"
          aria-live="polite"
          className={cn(base, "text-muted-foreground", className)}
        >
          <Loader2Icon className="size-3.5 animate-spin text-primary" />
          {status.phase === "thinking"
            ? t("Thinking…")
            : status.phase === "tools"
              ? t("Using study tools…")
              : t("Writing…")}
        </div>
      );
    case "awaiting-review":
      return (
        <div
          role="status"
          className={cn(base, "bg-info-soft/60 text-foreground", className)}
        >
          <AlertCircleIcon className="size-3.5 text-link" />
          {status.pending === 1
            ? t("1 edit awaits your review")
            : t("{count} edits await your review", { count: status.pending })}
          {onReview ? (
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              onClick={onReview}
            >
              {t("Review")}
            </Button>
          ) : null}
        </div>
      );
    case "stopped":
      return (
        <div
          role="status"
          className={cn(base, "text-muted-foreground", className)}
        >
          <SquareIcon className="size-3" /> {t("Stopped")}
        </div>
      );
    case "failed":
      return (
        <div
          role="alert"
          className={cn(base, "bg-danger-soft/60 text-destructive", className)}
        >
          <AlertCircleIcon className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">{status.message}</span>
          {onRetry ? (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              {t("Retry")}
            </Button>
          ) : null}
        </div>
      );
    case "missing-provider":
      return (
        <div
          role="status"
          className={cn(base, "bg-warning-soft/60 text-foreground", className)}
        >
          <PlugZapIcon className="size-3.5 text-warning" />
          <span className="min-w-0 flex-1 truncate">
            {status.providerName
              ? t("{provider} is not connected", {
                  provider: status.providerName,
                })
              : t("No AI provider connected")}
          </span>
          {onConnect ? (
            <Button size="sm" variant="secondary" onClick={onConnect}>
              {t("Connect")}
            </Button>
          ) : null}
        </div>
      );
  }
}
