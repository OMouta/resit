import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@resit/ui/components/popover";
import {
  subjectColorClasses,
  SUBJECT_COLORS,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { PaletteIcon } from "lucide-react";
import { useState } from "react";

import type { ExamplePage } from "../../viewer/types";

function ColorPicker({ log }: { log: (e: string, p?: unknown) => void }) {
  const [color, setColor] = useState<(typeof SUBJECT_COLORS)[number]>("blue");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <span
            className={cn(
              "size-3 rounded-full",
              subjectColorClasses[color].dot,
            )}
            aria-hidden
          />
          {color}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div
          className="grid grid-cols-5 gap-1"
          role="radiogroup"
          aria-label="Subject colour"
        >
          {SUBJECT_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={option === color}
              aria-label={option}
              title={option}
              className={cn(
                "flex size-7 items-center justify-center rounded-md hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
                option === color && "bg-selection",
              )}
              onClick={() => {
                setColor(option);
                log("onColorChange", option);
              }}
            >
              <span
                className={cn(
                  "size-4 rounded-full",
                  subjectColorClasses[option].dot,
                )}
              />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const page: ExamplePage = {
  section: "components",
  slug: "popover",
  title: "Popover",
  description:
    "Small non-modal surface anchored to a control. Escape or a click outside closes it.",
  source: "packages/ui/src/components/popover.tsx",
  keywords: ["popup", "anchored", "picker"],
  examples: [
    {
      id: "form",
      title: "Small form",
      width: "auto",
      render: ({ log }) => (
        <Popover onOpenChange={(open) => log("onOpenChange", open)}>
          <PopoverTrigger asChild>
            <Button variant="outline">Go to page</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                log("goto", new FormData(event.currentTarget).get("page"));
              }}
            >
              <Label htmlFor="goto-page">Page (1–214)</Label>
              <div className="flex gap-2">
                <Input
                  id="goto-page"
                  name="page"
                  type="number"
                  min={1}
                  max={214}
                  defaultValue={12}
                  autoFocus
                />
                <Button type="submit">Go</Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      ),
    },
    {
      id: "color-picker",
      title: "Colour picker",
      width: "auto",
      render: ({ log, resetKey }) => <ColorPicker key={resetKey} log={log} />,
    },
    {
      id: "icon-trigger",
      title: "Icon trigger with side and align",
      width: "auto",
      controls: {
        side: {
          type: "select",
          options: ["bottom", "top", "right", "left"],
          default: "bottom",
        },
        align: {
          type: "select",
          options: ["start", "center", "end"],
          default: "center",
        },
      },
      render: ({ controls }) => (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="subtle" size="icon" aria-label="Appearance">
              <PaletteIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side={controls.side as "bottom" | "top" | "right" | "left"}
            align={controls.align as "start" | "center" | "end"}
            className="w-56 text-sm"
          >
            <p className="font-medium">Appearance</p>
            <p className="text-muted-foreground">
              Theme follows the system by default.
            </p>
          </PopoverContent>
        </Popover>
      ),
    },
    {
      id: "long-content",
      title: "Long content",
      width: "auto",
      render: () => (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Citation</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm" align="start">
            <p className="font-medium">Lecture 4 — Limits.pdf, page 37</p>
            <p className="mt-1 text-muted-foreground">
              “A function f is continuous at a point a if the limit of f(x) as x
              approaches a exists and equals f(a). For piecewise functions this
              must be checked from both sides at every boundary point, and
              separately at the endpoints of a closed interval.”
            </p>
          </PopoverContent>
        </Popover>
      ),
    },
  ],
};
