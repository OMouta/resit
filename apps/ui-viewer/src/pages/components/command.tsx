import { Button } from "@resit/ui/components/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@resit/ui/components/command";
import {
  FileTextIcon,
  FolderPlusIcon,
  LayersIcon,
  SearchIcon,
  SplitIcon,
} from "lucide-react";
import { useState } from "react";

import { resources } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

function Palette({ ctx }: { ctx: ExampleContext }) {
  return (
    <>
      <CommandInput placeholder="Search notes, PDFs, and commands…" />
      <CommandList>
        <CommandEmpty>No results for that.</CommandEmpty>
        <CommandGroup heading="Commands">
          <CommandItem onSelect={() => ctx.log("onSelect", "new-note")}>
            <FileTextIcon /> New note
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => ctx.log("onSelect", "split")}>
            <SplitIcon /> Split pane right
            <CommandShortcut>⌘\</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => ctx.log("onSelect", "new-subject")}>
            <FolderPlusIcon /> New subject
          </CommandItem>
          <CommandItem onSelect={() => ctx.log("onSelect", "review")}>
            <LayersIcon /> Review due flashcards
            <span className="ml-auto text-xs text-muted-foreground">
              12 due
            </span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Resources">
          {resources.slice(0, 6).map((resource) => (
            <CommandItem
              key={resource.id}
              value={resource.title}
              onSelect={() => ctx.log("onOpen", resource.id)}
            >
              <FileTextIcon />
              <span className="truncate">{resource.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {resource.kind}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </>
  );
}

function DialogExample({ ctx }: { ctx: ExampleContext }) {
  const [open, setOpen] = useState(ctx.state === "open");
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <SearchIcon /> Open command palette
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Palette ctx={ctx} />
      </CommandDialog>
    </>
  );
}

export const page: ExamplePage = {
  section: "components",
  slug: "command",
  title: "Command palette",
  description:
    "Search and run commands from anywhere. ⌘K opens it in the app; arrows move, Enter runs, Escape closes.",
  source: "packages/ui/src/components/command.tsx",
  keywords: ["search", "palette", "cmdk", "shortcut"],
  examples: [
    {
      id: "inline",
      title: "Inline",
      width: 480,
      render: (ctx) => (
        <Command className="rounded-lg border shadow-md">
          <Palette ctx={ctx} />
        </Command>
      ),
    },
    {
      id: "dialog",
      title: "As a dialog",
      width: "auto",
      states: ["closed", "open"],
      render: (ctx) => <DialogExample key={ctx.state} ctx={ctx} />,
    },
  ],
};
