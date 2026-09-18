import {
  AlertCircleIcon,
  CheckIcon,
  Loader2Icon,
  PlugZapIcon,
  SquareIcon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
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
  onStop?: () => void;
  onRetry?: () => void;
  onReview?: () => void;
  onConnect?: () => void;
  className?: string;
}

/** Thin bar between transcript and composer. Always the same height so actions never jump. */
export function TurnStatusBar({
  status,
  onStop,
  onRetry,
  onReview,
  onConnect,
  className,
}: TurnStatusBarProps) {
  const base = "flex h-10 items-center gap-2 px-4 text-xs";
  switch (status.kind) {
    case "idle":
      return (
        <div
          role="status"
          className={cn(base, "text-subtle-foreground", className)}
        >
          <CheckIcon className="size-3.5" /> Ready
        </div>
      );
    case "streaming":
      return (
        <div
          role="status"
          aria-live="polite"
          className={cn(base, "text-muted-foreground", className)}
        >
          <Loader2Icon className="size-3.5 animate-spin text-primary" />
          {status.phase === "thinking"
            ? "Thinking…"
            : status.phase === "tools"
              ? "Using study tools…"
              : "Writing…"}
          {onStop ? (
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              onClick={onStop}
            >
              <SquareIcon className="size-3 fill-current" /> Stop
            </Button>
          ) : null}
        </div>
      );
    case "awaiting-review":
      return (
        <div
          role="status"
          className={cn(base, "bg-info-soft/60 text-foreground", className)}
        >
          <AlertCircleIcon className="size-3.5 text-link" />
          {status.pending}{" "}
          {status.pending === 1 ? "edit awaits" : "edits await"} your review
          {onReview ? (
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              onClick={onReview}
            >
              Review
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
          <SquareIcon className="size-3" /> Stopped
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
              Retry
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
              ? `${status.providerName} is not connected`
              : "No AI provider connected"}
            . Notes and PDFs work as usual.
          </span>
          {onConnect ? (
            <Button size="sm" variant="secondary" onClick={onConnect}>
              Connect
            </Button>
          ) : null}
        </div>
      );
  }
}
