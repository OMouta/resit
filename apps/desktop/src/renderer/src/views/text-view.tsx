import hljs from "highlight.js/lib/common";
import latex from "highlight.js/lib/languages/latex";
import matlab from "highlight.js/lib/languages/matlab";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";

import { extensionOf, type ResourceInfo } from "../../../shared/workspace";
import { api, errorMessage } from "../lib/api";

hljs.registerLanguage("latex", latex);
hljs.registerLanguage("matlab", matlab);

const LANGUAGES: Record<string, string> = {
  ".py": "python",
  ".m": "matlab",
  ".r": "r",
  ".sql": "sql",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".java": "java",
  ".js": "javascript",
  ".ts": "typescript",
  ".json": "json",
  ".xml": "xml",
  ".html": "xml",
  ".css": "css",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".tex": "latex",
  ".bib": "latex",
  ".md": "markdown",
  ".markdown": "markdown",
};

/** Longer text shows without colours, which would take seconds. */
const MAX_HIGHLIGHT = 300_000;
/** Rows a table shows; the rest is a click away in the default app. */
const MAX_ROWS = 1000;

/** Rows of a CSV or TSV file, with quoted fields that may hold newlines. */
function parseDelimited(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      if (rows.length > MAX_ROWS) return rows;
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length > 0) rows.push([...row, field]);
  return rows;
}

/**
 * A text file as text: code with its colours and line numbers, and a CSV
 * or TSV file as a table.
 */
export function TextView({ resource }: { resource: ResourceInfo }) {
  const { t, number } = useLocale();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const extension = extensionOf(resource.path);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    api.readResourceBytes(resource.id).then(
      (bytes) => {
        if (!cancelled) setText(new TextDecoder().decode(bytes));
      },
      (reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resource.id, resource.revision]);

  const table = useMemo(
    () =>
      text !== null && (extension === ".csv" || extension === ".tsv")
        ? parseDelimited(text, extension === ".tsv" ? "\t" : ",")
        : null,
    [text, extension],
  );
  const html = useMemo(() => {
    if (text === null || table) return null;
    const language = LANGUAGES[extension];
    if (!language || text.length > MAX_HIGHLIGHT) return null;
    return hljs.highlight(text, { language, ignoreIllegals: true }).value;
  }, [text, table, extension]);

  if (error)
    return (
      <EmptyState
        className="h-full"
        title={t("This file could not be opened")}
        description={error}
      />
    );

  const lines = text === null ? 0 : text.split("\n").length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-toolbar shrink-0 items-center gap-3 border-b bg-background px-3">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {[
            resource.path.slice(resource.path.lastIndexOf("/") + 1),
            formatBytes(resource.size, number),
            table
              ? t("{count} rows", {
                  count: number(Math.max(table.length - 1, 0)),
                })
              : lines > 0
                ? t("{count} lines", { count: number(lines) })
                : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <Button
          size="sm"
          variant="subtle"
          onClick={() => void api.openResourceExternally(resource.id)}
        >
          <ExternalLinkIcon /> {t("Open in default app")}
        </Button>
      </div>
      {text === null ? (
        <div className="flex flex-col gap-2 p-6">
          <Skeleton className="h-row w-2/3" />
          <Skeleton className="h-row w-1/2" />
        </div>
      ) : table ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="border-collapse text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {(table[0] ?? []).map((cell, index) => (
                  <th
                    key={index}
                    className="border-r border-b px-3 py-1.5 text-left font-medium whitespace-nowrap"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.slice(1, MAX_ROWS).map((row, index) => (
                <tr key={index} className="hover:bg-accent">
                  {row.map((cell, column) => (
                    <td
                      key={column}
                      className="max-w-96 truncate border-r border-b px-3 py-1 tabular-nums"
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-auto bg-background font-mono text-xs leading-5">
          <div
            aria-hidden
            className="sticky left-0 shrink-0 bg-background py-3 pr-3 pl-4 text-right text-subtle-foreground select-none"
          >
            {Array.from({ length: lines }, (_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          {html !== null ? (
            <pre
              className="hljs flex-1 py-3 pr-6 whitespace-pre"
              // highlight.js escapes the text; the markup is its own spans.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="flex-1 py-3 pr-6 whitespace-pre">{text}</pre>
          )}
        </div>
      )}
    </div>
  );
}
