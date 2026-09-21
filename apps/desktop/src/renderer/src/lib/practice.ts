import { useCallback, useEffect, useState } from "react";

import type { PracticeOverview } from "../../../shared/practice";
import { api } from "./api";

/**
 * Every subject's cards and quizzes. Reloads when practice changes, in the
 * window or through the assistant, and when subjects come and go: a subject
 * restored from the trash brings its cards back. `null` while loading.
 */
export function usePractice(subjectIds: readonly string[]): {
  practice: PracticeOverview | null;
  error: string | null;
  reload: () => void;
} {
  const [practice, setPractice] = useState<PracticeOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const subjectKey = subjectIds.join(",");

  useEffect(() => {
    let current = true;
    api.listPractice().then(
      (next) => {
        if (!current) return;
        setPractice(next);
        setError(null);
      },
      (reason: unknown) => {
        if (current)
          setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => {
      current = false;
    };
  }, [version, subjectKey]);

  useEffect(
    () =>
      api.onEvent((event) => {
        if (event.type === "practice-changed") reload();
      }),
    [reload],
  );

  return { practice, error, reload };
}

/** Cards due now, and the new cards today's allowance still lets in. */
export function reviewCounts(
  practice: PracticeOverview,
  subjectId?: string,
): { due: number; fresh: number } {
  const at = Date.now();
  let due = 0;
  let fresh = 0;
  let introduced = 0;
  for (const subject of practice.subjects) {
    introduced += subject.newToday;
    if (subjectId && subject.subjectId !== subjectId) continue;
    for (const card of subject.cards) {
      if (card.status !== "active") continue;
      if (card.schedule.state === "new") fresh += 1;
      else if (Date.parse(card.schedule.due) <= at) due += 1;
    }
  }
  return {
    due,
    fresh: Math.min(fresh, Math.max(0, practice.newCardsPerDay - introduced)),
  };
}

export function dueCount(
  practice: PracticeOverview,
  subjectId?: string,
): number {
  const { due, fresh } = reviewCounts(practice, subjectId);
  return due + fresh;
}

/** Topic names used in a subject, for suggestions. */
export function topicsOf(
  practice: PracticeOverview | null,
  subjectId: string,
): string[] {
  const subject = practice?.subjects.find(
    (entry) => entry.subjectId === subjectId,
  );
  const topics = new Set<string>();
  for (const card of subject?.cards ?? [])
    if (card.topic) topics.add(card.topic);
  for (const quiz of subject?.quizzes ?? [])
    if (quiz.topic) topics.add(quiz.topic);
  return [...topics].sort((a, b) => a.localeCompare(b));
}
