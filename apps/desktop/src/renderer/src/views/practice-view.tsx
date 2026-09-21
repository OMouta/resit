import {
  ArrowLeftIcon,
  CheckIcon,
  ClipboardListIcon,
  LayersIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { EmptyState } from "@resit/ui/components/empty-state";
import { Input } from "@resit/ui/components/input";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { MathText } from "@resit/ui/patterns/document/math";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";
import {
  Flashcard as FlashcardView,
  ReviewControls,
  type CardState as PatternState,
} from "@resit/ui/patterns/study/flashcard";

import type {
  CardAction,
  Flashcard,
  PracticeOverview,
  QuizSummary,
  Rating,
  ReviewItem,
  SubjectPractice,
} from "../../../shared/practice";
import type {
  ResourceInfo,
  SubjectInfo,
  WorkspaceSnapshot,
} from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";
import { dueCount, reviewCounts, usePractice } from "../lib/practice";
import type { CardRequest } from "../practice/card-dialog";
import { onReviewRequest } from "./view-registry";

const NEW_PER_DAY_CHOICES = [0, 5, 10, 20, 30, 50, 100];

type Mode =
  | { kind: "overview" }
  | { kind: "review"; subjectId?: string }
  | { kind: "cards"; subjectId: string };

export interface PracticeViewProps {
  snapshot: WorkspaceSnapshot;
  /** The tab is on top. Rating keys only work then. */
  active: boolean;
  onOpenQuiz: (subjectId: string, quiz: { id: string; title: string }) => void;
  onOpenSource: (resourceId: string, page?: number) => void;
  onEditCard: (request: CardRequest) => void;
  onNewQuiz: (subjectId?: string) => void;
}

/** Flashcards and quizzes for every subject, and the review session. */
export function PracticeView(props: PracticeViewProps) {
  const { snapshot } = props;
  const subjectIds = useMemo(
    () => snapshot.subjects.map((subject) => subject.id),
    [snapshot.subjects],
  );
  const { practice, error } = usePractice(subjectIds);
  const [mode, setMode] = useState<Mode>({ kind: "overview" });

  // A study session for flashcards starts its review here.
  useEffect(
    () =>
      onReviewRequest((request) =>
        setMode({
          kind: "review",
          ...(request.subjectId ? { subjectId: request.subjectId } : {}),
        }),
      ),
    [],
  );

  if (error && !practice)
    return (
      <EmptyState
        className="h-full"
        icon={<LayersIcon />}
        title="Practice could not be read"
        description={error}
      />
    );
  if (!practice)
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-8 pt-12">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-row w-72" />
        <Skeleton className="mt-6 h-12 w-full" />
      </div>
    );

  if (mode.kind === "review")
    return (
      <ReviewSession
        {...props}
        practice={practice}
        {...(mode.subjectId ? { subjectId: mode.subjectId } : {})}
        onDone={() => setMode({ kind: "overview" })}
      />
    );
  if (mode.kind === "cards") {
    const subject = snapshot.subjects.find(
      (entry) => entry.id === mode.subjectId,
    );
    const record = practice.subjects.find(
      (entry) => entry.subjectId === mode.subjectId,
    );
    if (subject && record)
      return (
        <CardList
          {...props}
          subject={subject}
          record={record}
          onBack={() => setMode({ kind: "overview" })}
        />
      );
  }
  return (
    <Overview
      {...props}
      practice={practice}
      onReview={(subjectId) =>
        setMode({ kind: "review", ...(subjectId ? { subjectId } : {}) })
      }
      onBrowse={(subjectId) => setMode({ kind: "cards", subjectId })}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-2 text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
      {children}
    </h2>
  );
}

function SubjectDot({ subject }: { subject: SubjectInfo }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        subjectColorClasses[subject.color].dot,
      )}
    />
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function Overview({
  snapshot,
  practice,
  onReview,
  onBrowse,
  onOpenQuiz,
  onEditCard,
  onNewQuiz,
}: PracticeViewProps & {
  practice: PracticeOverview;
  onReview: (subjectId?: string) => void;
  onBrowse: (subjectId: string) => void;
}) {
  const notices = useNotices();
  const { relative } = useLocale();
  const bySubject = new Map(
    practice.subjects.map((record) => [record.subjectId, record]),
  );
  const subjects = snapshot.subjects.filter((subject) => !subject.archived);
  const { due, fresh } = reviewCounts(practice);
  const reviewedToday = practice.subjects.reduce(
    (sum, record) => sum + record.reviewedToday,
    0,
  );
  const suggested = practice.subjects.flatMap((record) =>
    record.cards
      .filter((card) => card.status === "suggested")
      .map((card) => ({ subjectId: record.subjectId, card })),
  );
  const nextDue = practice.subjects
    .flatMap((record) => record.cards)
    .filter((card) => card.status === "active" && card.schedule.state !== "new")
    .map((card) => card.schedule.due)
    .sort()[0];

  const change = async (
    subjectId: string,
    ids: string[],
    action: CardAction,
    failure: string,
  ) => {
    try {
      await api.changeCards({ subjectId, ids, action });
    } catch (error) {
      notices.fail(failure, error);
    }
  };

  const keepAll = async () => {
    const groups = new Map<string, string[]>();
    for (const { subjectId, card } of suggested)
      groups.set(subjectId, [...(groups.get(subjectId) ?? []), card.id]);
    for (const [subjectId, ids] of groups)
      await change(subjectId, ids, "keep", "The cards were not kept");
  };

  return (
    <ScrollArea className="h-full bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-8 pt-12 pb-24">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-[-0.025em]">Practice</h1>
            {reviewedToday > 0 ? (
              <p className="text-sm text-muted-foreground">
                {plural(reviewedToday, "card", "cards")} reviewed today
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={subjects.length === 0}
              onClick={() => onEditCard({})}
            >
              <PlusIcon /> New card
            </Button>
            <Button
              variant="secondary"
              disabled={subjects.length === 0}
              onClick={() => onNewQuiz()}
            >
              <PlusIcon /> New quiz
            </Button>
          </div>
        </header>

        <section
          aria-label="Review"
          className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-background px-4 py-4"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-muted-foreground">
            <LayersIcon className="size-5" />
          </span>
          <div className="flex min-w-44 flex-1 flex-col">
            <span className="text-sm font-medium">
              {due + fresh > 0
                ? `${plural(due + fresh, "card", "cards")} to review`
                : "Nothing to review right now"}
            </span>
            <span className="text-xs text-muted-foreground">
              {due + fresh > 0
                ? [
                    due > 0 ? `${due} due` : null,
                    fresh > 0 ? `${fresh} new` : null,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : nextDue
                  ? `The next card comes back ${relative(nextDue)}`
                  : "No cards yet"}
            </span>
          </div>
          <Select
            value={String(practice.newCardsPerDay)}
            onValueChange={(value) =>
              void api
                .setNewCardsPerDay(Number(value))
                .catch((error: unknown) =>
                  notices.fail("The setting was not saved", error),
                )
                .then(() => undefined)
            }
          >
            <SelectTrigger aria-label="New cards a day" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NEW_PER_DAY_CHOICES.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value === 0 ? "No new cards" : `${value} new a day`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={due + fresh === 0} onClick={() => onReview()}>
            Review
          </Button>
        </section>

        {suggested.length > 0 ? (
          <section aria-label="Suggested cards" className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>
                From the assistant · {suggested.length}
              </SectionTitle>
              <Button variant="subtle" onClick={() => void keepAll()}>
                <CheckIcon /> Keep all
              </Button>
            </div>
            <p className="px-2 pb-1 text-sm text-muted-foreground">
              These cards are not reviewed until you keep them.
            </p>
            <ul className="flex flex-col">
              {suggested.map(({ subjectId, card }) => (
                <li
                  key={card.id}
                  className="group/row flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <CardText card={card} className="flex-1" />
                  <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">
                    {
                      snapshot.subjects.find((entry) => entry.id === subjectId)
                        ?.name
                    }
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <ToolbarButton
                      label="Keep"
                      onClick={() =>
                        void change(
                          subjectId,
                          [card.id],
                          "keep",
                          "The card was not kept",
                        )
                      }
                    >
                      <CheckIcon />
                    </ToolbarButton>
                    <ToolbarButton
                      label="Edit"
                      onClick={() => onEditCard({ card, subjectId })}
                    >
                      <PencilIcon />
                    </ToolbarButton>
                    <ToolbarButton
                      label="Discard"
                      onClick={() =>
                        void change(
                          subjectId,
                          [card.id],
                          "delete",
                          "The card was not discarded",
                        )
                      }
                    >
                      <XIcon />
                    </ToolbarButton>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label="Subjects" className="flex flex-col gap-6">
          {subjects.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              Add a subject to keep cards and quizzes in it.
            </p>
          ) : null}
          {subjects.map((subject) => (
            <SubjectPracticeSection
              key={subject.id}
              subject={subject}
              record={bySubject.get(subject.id)}
              due={dueCount(practice, subject.id)}
              onReview={() => onReview(subject.id)}
              onBrowse={() => onBrowse(subject.id)}
              onNewCard={() => onEditCard({ subjectId: subject.id })}
              onNewQuiz={() => onNewQuiz(subject.id)}
              onOpenQuiz={(quiz) => onOpenQuiz(subject.id, quiz)}
            />
          ))}
        </section>
      </div>
    </ScrollArea>
  );
}

function SubjectPracticeSection({
  subject,
  record,
  due,
  onReview,
  onBrowse,
  onNewCard,
  onNewQuiz,
  onOpenQuiz,
}: {
  subject: SubjectInfo;
  record: SubjectPractice | undefined;
  due: number;
  onReview: () => void;
  onBrowse: () => void;
  onNewCard: () => void;
  onNewQuiz: () => void;
  onOpenQuiz: (quiz: QuizSummary) => void;
}) {
  const kept =
    record?.cards.filter((card) => card.status !== "suggested") ?? [];
  const quizzes = record?.quizzes ?? [];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-2">
        <SubjectDot subject={subject} />
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          {subject.name}
        </h2>
        {due > 0 ? (
          <Button variant="secondary" onClick={onReview}>
            Review {due}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="subtle"
              size="icon"
              aria-label={`${subject.name} practice`}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onNewCard}>
              <LayersIcon /> New card
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onNewQuiz}>
              <ClipboardListIcon /> New quiz
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ul className="flex flex-col">
        <li>
          <button
            type="button"
            onClick={kept.length > 0 ? onBrowse : onNewCard}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            <LayersIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm">Flashcards</span>
              <span className="truncate text-xs text-muted-foreground">
                {kept.length > 0
                  ? topicLine(kept)
                  : "No cards yet. Add the first one."}
              </span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {kept.length > 0 ? plural(kept.length, "card", "cards") : null}
            </span>
          </button>
        </li>
        {quizzes.map((quiz) => (
          <QuizRow key={quiz.id} quiz={quiz} onOpen={() => onOpenQuiz(quiz)} />
        ))}
      </ul>
    </div>
  );
}

/** "Limits 12 · Derivatives 30 · 6 without a topic". */
function topicLine(cards: Flashcard[]): string {
  const counts = new Map<string, number>();
  let loose = 0;
  for (const card of cards)
    if (card.topic) counts.set(card.topic, (counts.get(card.topic) ?? 0) + 1);
    else loose += 1;
  const parts = [...counts]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([topic, count]) => `${topic} ${count}`);
  if (loose > 0 && parts.length > 0) parts.push(`${loose} without a topic`);
  return parts.length > 0 ? parts.join(" · ") : "No topics";
}

function QuizRow({ quiz, onOpen }: { quiz: QuizSummary; onOpen: () => void }) {
  const { relative } = useLocale();
  const status = quiz.unfinished
    ? "In progress"
    : quiz.last
      ? `Last ${formatScore(quiz.last.correct)}/${quiz.last.total}, ${relative(quiz.last.at)}`
      : "Not taken yet";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
      >
        <ClipboardListIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm" title={quiz.title}>
            {quiz.title}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {[
              plural(quiz.questionCount, "question", "questions"),
              quiz.topic,
              quiz.author === "assistant" ? "made by the assistant" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-xs text-muted-foreground",
            quiz.unfinished && "font-medium text-foreground",
          )}
        >
          {status}
        </span>
      </button>
    </li>
  );
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** A card's text in one or two lines, math rendered. */
function CardText({
  card,
  className,
}: {
  card: Flashcard;
  className?: string;
}) {
  const front =
    card.kind === "cloze"
      ? card.front.replace(/\{\{c\d+::(.+?)\}\}/g, "[$1]")
      : card.front;
  return (
    <span className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <MathText
        className="line-clamp-2 text-sm"
        paragraphClassName="my-0 inline"
      >
        {front}
      </MathText>
      {card.kind === "basic" || card.back ? (
        <MathText
          className="line-clamp-1 text-xs text-muted-foreground"
          paragraphClassName="my-0 inline"
        >
          {card.back}
        </MathText>
      ) : null}
    </span>
  );
}

function patternState(card: Flashcard): PatternState {
  if (card.status === "suspended") return "suspended";
  if (card.schedule.state === "relearning") return "learning";
  return card.schedule.state;
}

function sourceLabel(
  card: Flashcard,
  resources: ReadonlyMap<string, ResourceInfo>,
): string {
  if (!card.source) return card.topic ?? "";
  const resource = resources.get(card.source.resourceId);
  if (!resource) return "Source no longer in the workspace";
  return card.source.page
    ? `${resource.title}, p. ${card.source.page}`
    : resource.title;
}

/** Rates due cards one after another until none are left. */
function ReviewSession({
  snapshot,
  practice,
  subjectId,
  active,
  onDone,
  onOpenSource,
  onEditCard,
}: PracticeViewProps & {
  practice: PracticeOverview;
  subjectId?: string;
  onDone: () => void;
}) {
  const notices = useNotices();
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [last, setLast] = useState<{
    subjectId: string;
    reviewId: string;
    item: ReviewItem;
  } | null>(null);
  const shownAt = useRef(Date.now());

  const resources = useMemo(
    () => new Map(snapshot.resources.map((entry) => [entry.id, entry])),
    [snapshot.resources],
  );
  const subjects = useMemo(
    () => new Map(snapshot.subjects.map((entry) => [entry.id, entry])),
    [snapshot.subjects],
  );

  const load = useCallback(async () => {
    try {
      setQueue(await api.getReviewQueue(subjectId ? { subjectId } : {}));
    } catch (error) {
      notices.fail("The cards could not be loaded", error);
      setQueue([]);
    }
  }, [subjectId, notices]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = queue?.[0];
  // Show the card as it is now, in case it was edited during the session.
  const card =
    (current &&
      practice.subjects
        .find((record) => record.subjectId === current.subjectId)
        ?.cards.find((entry) => entry.id === current.card.id)) ??
    current?.card;

  useEffect(() => {
    shownAt.current = Date.now();
    setRevealed(false);
  }, [current?.card.id]);

  // Space shows the answer, unless the student is typing somewhere.
  useEffect(() => {
    if (!active || !current || revealed) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== " " ||
        event.repeat ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      event.preventDefault();
      setRevealed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, current, revealed]);

  const grade = useCallback(
    async (rating: Rating) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        const result = await api.rateCard({
          subjectId: current.subjectId,
          cardId: current.card.id,
          rating,
          durationMs: Math.min(Date.now() - shownAt.current, 86_400_000),
        });
        setLast({
          subjectId: current.subjectId,
          reviewId: result.reviewId,
          item: current,
        });
        setReviewed((value) => value + 1);
        const rest = queue?.slice(1) ?? [];
        // Cards still being learned come back before the session ends.
        if (rest.length === 0) await load();
        else setQueue(rest);
      } catch (error) {
        notices.fail("The rating was not saved", error);
      } finally {
        setBusy(false);
      }
    },
    [current, busy, queue, load, notices],
  );

  const undo = async () => {
    if (!last) return;
    try {
      await api.undoReview({
        subjectId: last.subjectId,
        reviewId: last.reviewId,
      });
      setQueue((items) => [
        last.item,
        ...(items ?? []).filter((item) => item.card.id !== last.item.card.id),
      ]);
      setReviewed((value) => Math.max(0, value - 1));
      setLast(null);
    } catch (error) {
      notices.fail("The review was not undone", error);
    }
  };

  const suspend = async () => {
    if (!current) return;
    try {
      await api.changeCards({
        subjectId: current.subjectId,
        ids: [current.card.id],
        action: "suspend",
      });
      setQueue((items) => items?.slice(1) ?? []);
    } catch (error) {
      notices.fail("The card was not suspended", error);
    }
  };

  const subject = subjectId ? subjects.get(subjectId) : undefined;
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-toolbar shrink-0 items-center gap-2 border-b px-3">
        <Button variant="subtle" onClick={onDone}>
          <ArrowLeftIcon /> Practice
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {subject ? `Reviewing ${subject.name}` : "Reviewing every subject"}
        </span>
        {queue && queue.length > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {queue.length} left
          </span>
        ) : null}
        <ToolbarButton
          label="Undo the last rating"
          disabled={!last || busy}
          onClick={() => void undo()}
        >
          <Undo2Icon />
        </ToolbarButton>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-8 pt-10 pb-16">
          {queue === null ? (
            <Skeleton className="h-64 w-full rounded-panel" />
          ) : !current || !card ? (
            <EmptyState
              icon={<CheckIcon />}
              title={reviewed > 0 ? "That's all for now" : "Nothing to review"}
              description={
                reviewed > 0
                  ? `You reviewed ${plural(reviewed, "card", "cards")}.`
                  : "No cards are due."
              }
              actions={
                <Button variant="secondary" onClick={onDone}>
                  Back to practice
                </Button>
              }
            />
          ) : (
            <>
              <FlashcardView
                key={card.id}
                kind={card.kind}
                front={card.front}
                back={card.back}
                subjectName={subjects.get(current.subjectId)?.name ?? ""}
                sourceTitle={sourceLabel(card, resources)}
                state={patternState(card)}
                revealed={revealed}
                onReveal={() => setRevealed(true)}
              />
              <ReviewControls
                intervals={current.intervals}
                disabled={!revealed || busy || !active}
                onGrade={(rating) => void grade(rating)}
              />
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {card.source && resources.has(card.source.resourceId) ? (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() =>
                      card.source &&
                      onOpenSource(card.source.resourceId, card.source.page)
                    }
                  >
                    Open the source
                  </Button>
                ) : null}
                <Button
                  variant="subtle"
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    onEditCard({ card, subjectId: current.subjectId })
                  }
                >
                  <PencilIcon /> Edit
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => void suspend()}
                >
                  <PauseIcon /> Suspend
                </Button>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function stateLabel(
  card: Flashcard,
  relative: (value: Date | string) => string,
): { label: string; tone: "muted" | "info" | "warning" | "success" } {
  if (card.status === "suggested") return { label: "Suggested", tone: "info" };
  if (card.status === "suspended") return { label: "Suspended", tone: "muted" };
  if (card.schedule.state === "new") return { label: "New", tone: "info" };
  if (Date.parse(card.schedule.due) <= Date.now())
    return { label: "Due", tone: "warning" };
  return { label: `Due ${relative(card.schedule.due)}`, tone: "muted" };
}

/** Every card in one subject, to find, edit, suspend, or delete. */
function CardList({
  subject,
  record,
  onBack,
  onEditCard,
}: PracticeViewProps & {
  subject: SubjectInfo;
  record: SubjectPractice;
  onBack: () => void;
}) {
  const notices = useNotices();
  const { relative } = useLocale();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [confirming, setConfirming] = useState<string | null>(null);

  const topics = [
    ...new Set(
      record.cards.flatMap((card) => (card.topic ? [card.topic] : [])),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const words = query
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const cards = record.cards.filter((card) => {
    if (
      topic !== "all" &&
      (card.topic ?? "") !== (topic === "none" ? "" : topic)
    )
      return false;
    const text = `${card.front} ${card.back} ${card.topic ?? ""}`
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });

  const change = async (ids: string[], action: CardAction, failure: string) => {
    try {
      await api.changeCards({ subjectId: subject.id, ids, action });
    } catch (error) {
      notices.fail(failure, error);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-toolbar shrink-0 items-center gap-2 border-b px-3">
        <Button variant="subtle" onClick={onBack}>
          <ArrowLeftIcon /> Practice
        </Button>
        <SubjectDot subject={subject} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {subject.name} flashcards
        </span>
        <Button
          variant="secondary"
          onClick={() => onEditCard({ subjectId: subject.id })}
        >
          <PlusIcon /> New card
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-8 pt-8 pb-24">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground"
              />
              <Input
                aria-label="Find cards"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find cards"
                className="pl-8"
              />
            </div>
            {topics.length > 0 ? (
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger aria-label="Topic" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every topic</SelectItem>
                  {topics.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">Without a topic</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
          {cards.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              {record.cards.length === 0
                ? "No cards in this subject yet."
                : "No cards match."}
            </p>
          ) : (
            <ul className="flex flex-col">
              {cards.map((card) => {
                const state = stateLabel(card, relative);
                return (
                  <li
                    key={card.id}
                    className="flex items-start gap-2 rounded-md hover:bg-accent"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onEditCard({ card, subjectId: subject.id })
                      }
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-2 text-left focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      <CardText card={card} className="flex-1" />
                      <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                        <Badge variant={state.tone}>{state.label}</Badge>
                        {card.topic ? (
                          <span className="text-xs text-muted-foreground">
                            {card.topic}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {confirming === card.id ? (
                      <span className="flex shrink-0 items-center gap-1 py-1.5 pr-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setConfirming(null);
                            void change(
                              [card.id],
                              "delete",
                              "The card was not deleted",
                            );
                          }}
                        >
                          Delete
                        </Button>
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => setConfirming(null)}
                        >
                          Keep
                        </Button>
                      </span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="subtle"
                            size="icon"
                            className="mt-1 mr-1 shrink-0"
                            aria-label="Card actions"
                          >
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onSelect={() =>
                              onEditCard({ card, subjectId: subject.id })
                            }
                          >
                            <PencilIcon /> Edit…
                          </DropdownMenuItem>
                          {card.status === "suggested" ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                void change(
                                  [card.id],
                                  "keep",
                                  "The card was not kept",
                                )
                              }
                            >
                              <CheckIcon /> Keep
                            </DropdownMenuItem>
                          ) : card.status === "suspended" ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                void change(
                                  [card.id],
                                  "resume",
                                  "The card was not resumed",
                                )
                              }
                            >
                              <PlayIcon /> Resume
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() =>
                                void change(
                                  [card.id],
                                  "suspend",
                                  "The card was not suspended",
                                )
                              }
                            >
                              <PauseIcon /> Suspend
                            </DropdownMenuItem>
                          )}
                          {card.schedule.reps > 0 ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                void change(
                                  [card.id],
                                  "reset",
                                  "The card was not reset",
                                )
                              }
                            >
                              <RotateCcwIcon /> Start its schedule again
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setConfirming(card.id)}
                          >
                            <Trash2Icon /> Delete…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
