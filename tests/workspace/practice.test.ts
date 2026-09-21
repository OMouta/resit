import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  newSchedule,
  rate,
} from "../../apps/desktop/src/main/practice/scheduler";
import {
  changeCards,
  checkAnswer,
  createCards,
  deleteQuiz,
  listPractice,
  markResponse,
  rateCard,
  readQuiz,
  reviewQueue,
  saveQuiz,
  saveResponses,
  setNewCardsPerDay,
  startAttempt,
  submitAttempt,
  undoReview,
} from "../../apps/desktop/src/main/practice/store";
import {
  listTrash,
  restoreFromTrash,
} from "../../apps/desktop/src/main/workspace/trash";
import {
  createWorkspace,
  openWorkspace,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import type { Question } from "../../apps/desktop/src/shared/practice";

let directory: string;
let workspace: OpenWorkspace;
let subjectId: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-practice-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies 2026/27",
    subject: { name: "Mathematics", color: "blue" },
  });
  subjectId = snapshot(workspace).subjects[0]!.id;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const limit = {
  kind: "basic" as const,
  front: "What is $\\lim_{x \\to 0} \\frac{\\sin x}{x}$?",
  back: "$1$",
  topic: "Limits",
};

describe("flashcard scheduling", () => {
  it("gives the same schedule for the same history", () => {
    const start = new Date("2026-10-01T09:00:00Z");
    const later = new Date("2026-10-01T09:05:00Z");
    const first = rate(rate(newSchedule(start), "good", start), "good", later);
    const second = rate(rate(newSchedule(start), "good", start), "good", later);
    expect(first).toEqual(second);
    expect(Date.parse(first.due)).toBeGreaterThan(later.getTime());
  });

  it("logs a review and undoes it back to the exact earlier schedule", async () => {
    const [card] = await createCards(workspace, subjectId, [limit]);
    const before = card!.schedule;
    const { reviewId, card: rated } = await rateCard(workspace, {
      subjectId,
      cardId: card!.id,
      rating: "good",
      durationMs: 4200,
    });
    expect(rated.schedule.reps).toBe(1);

    const log = await readFile(
      join(
        workspace.root,
        "subjects",
        "mathematics",
        "practice",
        "reviews.jsonl",
      ),
      "utf8",
    );
    expect(log.trim().split("\n")).toHaveLength(1);

    const undone = await undoReview(workspace, subjectId, reviewId);
    expect(undone.schedule).toEqual(before);
    const overview = await listPractice(workspace);
    expect(overview.subjects[0]!.reviewedToday).toBe(0);
    await expect(undoReview(workspace, subjectId, reviewId)).rejects.toThrow(
      /no longer be undone/,
    );
  });

  it("refuses to undo a review once the card was rated again", async () => {
    const [card] = await createCards(workspace, subjectId, [limit]);
    const first = await rateCard(workspace, {
      subjectId,
      cardId: card!.id,
      rating: "again",
    });
    await rateCard(workspace, { subjectId, cardId: card!.id, rating: "good" });
    await expect(
      undoReview(workspace, subjectId, first.reviewId),
    ).rejects.toThrow(/changed since/);
  });

  it("keeps the assistant's cards out of review until the student keeps them", async () => {
    const [mine] = await createCards(workspace, subjectId, [limit]);
    const [suggested] = await createCards(
      workspace,
      subjectId,
      [
        {
          kind: "cloze",
          front: "The derivative of $x^2$ is {{c1::$2x$}}.",
          back: "",
        },
      ],
      { author: "assistant" },
    );
    expect(suggested!.status).toBe("suggested");
    let queue = await reviewQueue(workspace);
    expect(queue.map((item) => item.card.id)).toEqual([mine!.id]);
    expect(queue[0]!.intervals.good).toMatch(/^\d+(m|h|d)$/);

    await changeCards(workspace, subjectId, [suggested!.id], "keep");
    await changeCards(workspace, subjectId, [mine!.id], "suspend");
    queue = await reviewQueue(workspace);
    expect(queue.map((item) => item.card.id)).toEqual([suggested!.id]);
  });

  it("introduces only the day's allowance of new cards", async () => {
    await setNewCardsPerDay(workspace, 2);
    await createCards(
      workspace,
      subjectId,
      [1, 2, 3].map((index) => ({ ...limit, front: `Card ${index}` })),
    );
    const queue = await reviewQueue(workspace);
    expect(queue).toHaveLength(2);
    await rateCard(workspace, {
      subjectId,
      cardId: queue[0]!.card.id,
      rating: "easy",
    });
    // One new card was used today; one is left.
    expect(
      (await reviewQueue(workspace)).filter(
        (item) => item.card.schedule.state === "new",
      ),
    ).toHaveLength(1);

    const reopened = await openWorkspace(workspace.root);
    expect((await listPractice(reopened)).newCardsPerDay).toBe(2);
  });

  it("refuses a cloze card with nothing hidden", async () => {
    await expect(
      createCards(workspace, subjectId, [
        { kind: "cloze", front: "Nothing hidden here", back: "" },
      ]),
    ).rejects.toThrow(/hidden part/);
  });

  it("starts a card's schedule again and logs the old one", async () => {
    const [card] = await createCards(workspace, subjectId, [limit]);
    await rateCard(workspace, { subjectId, cardId: card!.id, rating: "good" });
    await changeCards(workspace, subjectId, [card!.id], "reset");
    const { subjects } = await listPractice(workspace);
    expect(subjects[0]!.cards[0]!.schedule.state).toBe("new");
    expect(subjects[0]!.cards[0]!.schedule.reps).toBe(0);
  });
});

describe("answer checking", () => {
  const short: Question = {
    id: "q1",
    kind: "short",
    prompt: "Evaluate $\\sin(\\pi/6)$.",
    answer: "1/2",
  };

  it("accepts the same number written differently", () => {
    expect(checkAnswer(short, "0.5")).toBe("correct");
    expect(checkAnswer(short, "0,5")).toBe("correct");
    expect(checkAnswer(short, " $1/2$ ")).toBe("correct");
    expect(checkAnswer(short, "0.25")).toBe("incorrect");
    expect(checkAnswer(short, "")).toBe("incorrect");
  });

  it("ignores case, accents, and spacing around operators", () => {
    const named: Question = {
      id: "q2",
      kind: "short",
      prompt: "Whose theorem?",
      answer: "Teorema de Rolle",
      accept: ["Rolle"],
    };
    expect(checkAnswer(named, "teorema  de rolle.")).toBe("correct");
    expect(checkAnswer(named, "ROLLE")).toBe("correct");
    const equation: Question = { ...short, answer: "y = 2x + 1" };
    expect(checkAnswer(equation, "y=2x+1")).toBe("correct");
    const accented: Question = { ...short, answer: "Análise" };
    expect(checkAnswer(accented, "analise")).toBe("correct");
  });

  it("leaves worked answers for the student to mark", () => {
    expect(
      checkAnswer(
        { id: "q3", kind: "worked", prompt: "Prove it.", solution: "…" },
        "Because…",
      ),
    ).toBeNull();
  });
});

describe("quizzes", () => {
  const questions = [
    {
      kind: "choice" as const,
      prompt: "Which limit equals 1?",
      options: ["$\\sin x / x$", "$x / \\sin^2 x$"],
      answer: "$\\sin x / x$",
    },
    { kind: "short" as const, prompt: "$2 + 2$?", answer: "4" },
    {
      kind: "worked" as const,
      prompt: "Differentiate $x^3$.",
      solution: "$3x^2$",
      hint: "Power rule.",
    },
  ];

  it("resumes an unfinished attempt, marks it on submit, and takes the student's own mark", async () => {
    const quiz = await saveQuiz(workspace, subjectId, {
      title: "Limits, week 1",
      topic: "Limits",
      questions,
    });
    const attempt = await startAttempt(workspace, subjectId, quiz.id);
    const [choice, sum, worked] = attempt.questions;
    await saveResponses(workspace, subjectId, quiz.id, attempt.id, {
      [choice!.id]: { answer: "$\\sin x / x$" },
    });
    const resumed = await startAttempt(workspace, subjectId, quiz.id);
    expect(resumed.id).toBe(attempt.id);
    expect(resumed.responses[choice!.id]?.answer).toBe("$\\sin x / x$");

    const submitted = await submitAttempt(
      workspace,
      subjectId,
      quiz.id,
      attempt.id,
      {
        [choice!.id]: { answer: "$\\sin x / x$" },
        [sum!.id]: { answer: "5" },
        [worked!.id]: { answer: "3x^2", hintShown: true },
      },
    );
    expect(submitted.responses[choice!.id]?.mark).toEqual({
      outcome: "correct",
      by: "check",
    });
    expect(submitted.responses[sum!.id]?.mark?.outcome).toBe("incorrect");
    expect(submitted.responses[worked!.id]?.mark).toBeUndefined();
    expect(submitted.responses[worked!.id]?.hintShown).toBe(true);

    await markResponse(workspace, subjectId, quiz.id, {
      attemptId: attempt.id,
      questionId: worked!.id,
      outcome: "correct",
    });
    const summary = (await listPractice(workspace)).subjects[0]!.quizzes[0]!;
    expect(summary.last).toMatchObject({ correct: 2, total: 3 });
    expect(summary.unfinished).toBeUndefined();

    // A new attempt starts once the last one is handed in.
    const next = await startAttempt(workspace, subjectId, quiz.id);
    expect(next.id).not.toBe(attempt.id);
  });

  it("keeps an old attempt's questions when the quiz is edited", async () => {
    const quiz = await saveQuiz(workspace, subjectId, {
      title: "Limits",
      questions,
    });
    const attempt = await startAttempt(workspace, subjectId, quiz.id);
    await submitAttempt(workspace, subjectId, quiz.id, attempt.id, {});
    await saveQuiz(workspace, subjectId, {
      id: quiz.id,
      title: "Limits, revised",
      questions: [{ kind: "short", prompt: "$3 + 3$?", answer: "6" }],
    });
    const stored = await readQuiz(workspace, subjectId, quiz.id);
    expect(stored.questions).toHaveLength(1);
    expect(stored.attempts[0]!.questions).toHaveLength(3);
  });

  it("refuses a multiple-choice question without a right option", async () => {
    await expect(
      saveQuiz(workspace, subjectId, {
        title: "Broken",
        questions: [
          { kind: "choice", prompt: "?", options: ["a", "b"], answer: "c" },
        ],
      }),
    ).rejects.toThrow(/marked right/);
  });

  it("moves a deleted quiz to the trash and brings it back", async () => {
    const quiz = await saveQuiz(workspace, subjectId, {
      title: "Limits",
      questions,
    });
    await deleteQuiz(workspace, subjectId, quiz.id);
    expect((await listPractice(workspace)).subjects[0]!.quizzes).toHaveLength(
      0,
    );
    const [entry] = await listTrash(workspace);
    expect(entry).toMatchObject({ kind: "quiz", title: "Limits" });
    await restoreFromTrash(workspace, entry!.id);
    expect((await listPractice(workspace)).subjects[0]!.quizzes).toHaveLength(
      1,
    );
  });

  it("never lists practice files as notes or documents", async () => {
    await createCards(workspace, subjectId, [limit]);
    await saveQuiz(workspace, subjectId, { title: "Limits", questions });
    const reopened = await openWorkspace(workspace.root);
    expect(snapshot(reopened).resources).toHaveLength(0);
    expect(snapshot(reopened).folders).toHaveLength(0);
  });
});
