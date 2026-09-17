import { Button } from "@resit/ui/components/button";
import { Kbd } from "@resit/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { shortcutLabel } from "@resit/ui/lib/keys";
import {
  BoldIcon,
  HighlighterIcon,
  ItalicIcon,
  SigmaIcon,
  UnderlineIcon,
} from "lucide-react";

import type { ExamplePage } from "../../viewer/types";

const tools = [
  { label: "Bold", icon: BoldIcon, combo: "Mod+B" },
  { label: "Italic", icon: ItalicIcon, combo: "Mod+I" },
  { label: "Underline", icon: UnderlineIcon, combo: "Mod+U" },
  { label: "Highlight", icon: HighlighterIcon, combo: "Mod+Shift+H" },
  { label: "Insert math", icon: SigmaIcon, combo: "Mod+M" },
];

export const page: ExamplePage = {
  section: "components",
  slug: "tooltip",
  title: "Tooltip",
  description:
    "Names icon-only controls and shows their shortcut. Hover or focus opens it; it never holds anything you need to click.",
  source: "packages/ui/src/components/tooltip.tsx",
  keywords: ["hint", "hover", "label", "shortcut"],
  examples: [
    {
      id: "toolbar",
      title: "Toolbar with shortcuts",
      description:
        "One provider for the row so moving between buttons opens tooltips without the delay.",
      width: "auto",
      render: ({ log }) => (
        <TooltipProvider>
          <div className="flex items-center gap-0.5">
            {tools.map((tool) => (
              <Tooltip key={tool.label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="subtle"
                    size="icon"
                    aria-label={tool.label}
                    onClick={() => log(tool.label)}
                  >
                    <tool.icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="flex items-center gap-1.5">
                    {tool.label}
                    <Kbd className="bg-background/20 text-inherit shadow-none dark:bg-muted">
                      {shortcutLabel(tool.combo).join("")}
                    </Kbd>
                  </span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      ),
    },
    {
      id: "sides",
      title: "Sides",
      width: "auto",
      render: () => (
        <div className="flex items-center gap-2">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <Tooltip key={side}>
              <TooltipTrigger asChild>
                <Button variant="outline">{side}</Button>
              </TooltipTrigger>
              <TooltipContent side={side}>Opens {side}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      ),
    },
    {
      id: "truncated",
      title: "Full title for a truncated label",
      width: 240,
      render: () => (
        <div className="p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-row w-full items-center rounded-md px-2 text-left text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
              >
                <span className="truncate">
                  Exercise 5 — continuity of piecewise functions on closed
                  intervals
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              Exercise 5 — continuity of piecewise functions on closed intervals
            </TooltipContent>
          </Tooltip>
        </div>
      ),
    },
    {
      id: "disabled-trigger",
      title: "Disabled control",
      description:
        "Disabled buttons do not fire hover events; wrap them in a span so the tooltip can explain why.",
      width: "auto",
      render: () => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="inline-flex rounded-control focus-visible:shadow-focus focus-visible:outline-none"
            >
              <Button disabled>Ask</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Add an API key in Settings to ask questions.
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      id: "playground",
      title: "Playground",
      width: "auto",
      states: ["default", "open"],
      controls: {
        text: { type: "text", default: "Saved 2 minutes ago" },
        side: {
          type: "select",
          options: ["top", "right", "bottom", "left"],
          default: "top",
        },
      },
      render: ({ state, controls, resetKey }) => (
        <Tooltip key={resetKey} {...(state === "open" ? { open: true } : {})}>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent
            side={controls.side as "top" | "right" | "bottom" | "left"}
          >
            {String(controls.text)}
          </TooltipContent>
        </Tooltip>
      ),
    },
  ],
};
