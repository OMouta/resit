import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
  TimerIcon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
import { Label } from "@resit/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@resit/ui/components/radio-group";
import { Textarea } from "@resit/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";
import { cn } from "@resit/ui/lib/utils";
import { MathText } from "@resit/ui/patterns/document/math";

export type QuizQuestionStatus =
  "unanswered" | "answered" | "flagged" | "current";

const statusLabels: Record<QuizQuestionStatus, string> = {
  answered: msg("answered"),
  unanswered: msg("unanswered"),
  flagged: msg("flagged"),
  current: msg("current"),
};

export interface QuizNavigationProps {
  questions: { id: string; number: number; status: QuizQuestionStatus }[];
  currentId: string;
  onSelect: (id: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleFlag: (id: string) => void;
  onSubmit: () => void;
  timeRemaining?: string | undefined;
  className?: string;
}

/** Question pills, previous/next, flag, and submit with the unanswered count. */
export function QuizNavigation({
  questions,
  currentId,
  onSelect,
  onPrevious,
  onNext,
  onToggleFlag,
  onSubmit,
  timeRemaining,
  className,
}: QuizNavigationProps) {
  const { t } = useLocale();
  const index = questions.findIndex((question) => question.id === currentId);
  const current = questions[index];
  const answered = questions.filter(
    (question) => question.status === "answered",
  ).length;
  const unanswered = questions.length - answered;
  return (
    <div
      data-slot="quiz-navigation"
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex flex-wrap items-center gap-3">
        <ol aria-label={t("Questions")} className="flex flex-wrap gap-1">
          {questions.map((question) => {
            const isCurrent = question.id === currentId;
            return (
              <li key={question.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={t("Question {number}, {status}", {
                        number: question.number,
                        status: t(statusLabels[question.status]),
                      })}
                      onClick={() => onSelect(question.id)}
                      className={cn(
                        "relative flex size-8 items-center justify-center rounded-md border text-sm font-medium tabular-nums transition-colors",
                        question.status === "answered" &&
                          "border-transparent bg-success-soft text-success",
                        question.status === "unanswered" &&
                          "border-control-border bg-control text-muted-foreground",
                        question.status === "flagged" &&
                          "border-warning/50 bg-warning-soft text-warning",
                        isCurrent &&
                          "ring-2 ring-ring ring-offset-2 ring-offset-background",
                      )}
                    >
                      {question.number}
                      {question.status === "flagged" ? (
                        <FlagIcon
                          className="absolute -top-1 -right-1 size-3 fill-current"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("Question {number} · {status}", {
                      number: question.number,
                      status: t(statusLabels[question.status]),
                    })}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
        <span className="text-xs text-muted-foreground">
          {t("{answered} of {total} answered", {
            answered,
            total: questions.length,
          })}
        </span>
        {timeRemaining ? (
          <span className="ml-auto flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <TimerIcon className="size-3.5" /> {timeRemaining}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onPrevious} disabled={index <= 0}>
          <ChevronLeftIcon /> {t("Previous")}
        </Button>
        <Button
          variant="outline"
          onClick={onNext}
          disabled={index >= questions.length - 1}
        >
          {t("Next")} <ChevronRightIcon />
        </Button>
        <Button
          variant={current?.status === "flagged" ? "secondary" : "subtle"}
          aria-pressed={current?.status === "flagged"}
          onClick={() => onToggleFlag(currentId)}
        >
          <FlagIcon
            className={cn(current?.status === "flagged" && "fill-current")}
          />{" "}
          {current?.status === "flagged" ? t("Flagged") : t("Flag")}
        </Button>
        <Button className="ml-auto" onClick={onSubmit}>
          {unanswered > 0
            ? t("Submit ({count} unanswered)", { count: unanswered })
            : t("Submit")}
        </Button>
      </div>
    </div>
  );
}

export interface QuizQuestionProps {
  number: number;
  text: string;
  kind: "choice" | "open";
  options?: string[] | undefined;
  value?: string | undefined;
  onChange: (value: string) => void;
  className?: string;
}

/** One question: multiple choice or free answer. Options can contain math. */
export function QuizQuestion({
  number,
  text,
  kind,
  options,
  value,
  onChange,
  className,
}: QuizQuestionProps) {
  const { t } = useLocale();
  return (
    <fieldset
      data-slot="quiz-question"
      className={cn("flex flex-col gap-4", className)}
    >
      <legend className="sr-only">{t("Question {number}", { number })}</legend>
      <div className="document max-w-none">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("Question {number}", { number })}
        </p>
        <MathText>{text}</MathText>
      </div>
      {kind === "choice" && options ? (
        <RadioGroup
          value={value ?? ""}
          onValueChange={onChange}
          className="gap-1.5"
        >
          {options.map((option, index) => {
            const id = `q${number}-${index}`;
            return (
              <Label
                key={id}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 font-normal transition-colors hover:bg-accent",
                  value === option && "border-primary/50 bg-selection",
                )}
              >
                <RadioGroupItem id={id} value={option} />
                <MathText paragraphClassName="my-0" className="text-base">
                  {option}
                </MathText>
              </Label>
            );
          })}
        </RadioGroup>
      ) : (
        <Textarea
          aria-label={t("Answer to question {number}", { number })}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("Write your answer. Use $…$ for mathematics.")}
          className="min-h-28"
        />
      )}
    </fieldset>
  );
}
