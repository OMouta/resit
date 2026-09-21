import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@resit/ui/components/empty-state";
import { cn } from "@resit/ui/lib/utils";
import { useLocale } from "@resit/ui/hooks/use-locale";

/** Width a page thumbnail is drawn at, in CSS pixels. */
const THUMBNAIL_WIDTH = 124;

async function drawThumbnail(
  document: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
): Promise<void> {
  const page = await document.getPage(pageNumber);
  const ratio = window.devicePixelRatio || 1;
  const unscaled = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: (THUMBNAIL_WIDTH / unscaled.width) * ratio,
  });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  try {
    await page.render({ canvasContext: context, viewport, canvas }).promise;
  } finally {
    page.cleanup();
  }
}

export interface PdfThumbnailsProps {
  document: PDFDocumentProxy | null;
  pageCount: number;
  page: number;
  onSelect: (page: number) => void;
}

/** Every page as a picture. Pages are drawn as they scroll into view. */
export function PdfThumbnails({
  document,
  pageCount,
  page,
  onSelect,
}: PdfThumbnailsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const drawn = useRef(new Set<number>());

  useEffect(() => {
    drawn.current = new Set();
    const root = rootRef.current;
    if (!root || !document) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const canvas = entry.target as HTMLCanvasElement;
          const number = Number(canvas.dataset.page);
          if (!number || drawn.current.has(number)) continue;
          drawn.current.add(number);
          drawThumbnail(document, number, canvas).catch(() => {
            drawn.current.delete(number);
          });
        }
      },
      { root, rootMargin: "300px" },
    );
    for (const canvas of root.querySelectorAll("canvas"))
      observer.observe(canvas);
    return () => observer.disconnect();
  }, [document, pageCount]);

  // Reading on keeps the matching thumbnail in sight.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [page]);

  return (
    <div
      ref={rootRef}
      className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3"
    >
      <ul className="flex flex-col items-center gap-3">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(
          (number) => (
            <li key={number}>
              <button
                type="button"
                ref={number === page ? activeRef : undefined}
                aria-label={`Page ${number}`}
                aria-current={number === page ? "true" : undefined}
                onClick={() => onSelect(number)}
                className="flex flex-col items-center gap-1 rounded-md outline-none focus-visible:shadow-focus"
              >
                <canvas
                  data-page={number}
                  style={{ width: THUMBNAIL_WIDTH, height: 160 }}
                  className={cn(
                    "rounded-sm border bg-white shadow-sm transition-[box-shadow,border-color] duration-(--duration-fast)",
                    number === page
                      ? "border-ring shadow-focus"
                      : "hover:border-border-strong",
                  )}
                />
                <span
                  className={cn(
                    "text-2xs tabular-nums",
                    number === page
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {number}
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/** One entry of a PDF's own table of contents. */
interface OutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items: OutlineItem[];
}

export interface PdfOutlineProps {
  document: PDFDocumentProxy | null;
  onGoTo: (destination: string | unknown[]) => void;
}

/** The PDF's table of contents, as the file itself records it. */
export function PdfOutline({ document, onGoTo }: PdfOutlineProps) {
  const { t } = useLocale();
  const [items, setItems] = useState<OutlineItem[] | null>(null);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    document.getOutline().then(
      (outline) => {
        if (!cancelled) setItems((outline as OutlineItem[] | null) ?? []);
      },
      () => {
        if (!cancelled) setItems([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [document]);

  if (items === null) return null;
  if (items.length === 0)
    return (
      <EmptyState
        size="compact"
        title={t("No contents")}
        description={t("This PDF does not carry a table of contents.")}
        className="m-3"
      />
    );

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
      <OutlineBranch items={items} depth={0} onGoTo={onGoTo} />
    </div>
  );
}

function OutlineBranch({
  items,
  depth,
  onGoTo,
}: {
  items: OutlineItem[];
  depth: number;
  onGoTo: (destination: string | unknown[]) => void;
}) {
  return (
    <ul className="flex flex-col gap-px">
      {items.map((item, index) => (
        <OutlineRow
          key={`${depth}-${index}-${item.title}`}
          item={item}
          depth={depth}
          onGoTo={onGoTo}
        />
      ))}
    </ul>
  );
}

function OutlineRow({
  item,
  depth,
  onGoTo,
}: {
  item: OutlineItem;
  depth: number;
  onGoTo: (destination: string | unknown[]) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(depth === 0);
  const children = item.items.length > 0;
  return (
    <li>
      <div
        className="flex items-center gap-0.5"
        style={{ paddingLeft: depth * 10 }}
      >
        {children ? (
          <button
            type="button"
            aria-label={open ? t("Collapse") : t("Expand")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-subtle-foreground hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            <ChevronRightIcon
              className={cn(
                "size-3.5 transition-transform duration-(--duration-fast)",
                open && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span aria-hidden className="size-5 shrink-0" />
        )}
        <button
          type="button"
          title={item.title}
          disabled={!item.dest}
          onClick={() => item.dest && onGoTo(item.dest)}
          className="flex h-row min-w-0 flex-1 items-center rounded-control px-1.5 text-left text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:shadow-focus disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span className="truncate">{item.title}</span>
        </button>
      </div>
      {children && open ? (
        <OutlineBranch items={item.items} depth={depth + 1} onGoTo={onGoTo} />
      ) : null}
    </li>
  );
}
