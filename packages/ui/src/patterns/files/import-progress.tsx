import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@resit/ui/components/button";
import { Progress } from "@resit/ui/components/progress";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";
import { cn } from "@resit/ui/lib/utils";

export type ImportStage =
  | "queued"
  | "copying"
  | "hashing"
  | "extracting"
  | "indexing"
  | "done"
  | "failed"
  | "cancelled";

export interface ImportJob {
  id: string;
  fileName: string;
  sizeBytes: number;
  subjectName: string;
  stage: ImportStage;
  /** 0–1. Ignored for queued and hashing, which show an indeterminate bar. */
  progress: number;
  /** Shown when `stage` is "failed". Say what failed and what to do next. */
  error?: string;
  cancelable: boolean;
}

const STAGE_LABEL: Record<ImportStage, string> = {
  queued: "Queued",
  copying: "Copying",
  hashing: "Checking file",
  extracting: "Extracting text",
  indexing: "Indexing",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

const INDETERMINATE: ReadonlySet<ImportStage> = new Set(["queued", "hashing"]);
const FINISHED: ReadonlySet<ImportStage> = new Set([
  "done",
  "failed",
  "cancelled",
]);

export interface ImportJobRowProps extends Omit<ComponentProps<"li">, "id"> {
  job: ImportJob;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function ImportJobRow({
  job,
  onCancel,
  onRetry,
  onRemove,
  className,
  ...props
}: ImportJobRowProps) {
  const { number, percent } = useLocale();
  const running = !FINISHED.has(job.stage);
  const indeterminate = INDETERMINATE.has(job.stage);
  const stage = STAGE_LABEL[job.stage];

  return (
    <li
      data-slot="import-job-row"
      data-stage={job.stage}
      className={cn("flex flex-col gap-1.5 px-3 py-2", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={job.fileName}>
            {job.fileName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {job.subjectName} · {formatBytes(job.sizeBytes, number)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-xs tabular-nums",
            job.stage === "failed"
              ? "text-destructive"
              : job.stage === "done"
                ? "text-success"
                : "text-muted-foreground",
          )}
        >
          {job.stage === "done" ? (
            <CheckIcon className="size-3.5" aria-hidden />
          ) : null}
          {stage}
          {running && !indeterminate ? ` · ${percent(job.progress)}` : ""}
        </span>
        {running && job.cancelable ? (
          <Button
            variant="subtle"
            size="icon-sm"
            aria-label={`Cancel import of ${job.fileName}`}
            onClick={() => onCancel?.(job.id)}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      {running ? (
        <Progress
          value={job.progress * 100}
          indeterminate={indeterminate}
          aria-label={`${stage}: ${job.fileName}`}
        />
      ) : null}
      {job.stage === "failed" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1 text-xs text-destructive">
            {job.error ?? "Import failed."}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRetry?.(job.id)}
            >
              <RotateCcwIcon />
              Retry
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => onRemove?.(job.id)}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : null}
      {job.stage === "cancelled" ? (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-xs text-muted-foreground">
            Nothing was added to the workspace.
          </p>
          <Button variant="subtle" size="sm" onClick={() => onRemove?.(job.id)}>
            Remove
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export interface ImportProgressPanelProps extends ComponentProps<"section"> {
  jobs: ImportJob[];
  onCancel?: (id: string) => void;
  onCancelAll?: () => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function ImportProgressPanel({
  jobs,
  onCancel,
  onCancelAll,
  onRetry,
  onRemove,
  className,
  ...props
}: ImportProgressPanelProps) {
  const { number } = useLocale();
  const done = jobs.filter((job) => job.stage === "done").length;
  const failed = jobs.filter((job) => job.stage === "failed").length;
  const cancelable = jobs.some(
    (job) => !FINISHED.has(job.stage) && job.cancelable,
  );

  const summary =
    jobs.length === 0
      ? "No imports"
      : failed > 0
        ? `${number(done)} of ${number(jobs.length)} done · ${number(failed)} failed`
        : `${number(done)} of ${number(jobs.length)} done`;

  return (
    <section
      data-slot="import-progress-panel"
      aria-label="Imports"
      className={cn(
        "flex flex-col rounded-lg border border-border bg-background",
        className,
      )}
      {...props}
    >
      <header className="flex h-toolbar items-center gap-2 border-b border-border px-3">
        <h2 className="flex-1 text-sm font-medium">Importing</h2>
        <span
          className="text-xs text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {summary}
        </span>
        {cancelable ? (
          <Button variant="subtle" size="sm" onClick={() => onCancelAll?.()}>
            Cancel all
          </Button>
        ) : null}
      </header>
      {jobs.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          Drop PDFs here or use Import to add files.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {jobs.map((job) => (
            <ImportJobRow
              key={job.id}
              job={job}
              {...(onCancel ? { onCancel } : {})}
              {...(onRetry ? { onRetry } : {})}
              {...(onRemove ? { onRemove } : {})}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
