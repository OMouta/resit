import { useCallback, useEffect, useState } from "react";

import type { LocaleFormatters } from "@resit/ui/hooks/use-locale";

import type { LearnerProfile, TopicEvidence } from "../../../shared/learner";
import { api, errorMessage } from "./api";

/**
 * The learner profile and the practice counts beside it. Reloads when either
 * changes. `null` while loading.
 */
export function useLearner(): {
  profile: LearnerProfile | null;
  error: string | null;
} {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    api.getLearnerProfile().then(
      (next) => {
        if (!current) return;
        setProfile(next);
        setError(null);
      },
      (reason: unknown) => {
        if (current) setError(errorMessage(reason));
      },
    );
    return () => {
      current = false;
    };
  }, [version]);

  useEffect(
    () =>
      api.onEvent((event) => {
        if (
          event.type === "learner-changed" ||
          event.type === "practice-changed"
        )
          reload();
      }),
    [reload],
  );

  return { profile, error };
}

/** "9 reviews, 3 forgotten · 4 of 6 quiz answers right", or nothing. */
export function evidenceLine(
  evidence: TopicEvidence | undefined,
  t: LocaleFormatters["t"],
): string {
  if (!evidence) return "";
  const parts = [];
  if (evidence.reviews > 0) {
    const values = { count: evidence.reviews, forgotten: evidence.forgotten };
    parts.push(
      evidence.reviews === 1
        ? t("{count} review, {forgotten} forgotten", values)
        : t("{count} reviews, {forgotten} forgotten", values),
    );
  }
  if (evidence.answered > 0) {
    const values = { right: evidence.right, count: evidence.answered };
    parts.push(
      evidence.answered === 1
        ? t("{right} of {count} quiz answer right", values)
        : t("{right} of {count} quiz answers right", values),
    );
  }
  if (parts.length === 0 && evidence.cards > 0)
    parts.push(
      evidence.cards === 1
        ? t("{count} card, not reviewed lately", { count: 1 })
        : t("{count} cards, not reviewed lately", { count: evidence.cards }),
    );
  return parts.join(" · ");
}
