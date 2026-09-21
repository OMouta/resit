import {
  createEmptyCard,
  fsrs,
  FSRSVersion,
  Rating as FsrsRating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";

import type { CardSchedule, CardState, Rating } from "../../shared/practice";

/** How often a student should still remember a card when it comes due. */
export const RETENTION = 0.9;

/** Without fuzz, the same history always gives the same schedule. */
const scheduler = fsrs({
  request_retention: RETENTION,
  enable_fuzz: false,
  enable_short_term: true,
});

export const SCHEDULER_INFO = {
  algorithm: "FSRS",
  version: FSRSVersion,
  retention: RETENTION,
};

const STATES: Record<State, CardState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

const FSRS_STATES: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const GRADES: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

function toSchedule(card: Card): CardSchedule {
  return {
    state: STATES[card.state],
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    ...(card.last_review ? { lastReview: card.last_review.toISOString() } : {}),
  };
}

function toCard(schedule: CardSchedule): Card {
  return {
    state: FSRS_STATES[schedule.state],
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    // Deprecated in ts-fsrs and recomputed from the last review.
    elapsed_days: 0,
    scheduled_days: schedule.scheduledDays,
    learning_steps: schedule.learningSteps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    ...(schedule.lastReview
      ? { last_review: new Date(schedule.lastReview) }
      : {}),
  };
}

/** A card nobody has reviewed, due straight away. */
export function newSchedule(now: Date): CardSchedule {
  return toSchedule(createEmptyCard(now));
}

export function rate(
  schedule: CardSchedule,
  rating: Rating,
  now: Date,
): CardSchedule {
  return toSchedule(scheduler.next(toCard(schedule), now, GRADES[rating]).card);
}

/** "10m", "4d", "3mo": how long until the card comes back. */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(0, (to.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}

/** The interval each rating would give the card if it were rated now. */
export function previewIntervals(
  schedule: CardSchedule,
  now: Date,
): Record<Rating, string> {
  const card = toCard(schedule);
  const result = {} as Record<Rating, string>;
  for (const [rating, grade] of Object.entries(GRADES) as [Rating, Grade][])
    result[rating] = formatInterval(
      now,
      scheduler.next(card, now, grade).card.due,
    );
  return result;
}
