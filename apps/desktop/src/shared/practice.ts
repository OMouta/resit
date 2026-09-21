import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });

export const CARD_KIND_VALUES = ["basic", "cloze"] as const;
export const cardKindSchema = z.enum(CARD_KIND_VALUES);
export type CardKind = z.infer<typeof cardKindSchema>;

export const RATING_VALUES = ["again", "hard", "good", "easy"] as const;
export const ratingSchema = z.enum(RATING_VALUES);
export type Rating = z.infer<typeof ratingSchema>;

export const CARD_STATE_VALUES = [
  "new",
  "learning",
  "review",
  "relearning",
] as const;
export type CardState = (typeof CARD_STATE_VALUES)[number];

/** Where a card or question came from: a page, or one highlight on it. */
export const practiceSourceSchema = z.object({
  resourceId: z.string().min(1).max(200),
  /** One-based page number, for PDFs. */
  page: z.number().int().positive().optional(),
  annotationId: z.string().min(1).max(200).optional(),
});
export type PracticeSource = z.infer<typeof practiceSourceSchema>;

/** A card's place in the FSRS schedule. */
export const cardScheduleSchema = z.object({
  state: z.enum(CARD_STATE_VALUES),
  due: timestamp,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  scheduledDays: z.number().nonnegative(),
  learningSteps: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  lastReview: timestamp.optional(),
});
export type CardSchedule = z.infer<typeof cardScheduleSchema>;

/**
 * `suggested` cards came from the assistant and wait for the student to keep
 * them. Only `active` cards are reviewed.
 */
export const CARD_STATUS_VALUES = ["suggested", "active", "suspended"] as const;
export type CardStatus = (typeof CARD_STATUS_VALUES)[number];

export const flashcardSchema = z.looseObject({
  id: z.string().min(1),
  kind: cardKindSchema,
  /** The question, or for a cloze card the text with `{{c1::hidden}}` parts. */
  front: z.string(),
  /** The answer, or extra text shown after a cloze card is revealed. */
  back: z.string(),
  topic: z.string().optional(),
  source: practiceSourceSchema.optional().catch(undefined),
  author: z.literal("assistant").optional().catch(undefined),
  status: z.enum(CARD_STATUS_VALUES).catch("active"),
  schedule: cardScheduleSchema,
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Flashcard = z.infer<typeof flashcardSchema>;

/** `subjects/<folder>/practice/cards.json`. */
export const cardsFileSchema = z.looseObject({
  format: z.literal("resit-cards"),
  formatVersion: z.number().int().positive(),
  /** The scheduler the stored schedules were computed with. */
  scheduler: z.looseObject({
    algorithm: z.string(),
    version: z.string(),
    retention: z.number(),
  }),
  cards: z.array(flashcardSchema),
});
export type CardsFile = z.infer<typeof cardsFileSchema>;

/**
 * One line of `subjects/<folder>/practice/reviews.jsonl`. Lines are only ever
 * appended: undoing a review adds an `undo` line naming it.
 */
export const reviewEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("review"),
    id: z.string().min(1),
    cardId: z.string().min(1),
    rating: ratingSchema,
    at: timestamp,
    /** How long the card was on screen before the rating, if known. */
    durationMs: z.number().int().nonnegative().optional(),
    previous: cardScheduleSchema,
    next: cardScheduleSchema,
  }),
  z.object({
    type: z.literal("undo"),
    reviewId: z.string().min(1),
    at: timestamp,
  }),
  z.object({
    type: z.literal("reset"),
    cardId: z.string().min(1),
    at: timestamp,
    previous: cardScheduleSchema,
  }),
]);
export type ReviewEvent = z.infer<typeof reviewEventSchema>;

export const QUESTION_KIND_VALUES = ["choice", "short", "worked"] as const;
export const questionKindSchema = z.enum(QUESTION_KIND_VALUES);
export type QuestionKind = z.infer<typeof questionKindSchema>;

/**
 * A multiple-choice question is marked by its `answer`, one of its options.
 * A short answer is marked against `answer` and `accept`. A worked answer is
 * marked by the student against the solution.
 */
export const questionSchema = z.looseObject({
  id: z.string().min(1),
  kind: questionKindSchema,
  prompt: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
  /** Other short answers that count as right. */
  accept: z.array(z.string()).optional(),
  hint: z.string().optional(),
  solution: z.string().optional(),
  topic: z.string().optional(),
  source: practiceSourceSchema.optional().catch(undefined),
});
export type Question = z.infer<typeof questionSchema>;

export const OUTCOME_VALUES = ["correct", "partial", "incorrect"] as const;
export const outcomeSchema = z.enum(OUTCOME_VALUES);
export type Outcome = z.infer<typeof outcomeSchema>;

export const responseSchema = z.object({
  answer: z.string(),
  flagged: z.boolean().optional(),
  hintShown: z.boolean().optional(),
  /** Set once the attempt is submitted, or when the student marks it. */
  mark: z
    .object({
      outcome: outcomeSchema,
      /** `check` compared the answer; `student` is the student's own mark. */
      by: z.enum(["check", "student"]),
    })
    .optional(),
});
export type Response = z.infer<typeof responseSchema>;

/**
 * One go at a quiz. It keeps the questions as they were, so editing the quiz
 * later never changes what an old attempt answered.
 */
export const attemptSchema = z.looseObject({
  id: z.string().min(1),
  questions: z.array(questionSchema),
  responses: z.record(z.string(), responseSchema),
  startedAt: timestamp,
  updatedAt: timestamp,
  submittedAt: timestamp.optional(),
});
export type Attempt = z.infer<typeof attemptSchema>;

/** `subjects/<folder>/practice/quizzes/<id>.json`: a quiz and its attempts. */
export const quizFileSchema = z.looseObject({
  format: z.literal("resit-quiz"),
  formatVersion: z.number().int().positive(),
  id: z.string().min(1),
  title: z.string().min(1),
  topic: z.string().optional(),
  author: z.literal("assistant").optional().catch(undefined),
  questions: z.array(questionSchema),
  attempts: z.array(attemptSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type QuizFile = z.infer<typeof quizFileSchema>;

export interface QuizSummary {
  id: string;
  subjectId: string;
  title: string;
  topic?: string;
  author?: "assistant";
  questionCount: number;
  /** The newest submitted attempt's score. */
  last?: { correct: number; total: number; at: string };
  /** An attempt that was started and not submitted. */
  unfinished?: boolean;
  updatedAt: string;
}

export interface CardInput {
  kind: CardKind;
  front: string;
  back: string;
  topic?: string | undefined;
  source?: PracticeSource | undefined;
}

/** What the student can do to cards from the card list. */
export const CARD_ACTION_VALUES = [
  "keep",
  "suspend",
  "resume",
  "reset",
  "delete",
] as const;
export type CardAction = (typeof CARD_ACTION_VALUES)[number];

export interface QuestionInput {
  /** Kept when editing, so answers in unfinished attempts still line up. */
  id?: string | undefined;
  kind: QuestionKind;
  prompt: string;
  options?: string[] | undefined;
  answer?: string | undefined;
  accept?: string[] | undefined;
  hint?: string | undefined;
  solution?: string | undefined;
  topic?: string | undefined;
  source?: PracticeSource | undefined;
}

export interface PracticeOverview {
  newCardsPerDay: number;
  subjects: SubjectPractice[];
}

export interface SubjectPractice {
  subjectId: string;
  cards: Flashcard[];
  quizzes: QuizSummary[];
  /** Cards rated today, and how many of those were new. */
  reviewedToday: number;
  newToday: number;
}

/** A card ready to review, with the interval each rating would give it. */
export interface ReviewItem {
  subjectId: string;
  card: Flashcard;
  intervals: Record<Rating, string>;
}

/** New cards introduced per day when nothing else is set. */
export const DEFAULT_NEW_CARDS_PER_DAY = 20;

/** The hidden parts of a cloze card's text. */
export const CLOZE_PATTERN = /\{\{c\d+::(.+?)\}\}/g;

export function hasCloze(text: string): boolean {
  return new RegExp(CLOZE_PATTERN.source).test(text);
}

/** How many of an attempt's answers were marked right, counting partial as half. */
export function attemptScore(attempt: Attempt): {
  correct: number;
  total: number;
} {
  let correct = 0;
  for (const question of attempt.questions) {
    const outcome = attempt.responses[question.id]?.mark?.outcome;
    if (outcome === "correct") correct += 1;
    else if (outcome === "partial") correct += 0.5;
  }
  return { correct, total: attempt.questions.length };
}
