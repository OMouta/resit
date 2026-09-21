import {
  ArrowLeftIcon,
  ClipboardListIcon,
  LightbulbIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@resit/ui/components/toggle-group";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { MathText } from "@resit/ui/patterns/document/math";
import {
  QuizNavigation,
  QuizQuestion,
  type QuizQuestionStatus,
} from "@resit/ui/patterns/study/quiz";

import {
  attemptScore,
  type Attempt,
  type Outcome,
  type Question,
  type QuizFile,
  type Response,
} from "../../../shared/practice";
import type { SubjectInfo } from "../../../shared/workspace";
import { ChatMarkdown } from "../chat/markdown";
import { api, errorMessage } from "../lib/api";
import { useNotices } from "../lib/notices";
import { formatScore } from "./practice-view";

type Answers = Record<string, Omit<Response, "mark">>;

type Screen =
  | { kind: "overview" }
  | { kind: "attempt"; attempt: Attempt }
  /** Until the quiz reloads, the attempt as submitting returned it. */
  | { kind: "results"; attempt: Attempt };

const OUTCOME_LABELS: Record<Outcome, string> = {
  correct: msg("Right"),
  partial: msg("Partly"),
  incorrect: msg("Wrong"),
};

/** One quiz: its past attempts, taking it, and the marked results. */
export function QuizView({
  subject,
  subjectId,
  quizId,
  onEdit,
  onDeleted,
}: {
  subject: SubjectInfo | undefined;
  subjectId: string;
  quizId: string;
  onEdit: (quiz: QuizFile) => void;
  onDeleted: () => void;
}) {
  const { t } = useLocale();
  const notices = useNotices();
  const [quiz, setQuiz] = useState<QuizFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "overview" });

  const load = useCallback(() => {
    api.readQuiz({ subjectId, quizId }).then(
      (next) => {
        setQuiz(next);
        setError(null);
      },
      (reason: unknown) => setError(errorMessage(reason)),
    );
  }, [subjectId, quizId]);

  useEffect(() => {
    load();
    return api.onEvent((event) => {
      if (event.type === "practice-changed" && event.subjectId === subjectId)
        load();
    });
  }, [load, subjectId]);

  if (error && !quiz)
    return (
      <EmptyState
        className="h-full"
        icon={<ClipboardListIcon />}
        title={t("This quiz is no longer here")}
        description={error}
      />
    );
  if (!quiz)
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-8 pt-12">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-row w-1/3" />
      </div>
    );

  const start = async () => {
    try {
      setScreen({
        kind: "attempt",
        attempt: await api.startAttempt({ subjectId, quizId }),
      });
    } catch (reason) {
      notices.fail(t("The quiz did not start"), reason);
    }
  };

  if (screen.kind === "attempt")
    return (
      <AttemptScreen
        quiz={quiz}
        subjectId={subjectId}
        attempt={screen.attempt}
        onLeave={() => setScreen({ kind: "overview" })}
        onSubmitted={(attempt) => setScreen({ kind: "results", attempt })}
      />
    );

  if (screen.kind === "results") {
    const stored = quiz.attempts.find(
      (attempt) => attempt.id === screen.attempt.id,
    );
    const results = stored?.submittedAt ? stored : screen.attempt;
    return (
      <ResultsScreen
        quiz={quiz}
        subjectId={subjectId}
        attempt={results}
        onBack={() => setScreen({ kind: "overview" })}
        onRetry={() => void start()}
      />
    );
  }

  return (
    <QuizOverview
      quiz={quiz}
      subject={subject}
      onStart={() => void start()}
      onEdit={() => onEdit(quiz)}
      onDelete={async () => {
        try {
          await api.deleteQuiz({ subjectId, quizId });
          onDeleted();
        } catch (reason) {
          notices.fail(t("The quiz was not moved to the trash"), reason);
        }
      }}
      onOpenResults={(attempt) => setScreen({ kind: "results", attempt })}
    />
  );
}

function QuizOverview({
  quiz,
  subject,
  onStart,
  onEdit,
  onDelete,
  onOpenResults,
}: {
  quiz: QuizFile;
  subject: SubjectInfo | undefined;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onOpenResults: (attempt: Attempt) => void;
}) {
  const { t, dateTime } = useLocale();
  const unfinished = quiz.attempts.find((attempt) => !attempt.submittedAt);
  const submitted = quiz.attempts
    .filter((attempt) => attempt.submittedAt)
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  const answered = unfinished
    ? Object.values(unfinished.responses).filter((entry) => entry.answer.trim())
        .length
    : 0;
  return (
    <ScrollArea className="h-full bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pt-12 pb-24">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {subject ? (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    subjectColorClasses[subject.color].dot,
                  )}
                />
                <span>{subject.name}</span>
              </>
            ) : null}
            {quiz.topic ? <span>· {quiz.topic}</span> : null}
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.025em] break-words">
            {quiz.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {quiz.questions.length === 1
              ? t("1 question")
              : t("{count} questions", { count: quiz.questions.length })}
            {quiz.author === "assistant"
              ? ` · ${t("made by the assistant")}`
              : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button size="lg" onClick={onStart}>
              {unfinished
                ? t("Continue ({answered} of {total} answered)", {
                    answered,
                    total: unfinished.questions.length,
                  })
                : submitted.length > 0
                  ? t("Take it again")
                  : t("Start")}
            </Button>
            <Button size="lg" variant="secondary" onClick={onEdit}>
              <PencilIcon /> {t("Edit")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-lg"
                  variant="subtle"
                  aria-label={t("Quiz actions")}
                >
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => void onDelete()}
                >
                  <Trash2Icon /> {t("Move to trash")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {submitted.length > 0 ? (
          <section aria-label={t("Attempts")} className="flex flex-col gap-1">
            <h2 className="px-2 text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {t("Attempts")}
            </h2>
            <ul className="flex flex-col">
              {submitted.map((attempt) => {
                const score = attemptScore(attempt);
                const unmarked = attempt.questions.filter(
                  (question) => !attempt.responses[question.id]?.mark,
                ).length;
                return (
                  <li key={attempt.id}>
                    <button
                      type="button"
                      onClick={() => onOpenResults(attempt)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm tabular-nums">
                        {dateTime(attempt.submittedAt ?? attempt.updatedAt)}
                      </span>
                      {unmarked > 0 ? (
                        <span className="text-xs font-medium text-warning">
                          {t("{count} to mark", { count: unmarked })}
                        </span>
                      ) : null}
                      <span className="w-16 text-right text-sm font-medium tabular-nums">
                        {formatScore(score.correct)}/{score.total}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}

function answersOf(attempt: Attempt): Answers {
  const answers: Answers = {};
  for (const [id, response] of Object.entries(attempt.responses))
    answers[id] = {
      answer: response.answer,
      ...(response.flagged ? { flagged: true } : {}),
      ...(response.hintShown ? { hintShown: true } : {}),
    };
  return answers;
}

/** Answering, one question at a time. Answers save as they are typed. */
function AttemptScreen({
  quiz,
  subjectId,
  attempt,
  onLeave,
  onSubmitted,
}: {
  quiz: QuizFile;
  subjectId: string;
  attempt: Attempt;
  onLeave: () => void;
  onSubmitted: (attempt: Attempt) => void;
}) {
  const { t } = useLocale();
  const notices = useNotices();
  const [answers, setAnswers] = useState<Answers>(() => answersOf(attempt));
  const [currentId, setCurrentId] = useState(
    () =>
      attempt.questions.find((question) => !attempt.responses[question.id])
        ?.id ??
      attempt.questions[0]?.id ??
      "",
  );
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef<Answers | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    try {
      await api.saveResponses({
        subjectId,
        quizId: quiz.id,
        attemptId: attempt.id,
        responses: next,
      });
    } catch (reason) {
      notices.fail(t("Your answers were not saved"), reason);
    }
  }, [t, subjectId, quiz.id, attempt.id, notices]);

  // Whatever is still unsaved goes when the attempt closes.
  useEffect(() => () => void flush(), [flush]);

  const change = (id: string, patch: Partial<Omit<Response, "mark">>) =>
    setAnswers((current) => {
      const next = {
        ...current,
        [id]: { answer: "", ...current[id], ...patch },
      };
      pending.current = next;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 500);
      return next;
    });

  const questions = attempt.questions;
  const index = questions.findIndex((question) => question.id === currentId);
  const question = questions[index];
  const status = (entry: Question): QuizQuestionStatus => {
    const response = answers[entry.id];
    if (response?.flagged) return "flagged";
    return response?.answer.trim() ? "answered" : "unanswered";
  };

  const submit = async () => {
    window.clearTimeout(timer.current);
    pending.current = null;
    setSubmitting(true);
    try {
      onSubmitted(
        await api.submitAttempt({
          subjectId,
          quizId: quiz.id,
          attemptId: attempt.id,
          responses: answers,
        }),
      );
    } catch (reason) {
      notices.fail(t("The quiz was not handed in"), reason);
      setSubmitting(false);
    }
  };

  if (!question) return null;
  const response = answers[question.id];
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-toolbar shrink-0 items-center gap-2 border-b px-3">
        <Button
          variant="subtle"
          onClick={() => {
            void flush();
            onLeave();
          }}
        >
          <ArrowLeftIcon /> {t("Quiz")}
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {quiz.title}
        </span>
        {submitting ? (
          <span className="text-xs text-muted-foreground">
            {t("Handing in…")}
          </span>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pt-8 pb-24">
          <QuizNavigation
            questions={questions.map((entry, at) => ({
              id: entry.id,
              number: at + 1,
              status: status(entry),
            }))}
            currentId={question.id}
            onSelect={setCurrentId}
            onPrevious={() =>
              setCurrentId(questions[Math.max(0, index - 1)]!.id)
            }
            onNext={() =>
              setCurrentId(
                questions[Math.min(questions.length - 1, index + 1)]!.id,
              )
            }
            onToggleFlag={(id) =>
              change(id, { flagged: !answers[id]?.flagged })
            }
            onSubmit={() => void submit()}
          />
          <QuizQuestion
            key={question.id}
            number={index + 1}
            text={question.prompt}
            kind={question.kind === "choice" ? "choice" : "open"}
            options={question.options}
            value={response?.answer}
            onChange={(value) => change(question.id, { answer: value })}
          />
          {question.hint ? (
            response?.hintShown ? (
              <MathText
                className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm"
                paragraphClassName="my-0"
              >
                {question.hint}
              </MathText>
            ) : (
              <Button
                variant="subtle"
                className="self-start"
                onClick={() => change(question.id, { hintShown: true })}
              >
                <LightbulbIcon /> {t("Show a hint")}
              </Button>
            )
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

/** The marked attempt, with solutions, and the student's own marks. */
function ResultsScreen({
  quiz,
  subjectId,
  attempt,
  onBack,
  onRetry,
}: {
  quiz: QuizFile;
  subjectId: string;
  attempt: Attempt;
  onBack: () => void;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  const notices = useNotices();
  const score = attemptScore(attempt);
  const unmarked = attempt.questions.filter(
    (question) => !attempt.responses[question.id]?.mark,
  ).length;

  const mark = async (questionId: string, outcome: Outcome) => {
    try {
      await api.markResponse({
        subjectId,
        quizId: quiz.id,
        attemptId: attempt.id,
        questionId,
        outcome,
      });
    } catch (reason) {
      notices.fail(t("The mark was not saved"), reason);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-toolbar shrink-0 items-center gap-2 border-b px-3">
        <Button variant="subtle" onClick={onBack}>
          <ArrowLeftIcon /> {t("Quiz")}
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {quiz.title}
        </span>
        <Button variant="secondary" onClick={onRetry}>
          <RotateCcwIcon /> {t("Try again")}
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 pt-10 pb-24">
          <header className="flex flex-col gap-1">
            <p className="text-4xl font-bold tabular-nums tracking-[-0.025em]">
              {formatScore(score.correct)}
              <span className="text-muted-foreground"> / {score.total}</span>
            </p>
            <p
              className={cn(
                "text-sm text-muted-foreground",
                unmarked > 0 && "font-medium text-warning",
              )}
            >
              {unmarked > 0
                ? unmarked === 1
                  ? t(
                      "{count} answer needs your mark. Compare with the solution below.",
                      { count: 1 },
                    )
                  : t(
                      "{count} answers need your mark. Compare with the solution below.",
                      { count: unmarked },
                    )
                : t("Every answer is marked.")}
            </p>
          </header>
          <ol className="flex flex-col gap-4">
            {attempt.questions.map((question, index) => (
              <ResultItem
                key={question.id}
                number={index + 1}
                question={question}
                response={attempt.responses[question.id]}
                onMark={(outcome) => void mark(question.id, outcome)}
              />
            ))}
          </ol>
        </div>
      </ScrollArea>
    </div>
  );
}

function ResultItem({
  number,
  question,
  response,
  onMark,
}: {
  number: number;
  question: Question;
  response: Response | undefined;
  onMark: (outcome: Outcome) => void;
}) {
  const { t } = useLocale();
  const outcome = response?.mark?.outcome;
  const answer = response?.answer.trim() ?? "";
  const right = question.answer;
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background p-4",
        outcome === "correct" && "border-success/30",
        outcome === "partial" && "border-warning/40",
        outcome === "incorrect" && "border-destructive/30",
        !outcome && "border-warning/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Question {number}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {response?.mark?.by === "check"
              ? t("Marked by resit")
              : response?.mark
                ? t("Your mark")
                : t("Mark it")}
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={outcome ?? ""}
            onValueChange={(value) => {
              if (value) onMark(value as Outcome);
            }}
            aria-label={t("Mark question {number}", { number })}
          >
            {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((entry) => (
              <ToggleGroupItem
                key={entry}
                value={entry}
                className={cn(
                  "px-3",
                  entry === "correct" && "data-[state=on]:text-success",
                  entry === "partial" && "data-[state=on]:text-warning",
                  entry === "incorrect" && "data-[state=on]:text-destructive",
                )}
              >
                {t(OUTCOME_LABELS[entry])}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      <MathText className="document max-w-none">{question.prompt}</MathText>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Your answer{response?.hintShown ? " · used the hint" : ""}
          </span>
          {answer ? (
            <MathText paragraphClassName="my-0">{answer}</MathText>
          ) : (
            <span className="text-muted-foreground">{t("No answer")}</span>
          )}
        </div>
        {right ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {question.kind === "worked"
                ? t("Final answer")
                : t("Right answer")}
            </span>
            <MathText paragraphClassName="my-0">{right}</MathText>
          </div>
        ) : null}
      </div>
      {question.solution ? (
        <div className="document max-w-none rounded-md bg-muted/60 px-3 py-2 text-sm">
          <ChatMarkdown text={question.solution} />
        </div>
      ) : null}
    </li>
  );
}
