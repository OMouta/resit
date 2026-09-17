import { Button } from "@resit/ui/components/button";
import { PlusIcon, TrashIcon } from "lucide-react";

import type { ExamplePage } from "../../viewer/types";

const variants = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "subtle",
  "destructive",
  "destructive-outline",
  "link",
] as const;

export const page: ExamplePage = {
  section: "components",
  slug: "button",
  title: "Button",
  description:
    "Primary action is blue; everything else stays neutral. One primary per view.",
  source: "packages/ui/src/components/button.tsx",
  keywords: ["action", "cta", "loading"],
  examples: [
    {
      id: "variants",
      title: "Variants",
      width: "auto",
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          {variants.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
      ),
    },
    {
      id: "sizes",
      title: "Sizes",
      width: "auto",
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon-sm" aria-label="Add">
            <PlusIcon />
          </Button>
          <Button size="icon" aria-label="Add">
            <PlusIcon />
          </Button>
          <Button size="icon-lg" aria-label="Add">
            <PlusIcon />
          </Button>
        </div>
      ),
    },
    {
      id: "playground",
      title: "Playground",
      description: "Change props and watch the event log.",
      width: "auto",
      states: ["default", "loading", "disabled"],
      controls: {
        variant: { type: "select", options: variants, default: "default" },
        label: { type: "text", default: "Import PDF" },
        icon: { type: "boolean", default: true },
      },
      render: ({ state, controls, log }) => (
        <Button
          variant={controls.variant as (typeof variants)[number]}
          loading={state === "loading"}
          disabled={state === "disabled"}
          onClick={() => log("onClick")}
        >
          {controls.icon ? <PlusIcon /> : null}
          {String(controls.label)}
        </Button>
      ),
    },
    {
      id: "destructive-pair",
      title: "Destructive with cancel",
      description:
        "The destructive action sits on the right, cancel to its left.",
      width: "auto",
      render: ({ log }) => (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => log("cancel")}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => log("delete")}>
            <TrashIcon />
            Move to trash
          </Button>
        </div>
      ),
    },
  ],
};
