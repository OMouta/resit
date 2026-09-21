import {
  AlertTriangleIcon,
  BookmarkIcon,
  BookOpenIcon,
  LightbulbIcon,
  SigmaIcon,
  SparklesIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";
import { cn } from "@resit/ui/lib/utils";

export type CalloutKind =
  | "definition"
  | "theorem"
  | "example"
  | "warning"
  | "prerequisite"
  | "ai-explanation";

const KINDS: Record<
  CalloutKind,
  {
    label: string;
    icon: typeof BookOpenIcon;
    className: string;
    iconClassName: string;
  }
> = {
  definition: {
    label: msg("Definition"),
    icon: BookOpenIcon,
    className: "border-l-link bg-info-soft",
    iconClassName: "text-link",
  },
  theorem: {
    label: msg("Theorem"),
    icon: SigmaIcon,
    className: "border-l-subject-purple bg-subject-purple-soft",
    iconClassName: "text-subject-purple",
  },
  example: {
    label: msg("Example"),
    icon: LightbulbIcon,
    className: "border-l-success bg-success-soft",
    iconClassName: "text-success",
  },
  warning: {
    label: msg("Warning"),
    icon: AlertTriangleIcon,
    className: "border-l-warning bg-warning-soft",
    iconClassName: "text-warning",
  },
  prerequisite: {
    label: msg("Prerequisite"),
    icon: BookmarkIcon,
    className: "border-l-subject-orange bg-subject-orange-soft",
    iconClassName: "text-subject-orange",
  },
  "ai-explanation": {
    label: msg("Explanation"),
    icon: SparklesIcon,
    className: "border-l-subject-pink bg-subject-pink-soft",
    iconClassName: "text-subject-pink",
  },
};

export interface StudyCalloutProps {
  kind: CalloutKind;
  /** Replaces the kind label, for example "Theorem 2.1". */
  title?: string;
  children: ReactNode;
  /** Where the content came from. Rendered as a link when `onOpen` is set. */
  source?: { label: string; onOpen?: () => void };
  /** AI explanation not yet kept in the note. Shows accept and dismiss. */
  pending?: boolean;
  onAccept?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function StudyCallout({
  kind,
  title,
  children,
  source,
  pending = false,
  onAccept,
  onDismiss,
  className,
}: StudyCalloutProps) {
  const { t } = useLocale();
  const spec = KINDS[kind];
  const Icon = spec.icon;
  const sourceLine =
    source ??
    (kind === "ai-explanation" ? { label: t("From conversation") } : undefined);

  return (
    <aside
      data-kind={kind}
      data-pending={pending || undefined}
      className={cn(
        "my-3 rounded-md border border-l-[3px] px-3.5 py-2.5 text-foreground",
        spec.className,
        pending && "border-dashed",
        className,
      )}
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
        <Icon
          className={cn("size-3.5 shrink-0", spec.iconClassName)}
          aria-hidden
        />
        <span>{title ?? t(spec.label)}</span>
      </p>
      <div className="document max-w-none text-[0.9375rem] [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
      {sourceLine || pending ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {sourceLine ? (
            sourceLine.onOpen ? (
              <button
                type="button"
                onClick={sourceLine.onOpen}
                className="truncate text-link underline-offset-2 hover:underline focus-visible:shadow-focus focus-visible:outline-none"
              >
                {sourceLine.label}
              </button>
            ) : (
              <span className="truncate">{sourceLine.label}</span>
            )
          ) : null}
          {pending ? (
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                {t("Dismiss")}
              </Button>
              <Button size="sm" variant="secondary" onClick={onAccept}>
                {t("Keep in note")}
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
