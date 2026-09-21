import { PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, type KeyboardEvent } from "react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { Kbd } from "@resit/ui/components/kbd";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { useReducedMotion } from "@resit/ui/hooks/use-reduced-motion";
import { msg, msgc } from "@resit/ui/lib/i18n";
import { cn } from "@resit/ui/lib/utils";
import { MathText } from "@resit/ui/patterns/document/math";

export type CardState = "new" | "learning" | "review" | "suspended";
export type ReviewGrade = "again" | "hard" | "good" | "easy";

const stateVariant: Record<
  CardState,
  "info" | "warning" | "success" | "muted"
> = {
  new: "info",
  learning: "warning",
  review: "success",
  suspended: "muted",
};

const stateLabels: Record<CardState, string> = {
  new: msgc("card", "New"),
  learning: msgc("card", "Learning"),
  review: msgc("card", "Review"),
  suspended: msgc("card", "Suspended"),
};

/** Renders cloze text: `{{c1::answer}}` hidden until revealed. */
function ClozeText({ text, revealed }: { text: string; revealed: boolean }) {
  const { t } = useLocale();
  const parts = text.split(/(\{\{c\d+::[^}]+\}\})/g);
  return (
    <span>
      {parts.map((part, index) => {
        const match = /^\{\{c\d+::([^}]+)\}\}$/.exec(part);
        if (!match)
          return (
            <MathText key={index} paragraphClassName="my-0 inline">
              {part}
            </MathText>
          );
        return revealed ? (
          <mark
            key={index}
            className="rounded-sm bg-highlight px-1 text-foreground"
          >
            <MathText paragraphClassName="my-0 inline">
              {match[1] ?? ""}
            </MathText>
          </mark>
        ) : (
          <span
            key={index}
            className="mx-0.5 inline-block min-w-12 rounded-sm border-b-2 border-dashed border-foreground/50 align-baseline"
            aria-label={t("hidden")}
          >
            &nbsp;
          </span>
        );
      })}
    </span>
  );
}

export interface FlashcardProps {
  kind: "basic" | "cloze";
  front: string;
  back: string;
  subjectName: string;
  sourceTitle: string;
  state: CardState;
  revealed: boolean;
  onReveal: () => void;
  onResume?: () => void;
  onSuspend?: () => void;
  className?: string;
}

/** Front/back study card. Space reveals; the flip respects reduced motion. */
export function Flashcard({
  kind,
  front,
  back,
  subjectName,
  sourceTitle,
  state,
  revealed,
  onReveal,
  onResume,
  onSuspend,
  className,
}: FlashcardProps) {
  const { t } = useLocale();
  const reduced = useReducedMotion();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " && !revealed && state !== "suspended") {
      event.preventDefault();
      onReveal();
    }
  };
  return (
    <div
      data-slot="flashcard"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={
        revealed ? t("Flashcard, answer shown") : t("Flashcard, question")
      }
      className={cn(
        "flex flex-col gap-3 outline-none [perspective:1200px] focus-visible:[&>div]:shadow-focus",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex min-h-64 flex-col rounded-panel border bg-background p-6 shadow-md",
          !reduced &&
            "transition-transform duration-(--duration-slow) ease-(--ease-out) [transform-style:preserve-3d]",
          state === "suspended" && "opacity-80",
        )}
      >
        <header className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={stateVariant[state]}>{t(stateLabels[state])}</Badge>
          <span>{subjectName}</span>
          <span className="ml-auto truncate">{sourceTitle}</span>
        </header>
        <div className="document flex max-w-none flex-1 flex-col justify-center py-6 text-center text-lg">
          {kind === "cloze" ? (
            <ClozeText text={front} revealed={revealed} />
          ) : (
            <MathText paragraphClassName="my-0">{front}</MathText>
          )}
        </div>
        {revealed && kind === "basic" ? (
          <div
            className={cn(
              "document max-w-none border-t pt-4 text-center text-base",
              !reduced && "animate-in fade-in-0 slide-in-from-bottom-1",
            )}
          >
            <MathText paragraphClassName="my-0">{back}</MathText>
          </div>
        ) : null}
        {!revealed && state !== "suspended" ? (
          <div className="flex justify-center border-t pt-4">
            <Button onClick={onReveal}>
              {t("Show answer")}{" "}
              <Kbd className="bg-white/20 text-white">{t("Space")}</Kbd>
            </Button>
          </div>
        ) : null}
        {state === "suspended" ? (
          <div className="flex items-center justify-center gap-3 border-t pt-4 text-sm text-muted-foreground">
            <PauseIcon className="size-4" />{" "}
            {t("This card is suspended and will not be scheduled.")}
            {onResume ? (
              <Button size="sm" variant="secondary" onClick={onResume}>
                <PlayIcon /> {t("Resume")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {onSuspend && state !== "suspended" ? (
        <button
          type="button"
          onClick={onSuspend}
          className="self-end text-xs text-muted-foreground hover:text-foreground"
        >
          {t("Suspend card")}
        </button>
      ) : null}
    </div>
  );
}

export interface ReviewControlsProps {
  intervals: Record<ReviewGrade, string>;
  onGrade: (grade: ReviewGrade) => void;
  disabled?: boolean;
  className?: string;
}

const grades: {
  id: ReviewGrade;
  label: string;
  key: string;
  className: string;
}[] = [
  { id: "again", label: msg("Again"), key: "1", className: "text-destructive" },
  { id: "hard", label: msg("Hard"), key: "2", className: "text-warning" },
  { id: "good", label: msg("Good"), key: "3", className: "text-success" },
  { id: "easy", label: msg("Easy"), key: "4", className: "text-link" },
];

/** Again/Hard/Good/Easy with the next interval under each. Keys 1–4. */
export function ReviewControls({
  intervals,
  onGrade,
  disabled = false,
  className,
}: ReviewControlsProps) {
  const { t } = useLocale();
  useEffect(() => {
    if (disabled) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const grade = grades.find((entry) => entry.key === event.key);
      const target = event.target;
      // Digits typed into any field, including a rich-text editor in the
      // other pane, are text rather than ratings.
      if (
        grade &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !(target instanceof HTMLTextAreaElement) &&
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLElement && target.isContentEditable)
      )
        onGrade(grade.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onGrade]);
  return (
    <div
      role="group"
      aria-label={t("Rate your recall")}
      className={cn("grid grid-cols-4 gap-2", className)}
    >
      {grades.map((grade) => (
        <Button
          key={grade.id}
          variant="outline"
          size="lg"
          disabled={disabled}
          onClick={() => onGrade(grade.id)}
          className="h-auto flex-col gap-0.5 py-2"
        >
          <span className={cn("text-sm font-semibold", grade.className)}>
            {t(grade.label)}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {intervals[grade.id]}
          </span>
        </Button>
      ))}
    </div>
  );
}

export function EmptyDeck({ onBrowse }: { onBrowse?: () => void }) {
  const { t } = useLocale();
  return (
    <EmptyState
      title={t("Nothing due")}
      description={t(
        "All cards are scheduled for later. Come back tomorrow or add cards from a note.",
      )}
      actions={
        onBrowse ? (
          <Button variant="outline" size="sm" onClick={onBrowse}>
            {t("Browse cards")}
          </Button>
        ) : undefined
      }
    />
  );
}
