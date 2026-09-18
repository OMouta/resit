import {
  FileTextIcon,
  FolderPlusIcon,
  ImageIcon,
  PaperclipIcon,
  PlusIcon,
  SettingsIcon,
  TextSearchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

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

import type { SearchResult } from "../../../shared/ipc";
import type {
  ResourceKind,
  WorkspaceSnapshot,
} from "../../../shared/workspace";
import { api } from "../lib/api";

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

/** Lowercase without accents, so "analise" finds "Análise". */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function matches(text: string, words: string[]): boolean {
  const folded = fold(text);
  return words.every((word) => folded.includes(word));
}

/**
 * Ctrl+K: jump to a note or document by title, search inside notes and
 * PDFs, or run a command.
 */
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
  onOpenResource: (resourceId: string, page?: number) => void;
}) {
  const subjects = new Map(
    snapshot.subjects.map((subject) => [subject.id, subject]),
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const words = fold(query).split(/\s+/).filter(Boolean);
  const titleHits = snapshot.resources
    .filter((resource) =>
      matches(
        `${resource.title} ${subjects.get(resource.subjectId)?.name ?? ""}`,
        words,
      ),
    )
    .slice(0, 50);
  const commandHits = commands.filter((command) =>
    matches(command.label, words),
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.search(text).then(
        (hits) => {
          if (cancelled) return;
          // Title-only hits already appear in the first group.
          setResults(
            hits.filter(
              (hit) =>
                hit.page !== undefined || !fold(hit.title).includes(fold(text)),
            ),
          );
          setSearching(false);
        },
        () => {
          if (!cancelled) setSearching(false);
        },
      );
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const openHit = (resourceId: string, page?: number) => {
    onOpenChange(false);
    onOpenResource(resourceId, page);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Go to"
      description="Find a note or document, search inside them, or run a command"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Find a note, PDF, or command…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Searching…" : "Nothing matches."}
        </CommandEmpty>
        {titleHits.length > 0 ? (
          <CommandGroup heading="Notes and documents">
            {titleHits.map((resource) => {
              const subject = subjects.get(resource.subjectId);
              const Icon = icons[resource.kind];
              return (
                <CommandItem
                  key={resource.id}
                  value={`resource ${resource.id}`}
                  onSelect={() => openHit(resource.id)}
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
        ) : null}
        {results.length > 0 ? (
          <CommandGroup heading="Inside notes and PDFs">
            {results.map((hit) => {
              const subject = subjects.get(hit.subjectId);
              return (
                <CommandItem
                  key={`${hit.resourceId}-${hit.page ?? 0}`}
                  value={`search ${hit.resourceId} ${hit.page ?? 0}`}
                  onSelect={() => openHit(hit.resourceId, hit.page)}
                  className="items-start"
                >
                  <TextSearchIcon className="mt-0.5" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{hit.title}</span>
                      {hit.page ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          p. {hit.page}
                        </span>
                      ) : null}
                      {subject ? (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {subject.name}
                        </span>
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {hit.snippet}
                    </span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
        {commandHits.length > 0 ? (
          <CommandGroup heading="Commands">
            {commandHits.map((command) => {
              const Icon = commandIcons[command.icon];
              return (
                <CommandItem
                  key={command.id}
                  value={`command ${command.id}`}
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
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
