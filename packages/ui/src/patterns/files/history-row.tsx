import {
  DownloadIcon,
  EyeIcon,
  HistoryIcon,
  RotateCcwIcon,
  SaveIcon,
  SparklesIcon,
  TimerIcon,
} from "lucide-react";
import { Fragment } from "react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";
import { msg } from "@resit/ui/lib/i18n";
import { cn } from "@resit/ui/lib/utils";

export type RevisionCause =
  "manual save" | "autosave" | "ai edit" | "restore" | "import";

export interface HistoryRevision {
  id: string;
  revision: number;
  at: string | Date;
  cause: RevisionCause;
  summary: string;
  sizeBytes: number;
  current?: boolean;
}

const causeIcons: Record<RevisionCause, typeof SaveIcon> = {
  "manual save": SaveIcon,
  autosave: TimerIcon,
  "ai edit": SparklesIcon,
  restore: RotateCcwIcon,
  import: DownloadIcon,
};

const causeLabels: Record<RevisionCause, string> = {
  "manual save": msg("manual save"),
  autosave: msg("autosave"),
  "ai edit": msg("assistant edit"),
  restore: msg("restore"),
  import: msg("import"),
};

export interface HistoryRevisionRowProps {
  revision: HistoryRevision;
  onPreview?: (id: string) => void;
  onRestore?: (id: string) => void;
  className?: string;
}

/** One saved revision. Restore never overwrites: it creates a new revision. */
export function HistoryRevisionRow({
  revision,
  onPreview,
  onRestore,
  className,
}: HistoryRevisionRowProps) {
  const { time, number, t } = useLocale();
  const Icon = causeIcons[revision.cause];
  return (
    <div
      className={cn(
        "group/revision flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-accent",
        className,
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm">
          <span className="truncate font-medium">{revision.summary}</span>
          {revision.current ? (
            <Badge variant="info">{t("Current")}</Badge>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="tabular-nums">{time(revision.at)}</span> ·{" "}
          {t(causeLabels[revision.cause])} ·{" "}
          {t("revision {number}", { number: number(revision.revision) })} ·{" "}
          {formatBytes(revision.sizeBytes, number)}
        </p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 group-hover/revision:flex group-focus-within/revision:flex">
        {onPreview ? (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => onPreview(revision.id)}
          >
            <EyeIcon /> {t("Preview")}
          </Button>
        ) : null}
        {onRestore && !revision.current ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRestore(revision.id)}
          >
            <RotateCcwIcon /> {t("Restore as new revision")}
          </Button>
        ) : null}
      </span>
    </div>
  );
}

/** Revisions grouped by day, newest first. */
export function HistoryList({
  revisions,
  onPreview,
  onRestore,
  className,
}: {
  revisions: HistoryRevision[];
  onPreview?: (id: string) => void;
  onRestore?: (id: string) => void;
  className?: string;
}) {
  const { date, t } = useLocale();
  const groups = new Map<string, HistoryRevision[]>();
  for (const revision of revisions) {
    const key = date(revision.at);
    groups.set(key, [...(groups.get(key) ?? []), revision]);
  }
  if (revisions.length === 0)
    return (
      <p
        className={cn(
          "flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground",
          className,
        )}
      >
        <HistoryIcon className="size-4" /> {t("No saved revisions yet.")}
      </p>
    );
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {Array.from(groups.entries()).map(([day, items]) => (
        <Fragment key={day}>
          <p className="px-2.5 pt-2 pb-1 text-2xs font-semibold tracking-wide text-subtle-foreground uppercase">
            {day}
          </p>
          {items.map((revision) => (
            <HistoryRevisionRow
              key={revision.id}
              revision={revision}
              {...(onPreview ? { onPreview } : {})}
              {...(onRestore ? { onRestore } : {})}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
