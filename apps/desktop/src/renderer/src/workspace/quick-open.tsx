import {
  FileTextIcon,
  FolderPlusIcon,
  ImageIcon,
  PaperclipIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@resit/ui/components/command";
import { subjectColorClasses } from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

import type {
  ResourceKind,
  WorkspaceSnapshot,
} from "../../../shared/workspace";

const icons: Record<ResourceKind, typeof FileTextIcon> = {
  note: FileTextIcon,
  pdf: FileTextIcon,
  image: ImageIcon,
  attachment: PaperclipIcon,
};

export interface QuickOpenCommand {
  id: string;
  label: string;
  shortcut?: string;
  icon: "new-note" | "new-subject" | "settings";
  run: () => void;
}

const commandIcons = {
  "new-note": PlusIcon,
  "new-subject": FolderPlusIcon,
  settings: SettingsIcon,
};

/** Ctrl+K: jump to any note or document by title, or run a command. */
export function QuickOpen({
  open,
  onOpenChange,
  snapshot,
  commands,
  onOpenResource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: WorkspaceSnapshot;
  commands: QuickOpenCommand[];
  onOpenResource: (resourceId: string) => void;
}) {
  const subjects = new Map(
    snapshot.subjects.map((subject) => [subject.id, subject]),
  );
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Go to"
      description="Find a note or document by title, or run a command"
    >
      <CommandInput placeholder="Find a note, PDF, or command…" />
      <CommandList>
        <CommandEmpty>Nothing matches that title.</CommandEmpty>
        <CommandGroup heading="Notes and documents">
          {snapshot.resources.map((resource) => {
            const subject = subjects.get(resource.subjectId);
            const Icon = icons[resource.kind];
            return (
              <CommandItem
                key={resource.id}
                value={`${resource.title} ${subject?.name ?? ""} ${resource.id}`}
                onSelect={() => {
                  onOpenChange(false);
                  onOpenResource(resource.id);
                }}
              >
                <Icon
                  className={cn(
                    resource.kind === "pdf" && "text-destructive/70",
                  )}
                />
                <span className="truncate">{resource.title}</span>
                {subject ? (
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        subjectColorClasses[subject.color].dot,
                      )}
                    />
                    {subject.name}
                  </span>
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Commands">
          {commands.map((command) => {
            const Icon = commandIcons[command.icon];
            return (
              <CommandItem
                key={command.id}
                value={command.label}
                onSelect={() => {
                  onOpenChange(false);
                  command.run();
                }}
              >
                <Icon />
                {command.label}
                {command.shortcut ? (
                  <CommandShortcut>{command.shortcut}</CommandShortcut>
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
