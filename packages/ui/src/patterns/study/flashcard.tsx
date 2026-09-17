import { PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, type KeyboardEvent } from "react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { Kbd } from "@resit/ui/components/kbd";
import { useReducedMotion } from "@resit/ui/hooks/use-reduced-motion";
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

/** Renders cloze text: `{{c1::answer}}` hidden until revealed. */
function ClozeText({ text, revealed }: { text: string; revealed: boolean }) {
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
            aria-label="hidden"
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
      aria-label={`Flashcard, ${revealed ? "answer shown" : "question"}`}
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
          <Badge variant={stateVariant[state]} className="capitalize">
            {state}
          </Badge>
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
              Show answer <Kbd className="bg-white/20 text-white">Space</Kbd>
            </Button>
          </div>
        ) : null}
        {state === "suspended" ? (
          <div className="flex items-center justify-center gap-3 border-t pt-4 text-sm text-muted-foreground">
            <PauseIcon className="size-4" /> This card is suspended and will not
            be scheduled.
            {onResume ? (
              <Button size="sm" variant="secondary" onClick={onResume}>
                <PlayIcon /> Resume
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
          Suspend card
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
  { id: "again", label: "Again", key: "1", className: "text-destructive" },
  { id: "hard", label: "Hard", key: "2", className: "text-warning" },
  { id: "good", label: "Good", key: "3", className: "text-success" },
  { id: "easy", label: "Easy", key: "4", className: "text-link" },
];

/** Again/Hard/Good/Easy with the next interval under each. Keys 1–4. */
export function ReviewControls({
  intervals,
  onGrade,
  disabled = false,
  className,
}: ReviewControlsProps) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const grade = grades.find((entry) => entry.key === event.key);
      if (
        grade &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLInputElement)
      )
        onGrade(grade.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, onGrade]);
  return (
    <div
      role="group"
      aria-label="Rate your recall"
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
            {grade.label}
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
  return (
    <EmptyState
      title="Nothing due"
      description="All cards are scheduled for later. Come back tomorrow or add cards from a note."
      actions={
        onBrowse ? (
          <Button variant="outline" size="sm" onClick={onBrowse}>
            Browse cards
          </Button>
        ) : undefined
      }
    />
  );
}
