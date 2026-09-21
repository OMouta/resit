import {
  AlertTriangleIcon,
  ChevronRightIcon,
  LockIcon,
  RotateCcwIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@resit/ui/components/button";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";

export interface ErrorAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

export interface ErrorPanelProps {
  title: string;
  detail: string;
  /** Technical cause, collapsed behind "Details". */
  cause?: string | undefined;
  tone?: "error" | "warning";
  actions: ErrorAction[];
  className?: string;
}

/** Actionable error: what failed, what is safe, what to do next. */
export function ErrorPanel({
  title,
  detail,
  cause,
  tone = "error",
  actions,
  className,
}: ErrorPanelProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const Icon = tone === "error" ? XCircleIcon : AlertTriangleIcon;
  return (
    <section
      role={tone === "error" ? "alert" : "status"}
      data-slot="error-panel"
      className={cn(
        "flex gap-3 rounded-panel border p-4",
        tone === "error"
          ? "border-destructive/30 bg-danger-soft/60"
          : "border-warning/30 bg-warning-soft/60",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          tone === "error" ? "text-destructive" : "text-warning",
        )}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-foreground/90">{detail}</p>
        {cause ? (
          <div>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronRightIcon
                className={cn(
                  "size-3.5 transition-transform",
                  open && "rotate-90",
                )}
              />{" "}
              {t("Details")}
            </button>
            {open ? (
              <pre className="mt-1 rounded-md bg-background/70 px-2.5 py-2 font-mono text-xs whitespace-pre-wrap">
                {cause}
              </pre>
            ) : null}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.primary ? "default" : "outline"}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

export type RecoveryBannerKind =
  "read-only" | "recovered-draft" | "future-format" | "missing-source";

const bannerMeta: Record<
  RecoveryBannerKind,
  { icon: typeof LockIcon; className: string }
> = {
  "read-only": { icon: LockIcon, className: "bg-muted text-foreground" },
  "recovered-draft": {
    icon: RotateCcwIcon,
    className: "bg-info-soft text-foreground",
  },
  "future-format": {
    icon: AlertTriangleIcon,
    className: "bg-warning-soft text-foreground",
  },
  "missing-source": {
    icon: AlertTriangleIcon,
    className: "bg-warning-soft text-foreground",
  },
};

/** Thin banner at the top of an editor or pane. */
export function RecoveryBanner({
  kind,
  message,
  action,
  onDismiss,
  className,
}: {
  kind: RecoveryBannerKind;
  message: string;
  action?: ErrorAction | undefined;
  onDismiss?: () => void;
  className?: string;
}) {
  const { t } = useLocale();
  const { icon: Icon, className: tone } = bannerMeta[kind];
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-9 items-center gap-2 border-b px-3 py-1.5 text-sm",
        tone,
        className,
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      {action ? (
        <Button size="sm" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {onDismiss ? (
        <Button
          size="icon-sm"
          variant="subtle"
          aria-label={t("Dismiss")}
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
