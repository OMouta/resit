import { useCallback, useEffect, useState } from "react";

import {
  localDate,
  localInstant,
  type PlanFile,
} from "../../../shared/planning";
import { api, errorMessage } from "./api";

/** The workspace's study plan. Reloads when it changes. `null` while loading. */
export function usePlan(): {
  plan: PlanFile | null;
  error: string | null;
  reload: () => void;
} {
  const [plan, setPlan] = useState<PlanFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    api.getPlan().then(
      (next) => {
        if (!current) return;
        setPlan(next);
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
        if (event.type === "plan-changed") reload();
      }),
    [reload],
  );

  return { plan, error, reload };
}

/** The seven dates of the week holding `date`, Monday first. */
export function weekOf(date: string): string[] {
  const day = localInstant(date, "12:00");
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(day);
    next.setDate(day.getDate() + index);
    return localDate(next);
  });
}

export function addDays(date: string, days: number): string {
  const day = localInstant(date, "12:00");
  day.setDate(day.getDate() + days);
  return localDate(day);
}

export function today(): string {
  return localDate(new Date());
}

/** The next whole hour from now, as a start and end an hour apart. */
export function nextHour(): { date: string; start: string; end: string } {
  const at = new Date();
  at.setMinutes(0, 0, 0);
  at.setHours(at.getHours() + 1);
  const end = new Date(at.getTime() + 60 * 60_000);
  const time = (value: Date) =>
    `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  // An evening session that would run past midnight ends at the day's end.
  return {
    date: localDate(at),
    start: time(at),
    end: localDate(end) === localDate(at) ? time(end) : "23:59",
  };
}
