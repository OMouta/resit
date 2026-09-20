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

export type DocumentFont = "sans" | "serif" | "mono";
export type DocumentWidth = "narrow" | "normal" | "wide";

const DOCUMENT_FONTS: Record<DocumentFont, string> = {
  sans: "var(--font-sans)",
  serif:
    '"Iowan Old Style", "Palatino Linotype", Palatino, "Source Serif 4", Georgia, serif',
  mono: "var(--font-mono)",
};

const DOCUMENT_WIDTHS: Record<DocumentWidth, string> = {
  narrow: "36rem",
  normal: "44rem",
  wide: "56rem",
};

/**
 * Typography for note and document text. These override the stylesheet's
 * tokens, so everything using `.document` follows.
 */
export function applyDocumentStyle(
  root: HTMLElement,
  options: { font: DocumentFont; size: number; width: DocumentWidth },
): void {
  root.style.setProperty("--font-document", DOCUMENT_FONTS[options.font]);
  root.style.setProperty("--document-size", `${options.size}px`);
  root.style.setProperty("--document-measure", DOCUMENT_WIDTHS[options.width]);
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
