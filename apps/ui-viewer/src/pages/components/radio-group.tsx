import { Label } from "@resit/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@resit/ui/components/radio-group";

import type { ExamplePage } from "../../viewer/types";

const scopes = [
  {
    value: "page",
    label: "This page",
    help: "Only the page you are looking at.",
  },
  {
    value: "document",
    label: "Whole PDF",
    help: "All 214 pages of Lecture 4 — Limits.",
  },
  {
    value: "subject",
    label: "Subject",
    help: "Every note and PDF in Mathematics.",
  },
];

export const page: ExamplePage = {
  section: "components",
  slug: "radio-group",
  title: "Radio group",
  description:
    "One choice from a short list. Use a Select when the list is longer than five.",
  source: "packages/ui/src/components/radio-group.tsx",
  keywords: ["radio", "choice", "option"],
  examples: [
    {
      id: "basic",
      title: "Basic",
      width: "auto",
      render: ({ log }) => (
        <RadioGroup
          defaultValue="document"
          onValueChange={(value) => log("onValueChange", value)}
        >
          {scopes.map((scope) => (
            <div key={scope.value} className="flex items-center gap-2">
              <RadioGroupItem id={`rg-${scope.value}`} value={scope.value} />
              <Label htmlFor={`rg-${scope.value}`} className="font-normal">
                {scope.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ),
    },
    {
      id: "with-description",
      title: "With descriptions",
      width: 320,
      render: () => (
        <RadioGroup
          defaultValue="page"
          className="gap-3 p-4"
          aria-label="Ask scope"
        >
          {scopes.map((scope) => (
            <div key={scope.value} className="flex items-start gap-2">
              <RadioGroupItem
                id={`rgd-${scope.value}`}
                value={scope.value}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor={`rgd-${scope.value}`}>{scope.label}</Label>
                <p className="text-xs text-muted-foreground">{scope.help}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      ),
    },
    {
      id: "horizontal",
      title: "Horizontal",
      width: "auto",
      render: () => (
        <RadioGroup
          defaultValue="md"
          className="flex gap-4"
          aria-label="Density"
        >
          {["sm", "md", "lg"].map((size) => (
            <div key={size} className="flex items-center gap-2">
              <RadioGroupItem id={`rgh-${size}`} value={size} />
              <Label htmlFor={`rgh-${size}`} className="font-normal">
                {size}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ),
    },
    {
      id: "states",
      title: "States",
      width: "auto",
      states: ["default", "disabled", "invalid"],
      render: ({ state, log }) => (
        <RadioGroup
          defaultValue="document"
          disabled={state === "disabled"}
          aria-invalid={state === "invalid" || undefined}
          aria-describedby={state === "invalid" ? "rg-error" : undefined}
          onValueChange={(value) => log("onValueChange", value)}
        >
          {scopes.map((scope) => (
            <div key={scope.value} className="flex items-center gap-2">
              <RadioGroupItem
                id={`rgs-${scope.value}`}
                value={scope.value}
                aria-invalid={state === "invalid" || undefined}
              />
              <Label htmlFor={`rgs-${scope.value}`} className="font-normal">
                {scope.label}
              </Label>
            </div>
          ))}
          {state === "invalid" ? (
            <p id="rg-error" className="text-xs text-destructive">
              Pick a scope before asking.
            </p>
          ) : null}
        </RadioGroup>
      ),
    },
  ],
};
