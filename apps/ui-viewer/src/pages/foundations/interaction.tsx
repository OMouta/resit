import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@resit/ui/components/alert-dialog";
import { Button } from "@resit/ui/components/button";
import { Checkbox } from "@resit/ui/components/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { InlineMessage } from "@resit/ui/components/inline-message";
import { Input } from "@resit/ui/components/input";
import { Kbd } from "@resit/ui/components/kbd";
import { Label } from "@resit/ui/components/label";
import { LiveRegion } from "@resit/ui/components/live-region";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@resit/ui/components/popover";
import { Progress } from "@resit/ui/components/progress";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Switch } from "@resit/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useReducedMotion } from "@resit/ui/hooks/use-reduced-motion";
import { shortcutLabel } from "@resit/ui/lib/keys";
import { cn } from "@resit/ui/lib/utils";
import {
  ChevronDownIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { resources } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

const shortcuts = [
  ["Mod+K", "Command palette and search"],
  ["Mod+P", "Open a resource by name"],
  ["Mod+S", "Save the note"],
  ["Mod+\\", "Split the pane"],
  ["Mod+Shift+A", "Attach the selection to the conversation"],
  ["Escape", "Stop the current turn, close overlays"],
] as const;

function Announcer({ ctx }: { ctx: ExampleContext }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setMessage("Turn complete. Two sources cited.");
            ctx.log("announce", "turn complete");
          }}
        >
          Finish a turn
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setMessage(
              "Could not save Resolution — Worksheet 3. Disk is full.",
            );
            ctx.log("announce", "error");
          }}
        >
          Raise an error
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Add subject">
              <PlusIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Icon-only buttons carry an aria-label</TooltipContent>
        </Tooltip>
      </div>
      <LiveRegion
        message={message}
        politeness={message.startsWith("Could not") ? "assertive" : "polite"}
      />
      <p className="text-xs text-muted-foreground">
        Last announcement:{" "}
        <span className="font-mono">{message || "none yet"}</span>
      </p>
    </div>
  );
}

function ReducedMotionDemo() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Reduced motion is{" "}
        <span className="font-medium text-foreground">
          {reduced ? "on" : "off"}
        </span>
        . Turn it on with the viewer switch or your OS setting: the bar stops
        sliding and the dialog appears without a fade.
      </p>
      <Progress indeterminate aria-label="Working" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-fit">
            Open dialog
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motion respects the setting</DialogTitle>
            <DialogDescription>
              Transitions collapse to 0.01ms when reduced motion is on.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NestedDialogs({ ctx }: { ctx: ExampleContext }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Rename subject…</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Mathematics</DialogTitle>
          <DialogDescription>
            Escape closes only the top-most overlay. Focus returns to the
            control that opened it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rename">Name</Label>
          <Input id="rename" defaultValue="Mathematics" />
        </div>
        <DialogFooter className="sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive-outline">
                <Trash2Icon /> Move to trash
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Move Mathematics to trash?</AlertDialogTitle>
                <AlertDialogDescription>
                  Its 4 resources go with it as one recoverable action.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => ctx.log("trash")}
                >
                  Move to trash
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More options">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => ctx.log("archive")}>
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => ctx.log("colour")}>
                  Change colour
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => ctx.log("rename")}>Rename</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const page: ExamplePage = {
  section: "foundations",
  slug: "interaction",
  title: "Interaction and accessibility",
  description:
    "Keyboard focus, shortcuts, states, error messaging, reduced motion, screen-reader announcements, and how overlays behave. Every example here works with the keyboard alone.",
  source: "packages/ui/src/styles/globals.css",
  keywords: [
    "keyboard",
    "focus",
    "a11y",
    "accessibility",
    "shortcuts",
    "portal",
    "dialog",
    "live region",
  ],
  examples: [
    {
      id: "focus",
      title: "Visible focus",
      description:
        "Tab through: the ring is the same in both themes and never relies on colour alone.",
      width: "auto",
      render: () => (
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Input placeholder="Input" className="w-40" />
          <span className="flex items-center gap-2">
            <Checkbox id="focus-check" />
            <Label htmlFor="focus-check">Checkbox</Label>
          </span>
          <Switch aria-label="Switch" />
          <a
            href="#focus"
            className="text-sm text-link underline-offset-2 hover:underline"
          >
            Link
          </a>
        </div>
      ),
    },
    {
      id: "shortcuts",
      title: "Shortcuts",
      width: 480,
      render: () => (
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          {shortcuts.map(([combo, what]) => (
            <div key={combo} className="contents">
              <dt className="flex gap-1">
                {shortcutLabel(combo).map((key, index) => (
                  <Kbd key={index}>{key}</Kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{what}</dd>
            </div>
          ))}
        </dl>
      ),
    },
    {
      id: "states",
      title: "Selected, disabled, loading",
      width: "full",
      render: () => (
        <div className="grid gap-6 @md:grid-cols-2">
          <div className="flex flex-col gap-1">
            {resources.slice(0, 4).map((resource, index) => (
              <div
                key={resource.id}
                aria-selected={index === 1}
                aria-disabled={index === 3}
                className={cn(
                  "flex h-row items-center rounded-md px-2 text-sm",
                  index === 1 && "bg-selection font-medium",
                  index === 3 && "opacity-50",
                  index !== 3 && "hover:bg-accent",
                )}
              >
                <span className="truncate">{resource.title}</span>
                {index === 1 ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Selected
                  </span>
                ) : null}
                {index === 3 ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Disabled
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>
              Disabled outline
            </Button>
            <Input disabled placeholder="Disabled input" className="w-40" />
            <Input aria-invalid placeholder="Invalid input" className="w-40" />
          </div>
        </div>
      ),
    },
    {
      id: "errors",
      title: "Error messaging",
      width: 520,
      render: (ctx) => (
        <InlineMessage
          tone="error"
          title="Could not import scan_0042.pdf"
          actions={
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => ctx.log("chooseAnother")}
              >
                Choose another file
              </Button>
              <Button
                size="sm"
                variant="subtle"
                onClick={() => ctx.log("help")}
              >
                How to remove a password
              </Button>
            </>
          }
        >
          The PDF is encrypted. Remove the password, then import it again.
          Nothing was added to Mathematics.
        </InlineMessage>
      ),
    },
    {
      id: "motion",
      title: "Reduced motion",
      width: 480,
      render: () => <ReducedMotionDemo />,
    },
    {
      id: "announce",
      title: "Screen-reader announcements",
      description:
        "Completed turns and errors are announced through a live region that is visually hidden.",
      width: 520,
      render: (ctx) => <Announcer ctx={ctx} />,
    },
    {
      id: "portals",
      title: "Portals inside scroll containers",
      description:
        "Popovers and tooltips escape the clipped scroll area and stay attached to their trigger.",
      width: 480,
      render: () => (
        <ScrollArea className="h-40 rounded-lg border">
          <div className="flex flex-col gap-2 p-3">
            {resources.slice(0, 6).map((resource) => (
              <div key={resource.id} className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {resource.title}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{resource.title}</TooltipContent>
                </Tooltip>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      Details <ChevronDownIcon />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="text-sm">
                    <p className="font-medium">{resource.title}</p>
                    <p className="text-muted-foreground">{resource.path}</p>
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>
        </ScrollArea>
      ),
    },
    {
      id: "nested",
      title: "Nested overlays",
      description:
        "A dialog with a menu and a confirmation inside it. Escape closes one layer at a time; focus returns to the trigger.",
      width: "auto",
      render: (ctx) => <NestedDialogs ctx={ctx} />,
    },
  ],
};
