import {
  FileTextIcon,
  ImageIcon,
  LayersIcon,
  MessageSquareIcon,
  PaperclipIcon,
  SearchIcon,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { EmptyState } from "@resit/ui/components/empty-state";
import { Input } from "@resit/ui/components/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@resit/ui/components/toggle-group";
import {
  subjectColorClasses,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

export type SearchResultKind =
  "note" | "pdf" | "image" | "attachment" | "flashcard" | "conversation";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subject?: { name: string; color: SubjectColor };
  /** Snippet with the match wrapped in `<mark>`-like markers: use `{{` and `}}`. */
  snippet: string;
  page?: number;
  /** Heading or block inside the note. */
  location?: string;
}

const icons: Record<SearchResultKind, typeof FileTextIcon> = {
  note: FileTextIcon,
  pdf: FileTextIcon,
  image: ImageIcon,
  attachment: PaperclipIcon,
  flashcard: LayersIcon,
  conversation: MessageSquareIcon,
};

function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <span>
      {parts.map((part, index) => {
        const match = /^\{\{([^}]+)\}\}$/.exec(part);
        return match ? (
          <mark
            key={index}
            className="rounded-sm bg-highlight px-0.5 text-foreground"
          >
            {match[1]}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        );
      })}
    </span>
  );
}

export function SearchResultRow({
  result,
  selected,
  onOpen,
}: {
  result: SearchResult;
  selected?: boolean;
  onOpen: (result: SearchResult) => void;
}) {
  const Icon = icons[result.kind];
  const colors = result.subject
    ? subjectColorClasses[result.subject.color]
    : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(result)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
        selected && "bg-selection",
      )}
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon
          className={cn(
            "size-4",
            result.kind === "pdf" && "text-destructive/70",
          )}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm">
          <span className="truncate font-medium">{result.title}</span>
          {result.page !== undefined ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              p. {result.page}
            </span>
          ) : null}
          {result.location ? (
            <span className="shrink-0 truncate text-xs text-muted-foreground">
              › {result.location}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-sm text-muted-foreground">
          <Snippet text={result.snippet} />
        </span>
        {result.subject ? (
          <span
            className={cn("flex items-center gap-1.5 text-xs", colors?.text)}
          >
            <span
              className={cn("size-1.5 rounded-full", colors?.dot)}
              aria-hidden
            />
            {result.subject.name}
            <span className="text-subtle-foreground">· {result.kind}</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

export interface SearchResultsProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchResult[];
  scope: "workspace" | "subject" | "project";
  onScopeChange: (scope: "workspace" | "subject" | "project") => void;
  scopeLabels?: { subject?: string; project?: string };
  kinds?: SearchResultKind[];
  activeKinds?: SearchResultKind[];
  onKindsChange?: (kinds: SearchResultKind[]) => void;
  selectedId?: string | undefined;
  onOpen: (result: SearchResult) => void;
  status?: "idle" | "searching" | "done";
  header?: ReactNode;
  className?: string;
}

/** Full search view: query, scope, kind filters, and grouped results. */
export function SearchResults({
  query,
  onQueryChange,
  results,
  scope,
  onScopeChange,
  scopeLabels,
  kinds,
  activeKinds,
  onKindsChange,
  selectedId,
  onOpen,
  status = "done",
  header,
  className,
}: SearchResultsProps) {
  const groups = new Map<string, SearchResult[]>();
  for (const result of results) {
    const key = result.subject?.name ?? "Library";
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  return (
    <div
      data-slot="search-results"
      className={cn("flex h-full min-h-0 flex-col @container", className)}
    >
      <div className="flex flex-col gap-3 border-b px-4 py-3">
        {header}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search notes, PDFs, flashcards, and conversations"
            className="h-control-lg pl-9 text-base"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={scope}
            onValueChange={(value) =>
              value && onScopeChange(value as typeof scope)
            }
            variant="outline"
            size="sm"
            aria-label="Search scope"
          >
            <ToggleGroupItem value="workspace">Whole workspace</ToggleGroupItem>
            {scopeLabels?.subject ? (
              <ToggleGroupItem value="subject">
                {scopeLabels.subject}
              </ToggleGroupItem>
            ) : null}
            {scopeLabels?.project ? (
              <ToggleGroupItem value="project">
                {scopeLabels.project}
              </ToggleGroupItem>
            ) : null}
          </ToggleGroup>
          {kinds && onKindsChange ? (
            <ToggleGroup
              type="multiple"
              value={activeKinds ?? kinds}
              onValueChange={(value) =>
                onKindsChange(value as SearchResultKind[])
              }
              size="sm"
              aria-label="Result kinds"
              className="ml-auto"
            >
              {kinds.map((kind) => (
                <ToggleGroupItem key={kind} value={kind} className="capitalize">
                  {kind === "pdf" ? "PDFs" : `${kind}s`}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {status === "searching" ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">Searching…</p>
        ) : null}
        {status === "done" && results.length === 0 ? (
          <EmptyState
            icon={<SearchIcon />}
            title={query ? `No results for “${query}”` : "Type to search"}
            description={
              query
                ? "Try another spelling, or search inside PDFs by enabling PDFs."
                : "Search covers note text, PDF text, flashcards, and conversations in the chosen scope."
            }
          />
        ) : null}
        {Array.from(groups.entries()).map(([group, items]) => (
          <section key={group} className="mb-3">
            <h3 className="px-3 pt-2 pb-1 text-2xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {group} · {items.length}
            </h3>
            {items.map((result) => (
              <SearchResultRow
                key={result.id}
                result={result}
                selected={result.id === selectedId}
                onOpen={onOpen}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
