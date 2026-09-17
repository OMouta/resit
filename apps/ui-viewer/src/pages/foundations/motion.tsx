import { Button } from "@resit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@resit/ui/components/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@resit/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useReducedMotion } from "@resit/ui/hooks/use-reduced-motion";
import { useState } from "react";

import type { ExamplePage } from "../../viewer/types";
import { useTokens } from "./tokens";

const durations = [
  ["--duration-fast", "Hover, press, focus"],
  ["--duration-base", "Popovers, menus, tab switch"],
  ["--duration-slow", "Panels sliding, progress"],
] as const;

const layers = [
  ["--z-sticky", "z-sticky", "Sticky toolbars and headers"],
  ["--z-pane", "z-pane", "Split handles and pane focus"],
  ["--z-overlay", "z-overlay", "Dialog overlays and sheets"],
  ["--z-popover", "z-popover", "Menus, popovers, tooltips"],
  ["--z-toast", "z-toast", "Notifications"],
] as const;

function Durations() {
  const values = useTokens([
    ...durations.map(([t]) => t),
    "--ease-out",
    "--ease-in-out",
  ]);
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Reduced motion is {reduced ? "on" : "off"}. Transitions collapse to
        0.01ms when on.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {durations.map(([token, use]) => (
          <div key={token} className="rounded-md border p-3">
            <p className="font-mono text-xs">{token}</p>
            <p className="text-sm font-medium">{values[token]}</p>
            <p className="text-xs text-muted-foreground">{use}</p>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{
                  width: on ? "100%" : "20%",
                  transition: `width var(${token}) var(--ease-out)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setOn((v) => !v)}>
          Toggle
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          ease-out {values["--ease-out"]} · ease-in-out{" "}
          {values["--ease-in-out"]}
        </span>
      </div>
    </div>
  );
}

function Layers() {
  const values = useTokens(layers.map(([t]) => t));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-5">
        {layers.map(([token, className, use]) => (
          <div key={token} className="rounded-md border p-3">
            <p className="font-mono text-xs">{className}</p>
            <p className="text-sm font-medium">{values[token]}</p>
            <p className="text-xs text-muted-foreground">{use}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">
              Tooltip
            </Button>
          </TooltipTrigger>
          <TooltipContent>Popover layer, 400ms delay</TooltipContent>
        </Tooltip>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Popover
            </Button>
          </PopoverTrigger>
          <PopoverContent className="text-sm">
            Popovers fade and scale from their anchor.
          </PopoverContent>
        </Popover>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Overlay layer</DialogTitle>
              <DialogDescription>
                The dialog fades in over a dimmed page; popovers opened from it
                stack above.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Open popover</Button>
                </PopoverTrigger>
                <PopoverContent className="text-sm">
                  Above the dialog.
                </PopoverContent>
              </Popover>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export const page: ExamplePage = {
  section: "foundations",
  slug: "motion",
  title: "Motion and layers",
  description:
    "Short ease-out transitions and no decorative animation. Every animated element honours the OS reduced-motion setting and the app toggle.",
  source: "packages/ui/src/styles/globals.css",
  keywords: ["animation", "duration", "z-index", "reduced motion", "layers"],
  examples: [
    {
      id: "durations",
      title: "Durations and easing",
      width: "full",
      render: () => <Durations />,
    },
    { id: "layers", title: "Layers", width: "full", render: () => <Layers /> },
  ],
};
