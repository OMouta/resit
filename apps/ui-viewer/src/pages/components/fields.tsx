import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { Textarea } from "@resit/ui/components/textarea";
import { SearchIcon } from "lucide-react";

import type { ExamplePage } from "../../viewer/types";

const longTitle =
  "Exercise 5 — continuity of piecewise functions on closed intervals with removable discontinuities";

export const page: ExamplePage = {
  section: "components",
  slug: "fields",
  title: "Fields",
  description:
    "Input, Textarea, and Label. Labels sit above the field; helper or error text sits below it.",
  source: "packages/ui/src/components/input.tsx",
  keywords: ["input", "textarea", "label", "form", "text"],
  examples: [
    {
      id: "input-types",
      title: "Input types",
      width: 320,
      render: ({ log }) => (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-title">Note title</Label>
            <Input
              id="note-title"
              placeholder="Resolution — Worksheet 3"
              onChange={(event) => log("onChange", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-number">Page</Label>
            <Input
              id="page-number"
              type="number"
              min={1}
              max={214}
              defaultValue={12}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search"
                type="search"
                placeholder="Search notes and PDFs"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf-file">Import PDF</Label>
            <Input id="pdf-file" type="file" accept="application/pdf" />
          </div>
        </div>
      ),
    },
    {
      id: "input-states",
      title: "Input states",
      width: 320,
      render: () => (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="in-default">Default</Label>
            <Input
              id="in-default"
              defaultValue="Sequences — ∑ and ∏ notation"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="in-disabled">Disabled</Label>
            <Input id="in-disabled" disabled defaultValue="Archived subject" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="in-readonly">Read only</Label>
            <Input
              id="in-readonly"
              readOnly
              defaultValue="D:/Studies 2026-27"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="in-invalid">Invalid</Label>
            <Input
              id="in-invalid"
              aria-invalid
              aria-describedby="in-invalid-help"
              defaultValue="Worksheet/3"
            />
            <p id="in-invalid-help" className="text-xs text-destructive">
              Titles cannot contain “/”. Remove it and save again.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="in-long">Long value</Label>
            <Input id="in-long" defaultValue={longTitle} />
          </div>
        </div>
      ),
    },
    {
      id: "textarea",
      title: "Textarea",
      description: "Grows with content up to the height you set.",
      width: 360,
      states: ["default", "disabled", "invalid"],
      render: ({ state, log }) => (
        <div className="flex flex-col gap-1.5 p-4">
          <Label htmlFor="ta">Ask about this page</Label>
          <Textarea
            id="ta"
            placeholder="Why does the limit exist at x = 2?"
            disabled={state === "disabled"}
            aria-invalid={state === "invalid" || undefined}
            className="max-h-40"
            onChange={(event) => log("onChange", event.target.value.length)}
          />
          {state === "invalid" ? (
            <p className="text-xs text-destructive">
              The question is empty. Type something before sending.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Shift+Enter for a new line.
            </p>
          )}
        </div>
      ),
    },
    {
      id: "textarea-long",
      title: "Textarea with long content",
      width: 360,
      render: () => (
        <div className="p-4">
          <Textarea
            aria-label="Note body"
            className="max-h-48"
            defaultValue={`Show that lim (3x - 1) = 5 as x → 2 using the ε–δ definition.\n\nLet ε > 0. We need δ > 0 such that 0 < |x - 2| < δ implies |(3x - 1) - 5| < ε.\n\n|(3x - 1) - 5| = |3x - 6| = 3|x - 2|\n\nSo choosing δ = ε / 3 works.\n\nPrerequisite: absolute value inequalities. See Sequences, section 1.\n\nExercise 3: f(x) = (x² - 4)/(x - 2) is not defined at x = 2, but the limit exists.`}
          />
        </div>
      ),
    },
    {
      id: "label",
      title: "Label",
      description:
        "Clicking the label focuses its control. Disabled controls dim their label.",
      width: "auto",
      render: () => (
        <div className="flex flex-col gap-3">
          <Label htmlFor="lbl-a">Subject name</Label>
          <Input id="lbl-a" className="w-56" placeholder="Physics" />
          <div className="flex items-center gap-2">
            <Input
              id="lbl-b"
              className="peer w-56"
              disabled
              placeholder="Archived"
            />
            <Label htmlFor="lbl-b">Disabled field</Label>
          </div>
        </div>
      ),
    },
    {
      id: "playground",
      title: "Playground",
      width: 320,
      states: ["default", "disabled", "invalid"],
      controls: {
        label: { type: "text", default: "Subject name" },
        placeholder: { type: "text", default: "Programming" },
        help: { type: "boolean", default: true },
      },
      render: ({ state, controls, log }) => (
        <form
          className="flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            log("onSubmit");
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pg">{String(controls.label)}</Label>
            <Input
              id="pg"
              placeholder={String(controls.placeholder)}
              disabled={state === "disabled"}
              aria-invalid={state === "invalid" || undefined}
              onChange={(event) => log("onChange", event.target.value)}
            />
            {controls.help ? (
              <p
                className={
                  state === "invalid"
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {state === "invalid"
                  ? "A subject with this name already exists. Pick another name."
                  : "Shown in the sidebar and on every note."}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={state === "disabled"}>
              Create subject
            </Button>
          </div>
        </form>
      ),
    },
  ],
};
