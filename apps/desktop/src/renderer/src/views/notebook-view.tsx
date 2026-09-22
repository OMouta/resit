import hljs from "highlight.js/lib/common";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";

import { parseNotebook, type Notebook } from "../../../shared/notebook";
import type { ResourceInfo } from "../../../shared/workspace";
import { ChatMarkdown } from "../chat/markdown";
import { api, errorMessage } from "../lib/api";

function highlighted(source: string, language: string): string | null {
  if (!hljs.getLanguage(language)) return null;
  return hljs.highlight(source, { language, ignoreIllegals: true }).value;
}

/** A Jupyter notebook as it was last saved: its cells and their outputs. */
export function NotebookView({ resource }: { resource: ResourceInfo }) {
  const { t, number } = useLocale();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNotebook(null);
    setError(null);
    api.readResourceBytes(resource.id).then(
      (bytes) => {
        if (cancelled) return;
        const parsed = parseNotebook(new TextDecoder().decode(bytes));
        if (parsed) setNotebook(parsed);
        else setError(t("This is not a notebook resit can read."));
      },
      (reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resource.id, resource.revision, t]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-toolbar shrink-0 items-center gap-3 border-b bg-background px-3">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {resource.path.slice(resource.path.lastIndexOf("/") + 1)} ·{" "}
          {formatBytes(resource.size, number)}
        </span>
        <Button
          size="sm"
          variant="subtle"
          onClick={() => void api.openResourceExternally(resource.id)}
        >
          <ExternalLinkIcon /> {t("Open in default app")}
        </Button>
      </div>
      {error ? (
        <EmptyState
          className="flex-1"
          title={t("This file could not be opened")}
          description={error}
        />
      ) : notebook === null ? (
        <div className="flex flex-col gap-2 p-6">
          <Skeleton className="h-row w-2/3" />
          <Skeleton className="h-row w-1/2" />
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 bg-background">
          <div className="mx-auto flex w-full max-w-[calc(var(--document-measure)+8rem)] flex-col gap-4 px-8 py-8">
            {notebook.cells.map((cell, index) =>
              cell.kind === "markdown" ? (
                <div key={index} className="document">
                  <ChatMarkdown text={cell.source} />
                </div>
              ) : (
                <div key={index} className="flex flex-col gap-2">
                  <CodeBlock
                    source={cell.source}
                    language={cell.kind === "code" ? notebook.language : ""}
                  />
                  {cell.outputs.map((output, at) =>
                    output.type === "image" ? (
                      <img
                        key={at}
                        alt={t("Output of cell {number}", {
                          number: index + 1,
                        })}
                        src={`data:${output.mime};base64,${output.data}`}
                        className="max-w-full self-start rounded-md bg-white"
                      />
                    ) : (
                      <pre
                        key={at}
                        className={
                          output.type === "error"
                            ? "overflow-x-auto rounded-md bg-danger-soft px-3 py-2 font-mono text-xs leading-5 text-destructive"
                            : "overflow-x-auto px-3 font-mono text-xs leading-5 text-muted-foreground"
                        }
                      >
                        {output.text}
                      </pre>
                    ),
                  )}
                </div>
              ),
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function CodeBlock({ source, language }: { source: string; language: string }) {
  const html = language ? highlighted(source, language) : null;
  const className =
    "overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs leading-5";
  return html !== null ? (
    <pre
      className={`hljs ${className}`}
      // highlight.js escapes the text; the markup is its own spans.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <pre className={className}>{source}</pre>
  );
}
