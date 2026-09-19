import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import {
  SUBJECT_COLORS,
  subjectColorClasses,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

import type { ExamplePage } from "../../viewer/types";
import { useTokens } from "./tokens";

const surfaceTokens = [
  ["--background", "Page and editor background"],
  ["--sidebar", "Sidebar surface"],
  ["--surface-raised", "Raised surface in dark theme (cards, popovers)"],
  ["--popover", "Popovers, menus, dialogs"],
  ["--muted", "Muted fills: segmented control track, code"],
  ["--accent", "Hover and pressed fill"],
  ["--selection", "Selected rows and blocks"],
  ["--selection-strong", "Text selection"],
  ["--highlight", "Search hits and highlighted text"],
] as const;

const textTokens = [
  ["--foreground", "Primary text"],
  ["--muted-foreground", "Secondary text"],
  ["--subtle-foreground", "Tertiary: placeholders, timestamps"],
  ["--link", "Links and citations"],
] as const;

const lineTokens = [
  ["--border", "Hairline dividers"],
  ["--border-strong", "Scrollbar thumbs, quote rules"],
  ["--input", "Control borders"],
  ["--ring", "Focus ring"],
] as const;

const statusTokens = [
  ["--primary", "--primary-foreground", "Primary action"],
  ["--success", "--success-soft", "Correct, saved, ready"],
  ["--warning", "--warning-soft", "Overdue, conflict, orphaned"],
  ["--destructive", "--danger-soft", "Errors, incorrect, delete"],
  ["--link", "--info-soft", "Information"],
] as const;

function Swatch({
  token,
  label,
  value,
  textOn,
}: {
  token: string;
  label: string;
  value: string;
  textOn?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="size-10 shrink-0 rounded-md shadow-hairline"
        style={{ background: `var(${token})` }}
        aria-hidden
      >
        {textOn ? (
          <span
            className="flex h-full items-center justify-center text-sm font-medium"
            style={{ color: `var(${textOn})` }}
          >
            Aa
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {token} · {value || "…"}
        </p>
      </div>
    </div>
  );
}

function TokenGrid({
  tokens,
}: {
  tokens: readonly (readonly [string, string])[];
}) {
  const values = useTokens(tokens.map(([token]) => token));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tokens.map(([token, label]) => (
        <Swatch
          key={token}
          token={token}
          label={label}
          value={values[token] ?? ""}
        />
      ))}
    </div>
  );
}

function StatusGrid() {
  const values = useTokens(statusTokens.flatMap(([a, b]) => [a, b]));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {statusTokens.map(([strong, soft, label]) => (
        <div key={strong} className="flex items-center gap-3">
          <div
            className="flex overflow-hidden rounded-md shadow-hairline"
            aria-hidden
          >
            <div className="size-10" style={{ background: `var(${strong})` }} />
            <div
              className="flex size-10 items-center justify-center text-sm font-medium"
              style={{ background: `var(${soft})`, color: `var(${strong})` }}
            >
              Aa
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {strong} {values[strong]} · {soft} {values[soft]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubjectPalette() {
  const values = useTokens(
    SUBJECT_COLORS.flatMap((c) => [`--subject-${c}`, `--subject-${c}-soft`]),
  );
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {SUBJECT_COLORS.map((color) => {
        const classes = subjectColorClasses[color];
        return (
          <div
            key={color}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2",
              classes.softBg,
            )}
          >
            <span
              className={cn("size-2.5 rounded-full", classes.dot)}
              aria-hidden
            />
            <div className="min-w-0">
              <p className={cn("text-sm font-medium capitalize", classes.text)}>
                {color}
              </p>
              <p className="font-mono text-2xs text-muted-foreground">
                {values[`--subject-${color}`]} on{" "}
                {values[`--subject-${color}-soft`]}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const page: ExamplePage = {
  section: "foundations",
  slug: "colors",
  title: "Colours",
  description:
    "Both themes follow Notion: paper white and warm ink in light, soft greys in dark. Primary actions, focus, and links use resit jade. Switch the theme control to compare. Values are read live from the stylesheet.",
  source: "packages/ui/src/styles/globals.css",
  keywords: ["theme", "palette", "tokens", "dark"],
  examples: [
    {
      id: "surfaces",
      title: "Surfaces",
      width: "full",
      render: () => <TokenGrid tokens={surfaceTokens} />,
    },
    {
      id: "text",
      title: "Text",
      width: "full",
      render: () => (
        <div className="flex flex-col gap-4">
          <TokenGrid tokens={textTokens} />
          <div className="rounded-md border p-4">
            <p className="text-base text-foreground">
              Primary text for notes and messages.
            </p>
            <p className="text-sm text-muted-foreground">
              Secondary text for metadata, descriptions, and hints.
            </p>
            <p className="text-xs text-subtle-foreground">
              Tertiary text for timestamps and placeholders.
            </p>
            <p className="text-sm">
              A{" "}
              <span className="text-link underline underline-offset-2">
                citation link
              </span>{" "}
              inside body text.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "lines",
      title: "Borders and focus",
      width: "full",
      render: () => (
        <div className="flex flex-col gap-4">
          <TokenGrid tokens={lineTokens} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-9 w-40 rounded-md border" />
            <div className="h-9 w-40 rounded-md border border-border-strong" />
            <div className="h-9 w-40 rounded-md border border-input" />
            <div className="h-9 w-40 rounded-md border shadow-focus" />
          </div>
        </div>
      ),
    },
    {
      id: "status",
      title: "Status",
      description:
        "Each status has a strong colour for icons and text and a soft fill for backgrounds. Status is never shown by colour alone.",
      width: "full",
      render: () => (
        <div className="flex flex-col gap-4">
          <StatusGrid />
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Correct</Badge>
            <Badge variant="warning">Overdue</Badge>
            <Badge variant="destructive">Failed</Badge>
            <Badge variant="info">Retrieved</Badge>
            <Badge variant="secondary">Draft</Badge>
            <Badge variant="outline">Read-only</Badge>
            <Button size="sm">Primary</Button>
          </div>
        </div>
      ),
    },
    {
      id: "subjects",
      title: "Subject palette",
      description:
        "Notion's nine tag colours. A subject colour always appears with the subject name.",
      width: "full",
      render: () => <SubjectPalette />,
    },
  ],
};
