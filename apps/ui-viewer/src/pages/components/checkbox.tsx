import { Checkbox } from "@resit/ui/components/checkbox";
import { Label } from "@resit/ui/components/label";
import { useState } from "react";

import type { ExamplePage } from "../../viewer/types";

const files = [
  { id: "f1", name: "Worksheet 3.pdf" },
  { id: "f2", name: "Lecture 4 — Limits.pdf" },
  { id: "f3", name: "Sequences — ∑ and ∏ notation.md" },
];

function SelectAll() {
  const [checked, setChecked] = useState<string[]>(["f1"]);
  const all = checked.length === files.length;
  const some = checked.length > 0 && !all;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="all"
          checked={all ? true : some ? "indeterminate" : false}
          onCheckedChange={(next) =>
            setChecked(next === true ? files.map((f) => f.id) : [])
          }
        />
        <Label htmlFor="all">Select all</Label>
      </div>
      <div className="ml-6 flex flex-col gap-2">
        {files.map((file) => (
          <div key={file.id} className="flex items-center gap-2">
            <Checkbox
              id={file.id}
              checked={checked.includes(file.id)}
              onCheckedChange={(next) =>
                setChecked((current) =>
                  next === true
                    ? [...current, file.id]
                    : current.filter((id) => id !== file.id),
                )
              }
            />
            <Label htmlFor={file.id} className="font-normal">
              {file.name}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}

export const page: ExamplePage = {
  section: "components",
  slug: "checkbox",
  title: "Checkbox",
  description:
    "Independent yes/no choices. Use a Switch for settings that apply immediately.",
  source: "packages/ui/src/components/checkbox.tsx",
  keywords: ["check", "select", "indeterminate"],
  examples: [
    {
      id: "states",
      title: "States",
      width: "auto",
      render: () => (
        <div className="flex flex-col gap-2">
          {(
            [
              ["unchecked", false, false, false],
              ["checked", true, false, false],
              ["indeterminate", "indeterminate", false, false],
              ["disabled", false, true, false],
              ["disabled checked", true, true, false],
              ["invalid", false, false, true],
            ] as const
          ).map(([label, checked, disabled, invalid]) => (
            <div key={label} className="flex items-center gap-2">
              <Checkbox
                id={`cb-${label}`}
                checked={checked}
                disabled={disabled}
                aria-invalid={invalid || undefined}
              />
              <Label htmlFor={`cb-${label}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "with-description",
      title: "With description and long label",
      width: 360,
      render: ({ log }) => (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-2">
            <Checkbox
              id="cite"
              defaultChecked
              className="mt-0.5"
              onCheckedChange={(v) => log("onCheckedChange", v)}
            />
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="cite">Include citations</Label>
              <p className="text-xs text-muted-foreground">
                Answers link to the page of the PDF they came from.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="long" className="mt-0.5" />
            <Label htmlFor="long" className="leading-snug font-normal">
              Also search archived subjects (Análise Matemática I, Programação
              I, Física I) and attachments that are not indexed yet
            </Label>
          </div>
        </div>
      ),
    },
    {
      id: "select-all",
      title: "Select all",
      description:
        "The parent shows indeterminate while only some files are selected.",
      width: "auto",
      render: ({ resetKey }) => <SelectAll key={resetKey} />,
    },
    {
      id: "playground",
      title: "Playground",
      width: "auto",
      states: ["default", "disabled", "invalid"],
      controls: {
        label: { type: "text", default: "Mark as revised" },
        defaultChecked: { type: "boolean", default: false },
      },
      render: ({ state, controls, log, resetKey }) => (
        <div key={resetKey} className="flex items-center gap-2">
          <Checkbox
            id="pg"
            defaultChecked={Boolean(controls.defaultChecked)}
            disabled={state === "disabled"}
            aria-invalid={state === "invalid" || undefined}
            onCheckedChange={(value) => log("onCheckedChange", value)}
          />
          <Label htmlFor="pg" className="font-normal">
            {String(controls.label)}
          </Label>
        </div>
      ),
    },
  ],
};
