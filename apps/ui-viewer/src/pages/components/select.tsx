import { Label } from "@resit/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import {
  subjectColorClasses,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

import type { ExamplePage } from "../../viewer/types";

const subjects: { id: string; name: string; color: SubjectColor }[] = [
  { id: "math", name: "Mathematics", color: "blue" },
  { id: "prog", name: "Programming", color: "green" },
  { id: "phys", name: "Physics", color: "purple" },
];

const models = [
  "Claude Sonnet",
  "Claude Haiku",
  "GPT-5 mini",
  "Gemini Flash",
  "Llama 3.3 70B",
  "Mistral Small",
  "Qwen 2.5 32B",
  "DeepSeek V3",
  "Gemma 3 27B",
  "Phi-4",
  "Command R",
  "Nemotron 70B",
];

function SubjectDot({ color }: { color: SubjectColor }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        subjectColorClasses[color].dot,
      )}
    />
  );
}

export const page: ExamplePage = {
  section: "components",
  slug: "select",
  title: "Select",
  description:
    "One choice from a list. The list opens below the trigger and scrolls when tall.",
  source: "packages/ui/src/components/select.tsx",
  keywords: ["dropdown", "picker", "choice"],
  examples: [
    {
      id: "basic",
      title: "Basic",
      width: "auto",
      render: ({ log }) => (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sel-subject">Subject</Label>
          <Select
            defaultValue="math"
            onValueChange={(value) => log("onValueChange", value)}
          >
            <SelectTrigger id="sel-subject" className="w-48">
              <SelectValue placeholder="Pick a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  <SubjectDot color={subject.color} />
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      id: "groups",
      title: "Groups and separators",
      width: "auto",
      render: ({ log }) => (
        <Select onValueChange={(value) => log("onValueChange", value)}>
          <SelectTrigger className="w-56" aria-label="Move to">
            <SelectValue placeholder="Move to…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Subjects</SelectLabel>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  <SubjectDot color={subject.color} />
                  {subject.name}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Other</SelectLabel>
              <SelectItem value="unsorted">Unsorted</SelectItem>
              <SelectItem value="archive" disabled>
                Archive (read only)
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "sizes",
      title: "Sizes",
      width: "auto",
      render: () => (
        <div className="flex items-center gap-2">
          <Select defaultValue="12">
            <SelectTrigger size="sm" aria-label="Font size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["11", "12", "13", "14", "16"].map((size) => (
                <SelectItem key={size} value={size}>
                  {size} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select defaultValue="12">
            <SelectTrigger aria-label="Font size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["11", "12", "13", "14", "16"].map((size) => (
                <SelectItem key={size} value={size}>
                  {size} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      id: "long-list",
      title: "Long list",
      description:
        "Scrolls inside the popover; the trigger truncates long values.",
      width: "auto",
      render: () => (
        <Select defaultValue={String(models[4])}>
          <SelectTrigger className="w-44" aria-label="Model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      id: "playground",
      title: "Playground",
      width: "auto",
      states: ["default", "disabled", "invalid"],
      controls: {
        placeholder: { type: "text", default: "Pick a subject" },
        size: {
          type: "select",
          options: ["default", "sm"],
          default: "default",
        },
      },
      render: ({ state, controls, log, resetKey }) => (
        <div key={resetKey} className="flex flex-col gap-1.5">
          <Select
            disabled={state === "disabled"}
            onValueChange={(value) => log("onValueChange", value)}
          >
            <SelectTrigger
              className="w-48"
              size={controls.size === "sm" ? "sm" : "default"}
              aria-invalid={state === "invalid" || undefined}
              aria-label="Subject"
            >
              <SelectValue placeholder={String(controls.placeholder)} />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state === "invalid" ? (
            <p className="text-xs text-destructive">
              Pick a subject to file this note under.
            </p>
          ) : null}
        </div>
      ),
    },
  ],
};
