import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";
import { cn } from "@resit/ui/lib/utils";

import type { OfficeContent, ResourceInfo } from "../../../shared/workspace";
import { api, errorMessage } from "../lib/api";

/**
 * The words of a Word, PowerPoint, or Excel file, without its layout: the
 * default app shows it as designed.
 */
export function OfficeView({ resource }: { resource: ResourceInfo }) {
  const { t, number } = useLocale();
  const [content, setContent] = useState<OfficeContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(0);
  /** A Word document laid out, when resit could lay it out. */
  const [html, setHtml] = useState<string | null>(null);
  const word = resource.path.toLowerCase().endsWith(".docx");

  useEffect(() => {
    if (!word) return;
    let cancelled = false;
    setHtml(null);
    // Without a layout, the paragraphs below still show.
    api.renderWordDocument(resource.id).then(
      (next) => {
        if (!cancelled) setHtml(next);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [resource.id, resource.revision, word]);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    api.readOfficeContent(resource.id).then(
      (next) => {
        if (cancelled) return;
        if (next) setContent(next);
        else setError(t("resit cannot read this kind of file."));
      },
      (reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resource.id, resource.revision, t]);

  const toolbar = (
    <div className="flex h-toolbar shrink-0 items-center gap-3 border-b bg-background px-3">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {resource.path.slice(resource.path.lastIndexOf("/") + 1)} ·{" "}
        {formatBytes(resource.size, number)}
        {html === null
          ? ` · ${t("Text only. The default app shows its layout.")}`
          : null}
      </span>
      <Button
        size="sm"
        variant="subtle"
        onClick={() => void api.openResourceExternally(resource.id)}
      >
        <ExternalLinkIcon /> {t("Open in default app")}
      </Button>
    </div>
  );

  if (error)
    return (
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <EmptyState
          className="flex-1"
          title={t("This file could not be opened")}
          description={error}
        />
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar}
      {content === null ? (
        <div className="flex flex-col gap-2 p-6">
          <Skeleton className="h-row w-2/3" />
          <Skeleton className="h-row w-1/2" />
        </div>
      ) : content.format === "xlsx" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {content.sheets.length > 1 ? (
            <div
              role="tablist"
              aria-label={t("Sheets")}
              className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5"
            >
              {content.sheets.map((entry, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === sheet}
                  onClick={() => setSheet(index)}
                  className={cn(
                    "h-control shrink-0 rounded-md px-3 text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
                    index === sheet && "bg-accent font-medium",
                  )}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="border-collapse text-sm">
              <tbody>
                {(content.sheets[sheet]?.rows ?? []).map((row, index) => (
                  <tr key={index} className="hover:bg-accent">
                    <th className="sticky left-0 border-r border-b bg-muted px-2 py-1 text-right text-xs font-normal text-subtle-foreground tabular-nums">
                      {index + 1}
                    </th>
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
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 bg-canvas">
          <div className="mx-auto flex w-full max-w-[calc(var(--document-measure)+4rem)] flex-col gap-4 px-8 py-8">
            {content.format === "pptx" ? (
              content.slides.map((slide, index) => (
                <section
                  key={index}
                  aria-label={t("Slide {number}", { number: index + 1 })}
                  className="flex flex-col gap-1.5 rounded-lg border bg-background px-5 py-4 shadow-sm"
                >
                  <span className="text-2xs font-medium tracking-wide text-subtle-foreground uppercase">
                    {t("Slide {number}", { number: index + 1 })}
                  </span>
                  {slide.lines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("No text on this slide.")}
                    </p>
                  ) : (
                    slide.lines.map((line, at) => (
                      <p
                        key={at}
                        className={cn(
                          "whitespace-pre-wrap",
                          at === 0 ? "text-base font-semibold" : "text-sm",
                        )}
                      >
                        {line}
                      </p>
                    ))
                  )}
                </section>
              ))
            ) : html !== null ? (
              <article
                className="document word-document rounded-lg border bg-background px-8 py-6 shadow-sm"
                onClick={(event) => {
                  const link = (event.target as Element).closest("a");
                  if (!link) return;
                  event.preventDefault();
                  const href = link.getAttribute("href");
                  if (href && !href.startsWith("#"))
                    void api.openExternal(href).catch(() => undefined);
                }}
                // mammoth writes this HTML from the document's structure,
                // escaping its text; links are checked in the main process.
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <article className="document rounded-lg border bg-background px-8 py-6 shadow-sm">
                {content.paragraphs.map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
              </article>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
