export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme;
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Applies theme and reduced-motion attributes to a root element. */
export function applyAppearance(
  root: HTMLElement,
  options: { theme: Theme; reducedMotion?: boolean },
): ResolvedTheme {
  const resolved = resolveTheme(options.theme);
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  if (options.reducedMotion !== undefined)
    root.dataset.reducedMotion = String(options.reducedMotion);
  return resolved;
}
