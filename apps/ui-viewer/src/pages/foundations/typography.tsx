import {
  MathBlock,
  MathInline,
  MathText,
} from "@resit/ui/patterns/document/math";

import { mathSamples, noteMarkdown } from "../../fixtures/documents";
import type { ExamplePage } from "../../viewer/types";
import { useTokens } from "./tokens";

const scale = [
  ["text-3xl", "Screen titles"],
  ["text-2xl", "Page titles, onboarding"],
  ["text-xl", "Section titles"],
  ["text-lg", "Dialog titles, callout labels"],
  ["text-base", "Body: messages, descriptions"],
  ["text-sm", "Interface: rows, controls, tabs"],
  ["text-xs", "Metadata, badges"],
  ["text-2xs", "Keyboard hints"],
] as const;

function Families() {
  const values = useTokens([
    "--font-sans",
    "--font-mono",
    "--font-document",
    "--font-math",
  ]);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-md border p-4">
        <p className="text-xs text-muted-foreground">Interface · --font-sans</p>
        <p className="mt-1 text-xl font-semibold tracking-tight">
          Worksheet 3 — Limits and continuity
        </p>
        <p className="text-sm text-muted-foreground">
          Geist with the system fallback stack. Tabular figures in tables.
        </p>
        <p className="mt-2 font-mono text-2xs text-muted-foreground">
          {values["--font-sans"]}
        </p>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-xs text-muted-foreground">
          Code and paths · --font-mono
        </p>
        <p className="mt-1 font-mono text-sm">
          Mathematics/notes/Resolution — Worksheet 3.md
        </p>
        <pre className="mt-1 font-mono text-sm">{`int *p = &x;  // p holds the address of x`}</pre>
        <p className="mt-2 font-mono text-2xs text-muted-foreground">
          {values["--font-mono"]}
        </p>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-xs text-muted-foreground">
          Document · --font-document
        </p>
        <p className="document mt-1">
          Notes use the document scale: 16px with a 1.65 line height and a 44rem
          measure, so long explanations stay readable.
        </p>
        <p className="mt-2 font-mono text-2xs text-muted-foreground">
          {values["--font-document"]}
        </p>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-xs text-muted-foreground">Mathematics · KaTeX</p>
        <p className="mt-1 text-base">
          Inline <MathInline>{mathSamples.limit}</MathInline> sits on the text
          baseline; display math gets its own block.
        </p>
        <MathBlock>{mathSamples.sum}</MathBlock>
        <p className="mt-2 font-mono text-2xs text-muted-foreground">
          {values["--font-math"]}
        </p>
      </div>
    </div>
  );
}

export const page: ExamplePage = {
  section: "foundations",
  slug: "typography",
  title: "Typography",
  description:
    "Geist for the interface, Geist Mono for code and paths, KaTeX for mathematics. Interface text is 13px; document text is 16px.",
  source: "packages/ui/src/styles/globals.css",
  keywords: ["font", "type", "math", "katex", "geist"],
  examples: [
    {
      id: "families",
      title: "Families",
      width: "full",
      render: () => <Families />,
    },
    {
      id: "scale",
      title: "Scale",
      width: "full",
      render: () => (
        <div className="flex flex-col gap-3">
          {scale.map(([className, use]) => (
            <div
              key={className}
              className="grid grid-cols-[6rem_1fr_12rem] items-baseline gap-4"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {className}
              </span>
              <span className={`${className} truncate`}>
                Análise Matemática I — ε–δ proofs
              </span>
              <span className="text-xs text-muted-foreground">{use}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "weights",
      title: "Weights and tracking",
      width: "full",
      render: () => (
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-semibold tracking-tight">
            Semibold, tight tracking for titles
          </p>
          <p className="text-base font-medium">
            Medium for row titles and labels
          </p>
          <p className="text-base">Regular for body text and descriptions</p>
          <p className="text-sm text-muted-foreground">
            Regular, muted for secondary lines
          </p>
        </div>
      ),
    },
    {
      id: "document",
      title: "Document text",
      description:
        "A note rendered with the document class: headings, paragraphs, inline and display math, quotes.",
      width: "full",
      render: () => (
        <MathText className="document" paragraphClassName="">
          {noteMarkdown
            .replace(/^# (.*)$/m, "$1")
            .replace(/^## /gm, "")
            .replace(/^> /gm, "")}
        </MathText>
      ),
    },
    {
      id: "math-states",
      title: "Mathematics in both themes",
      description:
        "Long expressions scroll horizontally; errors show the source and message.",
      width: "full",
      render: () => (
        <div className="flex flex-col gap-3">
          <MathBlock>{mathSamples.epsilonDelta}</MathBlock>
          <MathBlock>{mathSamples.long}</MathBlock>
          <MathBlock>{mathSamples.matrix}</MathBlock>
          <MathBlock>{mathSamples.broken}</MathBlock>
          <p className="text-base">
            Unknown command inline:{" "}
            <MathInline>{mathSamples.unknownCommand}</MathInline>
          </p>
        </div>
      ),
    },
  ],
};
