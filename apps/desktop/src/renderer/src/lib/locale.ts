import { useSyncExternalStore } from "react";

import type { Locale } from "@resit/ui/lib/i18n";

let current: Locale = "en";
const listeners = new Set<() => void>();

/** Switches the interface language, set from the language setting. */
export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  document.documentElement.lang = next;
  for (const listener of listeners) listener();
}

export function useCurrentLocale(): Locale {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
