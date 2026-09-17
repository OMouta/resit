import {
  CheckIcon,
  ClipboardListIcon,
  EyeIcon,
  LayersIcon,
  MessageSquareIcon,
  MinusIcon,
  PencilLineIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@resit/ui/components/empty-state";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";

export type EvidenceKind =
  "exercise" | "quiz" | "flashcard" | "conversation" | "manual";
export type EvidenceOutcome = "correct" | "partial" | "incorrect" | "observed";

export interface EvidenceRowProps {
  kind: EvidenceKind;
  outcome: EvidenceOutcome;
  conceptName?: string;
  summary: string;
  sourceTitle: string;
  at: string | Date;
  /** Reference time for relative dates. Defaults to now. */
  now?: Date | undefined;
  actions?: ReactNode;
  className?: string;
}

const kindIcons: Record<EvidenceKind, typeof CheckIcon> = {
  exercise: PencilLineIcon,
  quiz: ClipboardListIcon,
  flashcard: LayersIcon,
  conversation: MessageSquareIcon,
  manual: EyeIcon,
};

const outcomeMeta: Record<
  EvidenceOutcome,
  { label: string; icon: typeof CheckIcon; className: string }
> = {
  correct: {
    label: "Correct",
    icon: CheckIcon,
    className: "bg-success-soft text-success",
  },
  partial: {
    label: "Partly",
    icon: MinusIcon,
    className: "bg-warning-soft text-warning",
  },
  incorrect: {
    label: "Incorrect",
    icon: XIcon,
    className: "bg-danger-soft text-destructive",
  },
  observed: {
    label: "Observed",
    icon: EyeIcon,
    className: "bg-muted text-muted-foreground",
  },
};

/** One piece of evidence about a concept, from practice or conversation. */
export function EvidenceRow({
  kind,
  outcome,
  conceptName,
  summary,
  sourceTitle,
  at,
  now,
  actions,
  className,
}: EvidenceRowProps) {
  const { relative } = useLocale();
  const KindIcon = kindIcons[kind];
  const meta = outcomeMeta[outcome];
  const OutcomeIcon = meta.icon;
  return (
    <div
      data-slot="evidence-row"
      className={cn(
        "group/evidence flex gap-3 rounded-lg px-2.5 py-2 hover:bg-accent",
        className,
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
          meta.className,
        )}
        aria-hidden
      >
        <OutcomeIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className={cn("font-medium", meta.className.split(" ")[1])}>
            {meta.label}
          </span>
          {conceptName ? (
            <span className="text-foreground">{conceptName}</span>
          ) : null}
          <span className="ml-auto flex items-center gap-1">
            <KindIcon className="size-3.5" aria-hidden />
            {relative(at, now)}
          </span>
        </p>
        <p className="text-sm text-foreground">{summary}</p>
        <p className="truncate text-xs text-subtle-foreground">{sourceTitle}</p>
      </div>
      {actions ? (
        <div className="hidden shrink-0 items-start group-hover/evidence:flex group-focus-within/evidence:flex">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function EvidenceList({
  children,
  empty,
}: {
  children: ReactNode;
  empty?: boolean;
}) {
  if (empty)
    return (
      <EmptyState
        size="compact"
        title="No evidence yet"
        description="Practice, quizzes, and conversations add evidence here."
      />
    );
  return <div className="flex flex-col gap-0.5">{children}</div>;
}
