import { Button } from "@resit/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@resit/ui/components/dialog";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { useState } from "react";

import type { ExamplePage } from "../../viewer/types";

const paragraphs = Array.from(
  { length: 12 },
  (_, i) =>
    `${i + 1}. Import the PDF, then open it from the Mathematics subject. Highlights and notes stay attached to the page even if the file moves inside the workspace.`,
);

function RenameDialog({
  defaultOpen,
  log,
}: {
  defaultOpen: boolean;
  log: (e: string, p?: unknown) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState("Resolution — Worksheet 3");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        log("onOpenChange", next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Rename note</Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            log("rename", title);
            setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename note</DialogTitle>
            <DialogDescription>
              The title shows in the sidebar and in citations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={title.trim().length === 0}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LoadingDialog({
  defaultOpen,
  log,
}: {
  defaultOpen: boolean;
  log: (e: string, p?: unknown) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Export notes</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Export Mathematics as PDF</DialogTitle>
          <DialogDescription>
            14 notes, about 2 MB. Math is rendered as images.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              log("export");
              window.setTimeout(() => {
                setSaving(false);
                setOpen(false);
              }, 1500);
            }}
          >
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const page: ExamplePage = {
  section: "components",
  slug: "dialog",
  title: "Dialog",
  description:
    "Modal for a short task. Escape and the overlay close it; focus returns to the trigger. Use Alert dialog for destructive confirmations.",
  source: "packages/ui/src/components/dialog.tsx",
  keywords: ["modal", "overlay", "form"],
  examples: [
    {
      id: "form",
      title: "Form dialog",
      description: "Enter submits, Escape cancels.",
      width: "auto",
      states: ["closed", "open"],
      render: ({ state, log, resetKey }) => (
        <RenameDialog
          key={`${state}-${resetKey}`}
          defaultOpen={state === "open"}
          log={log}
        />
      ),
    },
    {
      id: "loading",
      title: "Loading action",
      description:
        "While saving, the close controls are disabled so the task cannot be abandoned half way.",
      width: "auto",
      states: ["closed", "open"],
      render: ({ state, log, resetKey }) => (
        <LoadingDialog
          key={`${state}-${resetKey}`}
          defaultOpen={state === "open"}
          log={log}
        />
      ),
    },
    {
      id: "long-content",
      title: "Long content",
      description: "The body scrolls; header and footer stay put.",
      width: "auto",
      states: ["closed", "open"],
      render: ({ state, resetKey }) => (
        <Dialog key={`${state}-${resetKey}`} defaultOpen={state === "open"}>
          <DialogTrigger asChild>
            <Button variant="outline">What's new</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] grid-rows-[auto_1fr_auto]">
            <DialogHeader>
              <DialogTitle>Importing PDFs</DialogTitle>
              <DialogDescription>
                How files, highlights, and notes relate.
              </DialogDescription>
            </DialogHeader>
            <div className="-mx-5 min-h-0 overflow-y-auto px-5">
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                {paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
    },
    {
      id: "no-close-button",
      title: "Without close button",
      description: "For dialogs where the footer actions are the only way out.",
      width: "auto",
      states: ["closed", "open"],
      render: ({ state, resetKey, log }) => (
        <Dialog key={`${state}-${resetKey}`} defaultOpen={state === "open"}>
          <DialogTrigger asChild>
            <Button variant="outline">Choose workspace</Button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Open a workspace</DialogTitle>
              <DialogDescription>
                Pick a recent workspace or open a folder.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1">
              {[
                "Studies 2026/27",
                "Curso Profissional — Informática",
                "Sandbox",
              ].map((name) => (
                <DialogClose asChild key={name}>
                  <button
                    type="button"
                    className="flex h-row items-center rounded-md px-2 text-left text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
                    onClick={() => log("open", name)}
                  >
                    {name}
                  </button>
                </DialogClose>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Open folder…</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ),
    },
  ],
};
