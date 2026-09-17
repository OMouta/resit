import {
  ArrowRightIcon,
  CheckIcon,
  LightbulbIcon,
  MinusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@resit/ui/components/button";
import { Textarea } from "@resit/ui/components/textarea";
import { cn } from "@resit/ui/lib/utils";
import { MathText } from "@resit/ui/patterns/document/math";

export type AnswerOutcome = "correct" | "partial" | "incorrect";

export interface AnswerFeedbackProps {
  outcome: AnswerOutcome;
  answer: string;
  message: string;
  nextStep?: string | undefined;
  onTryAgain?: () => void;
  onNext?: () => void;
  className?: string;
}

const outcomeMeta: Record<
  AnswerOutcome,
  { label: string; icon: typeof CheckIcon; className: string; icon_: string }
> = {
  correct: {
    label: "Correct",
    icon: CheckIcon,
    className: "border-success/30 bg-success-soft",
    icon_: "bg-success text-success-foreground",
  },
  partial: {
    label: "Partly right",
    icon: MinusIcon,
    className: "border-warning/30 bg-warning-soft",
    icon_: "bg-warning text-warning-foreground",
  },
  incorrect: {
    label: "Not yet",
    icon: XIcon,
    className: "border-destructive/30 bg-danger-soft",
    icon_: "bg-destructive text-destructive-foreground",
  },
};

/** Result of checking an answer, with the next step. */
export function AnswerFeedback({
  outcome,
  answer,
  message,
  nextStep,
  onTryAgain,
  onNext,
  className,
}: AnswerFeedbackProps) {
  const meta = outcomeMeta[outcome];
  const Icon = meta.icon;
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-lg border p-3",
        meta.className,
        className,
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          meta.icon_,
        )}
        aria-hidden
      >
        <Icon className="size-3.5" strokeWidth={3} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm font-medium">
          {meta.label}
          <span className="font-normal text-muted-foreground">
            {" "}
            · you answered{" "}
          </span>
          <code className="rounded-xs bg-background/70 px-1 font-mono text-xs">
            {answer}
          </code>
        </p>
        <MathText className="text-sm" paragraphClassName="my-0">
          {message}
        </MathText>
        {nextStep ? (
          <MathText
            className="text-sm text-muted-foreground"
            paragraphClassName="my-0"
          >{`Next: ${nextStep}`}</MathText>
        ) : null}
        <div className="mt-1 flex gap-2">
          {outcome !== "correct" && onTryAgain ? (
            <Button size="sm" variant="secondary" onClick={onTryAgain}>
              <RotateCcwIcon /> Try again
            </Button>
          ) : null}
          {onNext ? (
            <Button
              size="sm"
              variant={outcome === "correct" ? "default" : "outline"}
              onClick={onNext}
            >
              Next <ArrowRightIcon />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export interface ExerciseBlockProps {
  conceptName: string;
  subjectName: string;
  prompt: string;
  body: string;
  hint?: string | undefined;
  solution: string;
  sourceTitle: string;
  onOpenSource?: () => void;
  status: "unanswered" | "checking" | "answered";
  feedback?: AnswerFeedbackProps | undefined;
  onCheck: (answer: string) => void;
  onTryAgain?: () => void;
  onNext?: () => void;
  defaultAnswer?: string;
  className?: string;
}

/** A practice exercise: statement, answer field, hint, solution, and feedback. */
export function ExerciseBlock({
  conceptName,
  subjectName,
  prompt,
  body,
  hint,
  solution,
  sourceTitle,
  onOpenSource,
  status,
  feedback,
  onCheck,
  onTryAgain,
  onNext,
  defaultAnswer = "",
  className,
}: ExerciseBlockProps) {
  const [answer, setAnswer] = useState(defaultAnswer);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  return (
    <section
      data-slot="exercise-block"
      aria-label={`Exercise: ${conceptName}`}
      className={cn(
        "flex flex-col gap-4 rounded-panel border bg-background p-5 shadow-sm",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {subjectName} · {conceptName}
        </p>
        <button
          type="button"
          onClick={onOpenSource}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          From {sourceTitle}
        </button>
      </header>
      <div className="document max-w-none">
        <p className="text-sm font-medium text-muted-foreground">{prompt}</p>
        <MathText>{body}</MathText>
      </div>
      {status !== "answered" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (answer.trim()) onCheck(answer.trim());
          }}
        >
          <Textarea
            aria-label="Your answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Write your answer, for example (−3, 2)"
            className="min-h-20 font-mono"
            disabled={status === "checking"}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              loading={status === "checking"}
              disabled={!answer.trim()}
            >
              Check
            </Button>
            {hint ? (
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => setShowHint((value) => !value)}
                aria-expanded={showHint}
              >
                <LightbulbIcon /> {showHint ? "Hide hint" : "Show hint"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="subtle"
              size="sm"
              className="ml-auto"
              onClick={() => setShowSolution((value) => !value)}
              aria-expanded={showSolution}
            >
              {showSolution ? "Hide solution" : "Show solution"}
            </Button>
          </div>
        </form>
      ) : null}
      {showHint && hint ? (
        <MathText
          className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm"
          paragraphClassName="my-0"
        >
          {hint}
        </MathText>
      ) : null}
      {feedback && status === "answered" ? (
        <AnswerFeedback
          {...feedback}
          {...(onTryAgain ? { onTryAgain } : {})}
          {...(onNext ? { onNext } : {})}
        />
      ) : null}
      {showSolution ? (
        <div className="document max-w-none rounded-md bg-muted px-3 py-2 text-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Solution
          </p>
          <MathText>{solution}</MathText>
        </div>
      ) : null}
    </section>
  );
}
