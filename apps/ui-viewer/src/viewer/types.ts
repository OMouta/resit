import type { ResolvedTheme } from "@resit/ui/lib/theme";
import type { Locale } from "@resit/ui/hooks/use-locale";
import type { ReactNode } from "react";

export const SECTIONS = [
  "foundations",
  "components",
  "patterns",
  "screens",
] as const;
export type Section = (typeof SECTIONS)[number];

export type ControlValue = string | boolean | number;

export type ExampleControl =
  | {
      type: "select";
      label?: string;
      options: readonly string[];
      default: string;
    }
  | { type: "boolean"; label?: string; default: boolean }
  | { type: "text"; label?: string; default: string }
  | {
      type: "number";
      label?: string;
      default: number;
      min?: number;
      max?: number;
      step?: number;
    };

export interface ExampleContext {
  /** Selected entry from `states`, or "default". */
  state: string;
  controls: Record<string, ControlValue>;
  /** Writes to the viewer event log. Wire component callbacks to it. */
  log: (event: string, payload?: unknown) => void;
  theme: ResolvedTheme;
  locale: Locale;
  /** Frame width in px, or null when the frame follows the page width. */
  viewport: number | null;
  /** Increments when the user presses Reset. Use as a `key` to remount. */
  resetKey: number;
}

export interface Example {
  id: string;
  title: string;
  description?: string;
  /** Named states shown as a segmented control. The first is the default. */
  states?: readonly string[];
  controls?: Record<string, ExampleControl>;
  /** "full" fills the frame; "auto" hugs content. Numbers are px. */
  width?: "full" | "auto" | number;
  height?: number;
  /** Frame background. "sidebar" previews on the sidebar surface. */
  surface?: "background" | "sidebar" | "muted";
  /** Reference image id from the references manifest, for side-by-side compare. */
  reference?: string;
  render: (ctx: ExampleContext) => ReactNode;
}

export interface ExamplePage {
  section: Section;
  slug: string;
  title: string;
  description?: string;
  /** Sidebar grouping within a section, for example "Navigation". */
  group?: string;
  /** Repo-relative path of the production source for this page. */
  source?: string;
  keywords?: string[];
  examples: Example[];
}

export interface RegisteredPage extends ExamplePage {
  /** Repo-relative path of the viewer page module. */
  pagePath: string;
}
