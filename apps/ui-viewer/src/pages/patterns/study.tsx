import { Button } from "@resit/ui/components/button";
import { CalendarIcon, ClockAlertIcon, LayersIcon } from "lucide-react";
import { useState } from "react";

import { AgendaItem } from "@resit/ui/patterns/study/agenda-item";
import {
  AssessmentCard,
  CalendarActivityCard,
  WeekGrid,
} from "@resit/ui/patterns/study/calendar";
import {
  EvidenceList,
  EvidenceRow,
} from "@resit/ui/patterns/study/evidence-row";
import {
  ExerciseBlock,
  type AnswerFeedbackProps,
} from "@resit/ui/patterns/study/exercise-block";
import {
  EmptyDeck,
  Flashcard,
  ReviewControls,
} from "@resit/ui/patterns/study/flashcard";
import {
  LevelChip,
  type ConceptLevel,
} from "@resit/ui/patterns/study/level-chip";
import {
  ConceptLevelRow,
  ProfileProposal,
} from "@resit/ui/patterns/study/profile-proposal";
import {
  QuizNavigation,
  QuizQuestion,
  type QuizQuestionStatus,
} from "@resit/ui/patterns/study/quiz";
import { StudySummaryTile } from "@resit/ui/patterns/study/study-summary";

import {
  agenda,
  answerFeedback,
  evidence,
  exercise,
  flashcards,
  learnerProfile,
  profileProposals,
  quiz,
  reviewIntervals,
  weekPlan,
} from "../../fixtures/study";
import { FIXTURE_NOW } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

function ExerciseExample({ ctx }: { ctx: ExampleContext }) {
  const [status, setStatus] = useState<"unanswered" | "checking" | "answered">(
    ctx.state === "unanswered" ? "unanswered" : "answered",
  );
  const outcome = (
    ctx.state === "correct" ||
    ctx.state === "partial" ||
    ctx.state === "incorrect"
      ? ctx.state
      : "correct"
  ) as keyof typeof answerFeedback;
  const feedback: AnswerFeedbackProps = answerFeedback[outcome];
  return (
    <ExerciseBlock
      {...exercise}
      status={ctx.state === "checking" ? "checking" : status}
      feedback={feedback}
      defaultAnswer={status === "answered" ? feedback.answer : ""}
      onCheck={(answer) => {
        setStatus("checking");
        ctx.log("onCheck", answer);
        window.setTimeout(() => setStatus("answered"), 700);
      }}
      onTryAgain={() => {
        setStatus("unanswered");
        ctx.log("onTryAgain");
      }}
      onNext={() => ctx.log("onNext")}
      onOpenSource={() => ctx.log("onOpenSource")}
    />
  );
}

function QuizExample({ ctx }: { ctx: ExampleContext }) {
  const [currentId, setCurrentId] = useState(
    ctx.state === "open" ? "q2" : "q1",
  );
  const [statuses, setStatuses] = useState<Record<string, QuizQuestionStatus>>(
    Object.fromEntries(
      quiz.questions.map((question) => [
        question.id,
        question.status === "current" ? "unanswered" : question.status,
      ]),
    ),
  );
  const [answers, setAnswers] = useState<Record<string, string>>({
    q1: "$\\delta = \\varepsilon/3$",
  });
  const current = quiz.questions.find((question) => question.id === currentId)!;
  const index = quiz.questions.findIndex(
    (question) => question.id === currentId,
  );
  const move = (delta: number) =>
    setCurrentId(
      quiz.questions[
        Math.max(0, Math.min(quiz.questions.length - 1, index + delta))
      ]!.id,
    );
  return (
    <div className="flex flex-col gap-6">
      <QuizNavigation
        questions={quiz.questions.map((question) => ({
          id: question.id,
          number: question.number,
          status: statuses[question.id] ?? "unanswered",
        }))}
        currentId={currentId}
        onSelect={setCurrentId}
        onPrevious={() => move(-1)}
        onNext={() => move(1)}
        onToggleFlag={(id) =>
          setStatuses((previous) => ({
            ...previous,
            [id]:
              previous[id] === "flagged"
                ? answers[id]
                  ? "answered"
                  : "unanswered"
                : "flagged",
          }))
        }
        onSubmit={() => ctx.log("onSubmit", answers)}
        timeRemaining="14:20"
      />
      <QuizQuestion
        number={current.number}
        text={current.text}
        kind={current.kind}
        options={current.options}
        value={answers[current.id]}
        onChange={(value) => {
          setAnswers((previous) => ({ ...previous, [current.id]: value }));
          setStatuses((previous) => ({
            ...previous,
            [current.id]: value ? "answered" : "unanswered",
          }));
          ctx.log("onChange", { id: current.id, value });
        }}
      />
    </div>
  );
}

function FlashcardExample({ ctx }: { ctx: ExampleContext }) {
  const card =
    flashcards[
      ctx.state === "cloze"
        ? 1
        : ctx.state === "suspended"
          ? 3
          : ctx.state === "code"
            ? 2
            : 0
    ]!;
  const [revealed, setRevealed] = useState(false);
  if (ctx.state === "empty")
    return <EmptyDeck onBrowse={() => ctx.log("onBrowse")} />;
  return (
    <div className="flex flex-col gap-4">
      <Flashcard
        kind={card.kind}
        front={card.front}
        back={card.back}
        subjectName={card.subjectName}
        sourceTitle={card.sourceTitle}
        state={card.state}
        revealed={revealed}
        onReveal={() => {
          setRevealed(true);
          ctx.log("onReveal");
        }}
        onResume={() => ctx.log("onResume")}
        onSuspend={() => ctx.log("onSuspend")}
      />
      {card.state !== "suspended" ? (
        <ReviewControls
          intervals={reviewIntervals}
          disabled={!revealed}
          onGrade={(grade) => {
            ctx.log("onGrade", grade);
            setRevealed(false);
          }}
        />
      ) : null}
    </div>
  );
}

const cardsByDay = new Map<string, typeof agenda>();
for (const item of agenda) {
  const day = item.start.slice(0, 10);
  cardsByDay.set(day, [...(cardsByDay.get(day) ?? []), item]);
}

export const page: ExamplePage = {
  section: "patterns",
  group: "Study",
  slug: "study",
  title: "Study and learner patterns",
  description:
    "Evidence, profile proposals, exercises with feedback, quizzes, flashcards, and the plan. Dates and numbers follow the locale control.",
  source: "packages/ui/src/patterns/study/flashcard.tsx",
  keywords: [
    "learner",
    "profile",
    "exercise",
    "quiz",
    "flashcard",
    "review",
    "agenda",
    "calendar",
    "plan",
  ],
  examples: [
    {
      id: "evidence",
      title: "Evidence",
      width: 520,
      states: ["default", "empty"],
      render: (ctx) => (
        <EvidenceList empty={ctx.state === "empty"}>
          {evidence.map((entry) => (
            <EvidenceRow
              key={entry.id}
              {...entry}
              now={FIXTURE_NOW}
              actions={
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => ctx.log("onOpenSource", entry.id)}
                >
                  Open
                </Button>
              }
            />
          ))}
        </EvidenceList>
      ),
    },
    {
      id: "proposals",
      title: "Profile proposals",
      description:
        "Proposed, accepted, and rejected. Correct opens a level picker before accepting.",
      width: 560,
      render: (ctx) => (
        <div className="flex flex-col gap-3">
          {profileProposals.map((proposal) => (
            <ProfileProposal
              key={proposal.id}
              {...proposal}
              evidenceCount={proposal.evidenceIds.length}
              now={FIXTURE_NOW}
              onAccept={(id, level) => ctx.log("onAccept", { id, level })}
              onReject={(id) => ctx.log("onReject", id)}
            >
              {evidence
                .filter((entry) => proposal.evidenceIds.includes(entry.id))
                .map((entry) => (
                  <EvidenceRow key={entry.id} {...entry} now={FIXTURE_NOW} />
                ))}
            </ProfileProposal>
          ))}
        </div>
      ),
    },
    {
      id: "profile",
      title: "Learner profile rows",
      width: 560,
      render: (ctx) => (
        <div className="flex flex-col">
          <div className="mb-2 flex flex-wrap gap-2">
            {(["unknown", "gap", "developing", "secure"] as ConceptLevel[]).map(
              (level) => (
                <LevelChip key={level} level={level} />
              ),
            )}
          </div>
          {learnerProfile.concepts.map((concept) => (
            <ConceptLevelRow
              key={concept.id}
              id={concept.id}
              name={concept.name}
              subjectName={concept.subjectName}
              level={concept.level}
              lastEvidenceAt={concept.lastEvidence}
              now={FIXTURE_NOW}
              onEdit={(id) => ctx.log("onEdit", id)}
              onDelete={(id) => ctx.log("onDelete", id)}
            />
          ))}
        </div>
      ),
    },
    {
      id: "exercise",
      title: "Exercise",
      width: 620,
      states: ["unanswered", "checking", "correct", "partial", "incorrect"],
      render: (ctx) => (
        <ExerciseExample key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
    {
      id: "quiz",
      title: "Quiz",
      width: 640,
      states: ["choice", "open"],
      render: (ctx) => (
        <QuizExample key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
    {
      id: "flashcards",
      title: "Flashcards",
      description: "Space reveals the answer; keys 1–4 grade it.",
      width: 560,
      states: ["basic", "cloze", "code", "suspended", "empty"],
      render: (ctx) => (
        <FlashcardExample key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
    {
      id: "agenda",
      title: "Agenda items",
      width: 560,
      states: ["default", "empty"],
      render: (ctx) =>
        ctx.state === "empty" ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing planned today. Free time or add a session.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {agenda.map((item) => (
              <AgendaItem
                key={item.id}
                {...item}
                onStart={(id) => ctx.log("onStart", id)}
                onContinue={(id) => ctx.log("onContinue", id)}
                onComplete={(id) => ctx.log("onComplete", id)}
                onReschedule={(id) => ctx.log("onReschedule", id)}
                onResume={(id) => ctx.log("onResume", id)}
              />
            ))}
          </div>
        ),
    },
    {
      id: "summary",
      title: "Summary tiles",
      width: 560,
      render: (ctx) => (
        <div className="grid grid-cols-3 gap-3">
          <StudySummaryTile
            label="Due flashcards"
            value={12}
            detail="Mathematics 9 · Physics 3"
            icon={<LayersIcon />}
            onClick={() => ctx.log("open", "flashcards")}
          />
          <StudySummaryTile
            label="Overdue"
            value={1}
            detail="Assignment 2"
            icon={<ClockAlertIcon />}
            tone="warning"
            onClick={() => ctx.log("open", "overdue")}
          />
          <StudySummaryTile
            label="Next assessment"
            value="15 d"
            detail="Test 1 — Análise Matemática I"
            icon={<CalendarIcon />}
          />
        </div>
      ),
    },
    {
      id: "week",
      title: "Week plan",
      width: "full",
      render: (ctx) => (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {weekPlan.assessments.map((assessment) => (
              <AssessmentCard
                key={assessment.id}
                {...assessment}
                now={FIXTURE_NOW}
                onOpen={() => ctx.log("onOpenAssessment", assessment.id)}
              />
            ))}
          </div>
          <WeekGrid
            days={weekPlan.days}
            today="2026-09-17"
            availability={weekPlan.availability}
          >
            {(day) =>
              (cardsByDay.get(day) ?? []).map((item) => (
                <CalendarActivityCard
                  key={item.id}
                  {...item}
                  onOpen={() => ctx.log("onOpen", item.id)}
                />
              ))
            }
          </WeekGrid>
        </div>
      ),
    },
  ],
};
