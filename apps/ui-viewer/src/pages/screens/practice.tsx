import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import { CalendarIcon, ClockAlertIcon, LayersIcon } from "lucide-react";
import { useState } from "react";

import { ExerciseBlock } from "@resit/ui/patterns/study/exercise-block";
import { Flashcard, ReviewControls } from "@resit/ui/patterns/study/flashcard";
import {
  QuizNavigation,
  QuizQuestion,
  type QuizQuestionStatus,
} from "@resit/ui/patterns/study/quiz";
import { StudySummaryTile } from "@resit/ui/patterns/study/study-summary";

import {
  answerFeedback,
  exercise,
  flashcards,
  quiz,
  reviewIntervals,
} from "../../fixtures/study";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { ScreenFrame, screenExample } from "./shared";

function ExerciseTab({ ctx }: { ctx: ExampleContext }) {
  const [status, setStatus] = useState<"unanswered" | "checking" | "answered">(
    "unanswered",
  );
  return (
    <ExerciseBlock
      {...exercise}
      status={status}
      feedback={answerFeedback.correct}
      onCheck={(answer) => {
        setStatus("checking");
        ctx.log("check", answer);
        window.setTimeout(() => setStatus("answered"), 700);
      }}
      onTryAgain={() => setStatus("unanswered")}
      onNext={() => ctx.log("next")}
      onOpenSource={() => ctx.log("openSource")}
    />
  );
}

function QuizTab({ ctx }: { ctx: ExampleContext }) {
  const [currentId, setCurrentId] = useState("q2");
  const [answers, setAnswers] = useState<Record<string, string>>({
    q1: "$\\delta = \\varepsilon/3$",
  });
  const [flags, setFlags] = useState<Set<string>>(new Set(["q3"]));
  const current = quiz.questions.find((question) => question.id === currentId)!;
  const index = quiz.questions.findIndex(
    (question) => question.id === currentId,
  );
  const statusOf = (id: string): QuizQuestionStatus =>
    flags.has(id) ? "flagged" : answers[id] ? "answered" : "unanswered";
  return (
    <div className="flex flex-col gap-6 rounded-panel border bg-background p-5 shadow-sm">
      <QuizNavigation
        questions={quiz.questions.map((question) => ({
          id: question.id,
          number: question.number,
          status: statusOf(question.id),
        }))}
        currentId={currentId}
        onSelect={setCurrentId}
        onPrevious={() =>
          setCurrentId(quiz.questions[Math.max(0, index - 1)]!.id)
        }
        onNext={() =>
          setCurrentId(
            quiz.questions[Math.min(quiz.questions.length - 1, index + 1)]!.id,
          )
        }
        onToggleFlag={(id) =>
          setFlags((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onSubmit={() => ctx.log("submit", answers)}
        timeRemaining="14:20"
      />
      <QuizQuestion
        number={current.number}
        text={current.text}
        kind={current.kind}
        options={current.options}
        value={answers[current.id]}
        onChange={(value) =>
          setAnswers((previous) => ({ ...previous, [current.id]: value }))
        }
      />
    </div>
  );
}

function FlashcardTab({ ctx }: { ctx: ExampleContext }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = flashcards[index % 3]!;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Card {index + 1} of 12 due
      </p>
      <Flashcard
        key={index}
        {...card}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onSuspend={() => ctx.log("suspend", card.id)}
      />
      <ReviewControls
        intervals={reviewIntervals}
        disabled={!revealed}
        onGrade={(grade) => {
          ctx.log("grade", { id: card.id, grade });
          setRevealed(false);
          setIndex((value) => value + 1);
        }}
      />
    </div>
  );
}

function Screen({ ctx }: { ctx: ExampleContext }) {
  const [tab, setTab] = useState(
    ctx.state === "quiz"
      ? "quiz"
      : ctx.state === "flashcards"
        ? "flashcards"
        : "exercise",
  );
  return (
    <ScreenFrame
      ctx={ctx}
      title="Practice — Mathematics"
      activeDestination="study"
    >
      <ScrollArea className="min-h-0 flex-1 bg-canvas">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">
                Practice
              </h1>
              <p className="text-sm text-muted-foreground">
                Exercises, quizzes, and flashcards from your Mathematics
                materials.
              </p>
            </div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList aria-label="Practice kind">
                <TabsTrigger value="exercise">Exercise</TabsTrigger>
                <TabsTrigger value="quiz">Quiz</TabsTrigger>
                <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
              </TabsList>
            </Tabs>
          </header>
          <div className="grid grid-cols-3 gap-3">
            <StudySummaryTile
              label="Due flashcards"
              value={12}
              icon={<LayersIcon />}
            />
            <StudySummaryTile
              label="Overdue"
              value={1}
              icon={<ClockAlertIcon />}
              tone="warning"
            />
            <StudySummaryTile
              label="Next assessment"
              value="15 d"
              icon={<CalendarIcon />}
              detail="Test 1"
            />
          </div>
          {tab === "exercise" ? <ExerciseTab ctx={ctx} /> : null}
          {tab === "quiz" ? <QuizTab ctx={ctx} /> : null}
          {tab === "flashcards" ? <FlashcardTab ctx={ctx} /> : null}
        </div>
      </ScrollArea>
    </ScreenFrame>
  );
}

export const page: ExamplePage = {
  section: "screens",
  slug: "practice",
  title: "Practice",
  description:
    "Exercise, quiz, and flashcard review inside the workspace, with the summary tiles above.",
  source: "packages/ui/src/patterns/study/exercise-block.tsx",
  keywords: ["practice", "exercise", "quiz", "flashcards"],
  examples: [
    {
      id: "practice",
      title: "Practice",
      ...screenExample,
      states: ["exercise", "quiz", "flashcards"],
      render: (ctx) => (
        <Screen key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
  ],
};
