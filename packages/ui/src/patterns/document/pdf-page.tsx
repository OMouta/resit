import { AlertTriangleIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { Skeleton } from "@resit/ui/components/skeleton";
import { cn } from "@resit/ui/lib/utils";
import {
  annotationColorClasses,
  type AnnotationColor,
} from "@resit/ui/patterns/document/pdf-toolbar";

export interface PageRect {
  /** Fractions of the page width and height. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageFrameProps {
  pageNumber: number;
  /** Width divided by height. A4 portrait is 0.707. */
  aspect?: number;
  /** Rendered width in CSS pixels. Omit to fill the container. */
  width?: number;
  status?: "ready" | "loading" | "error";
  onRetry?: () => void;
  /** The rendered page (canvas, image, or a placeholder). */
  children?: ReactNode;
  /** Overlays positioned in page fractions. */
  overlays?: ReactNode;
  current?: boolean;
  className?: string;
}

/** A page surface with page number, loading and error states, and overlays. */
export function PdfPageFrame({
  pageNumber,
  aspect = 0.707,
  width,
  status = "ready",
  onRetry,
  children,
  overlays,
  current = false,
  className,
}: PdfPageFrameProps) {
  return (
    <figure
      data-slot="pdf-page"
      data-page={pageNumber}
      aria-label={`Page ${pageNumber}`}
      className={cn("relative mx-auto flex w-full flex-col gap-1.5", className)}
      style={{ maxWidth: width }}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-white text-[#1a1a1a] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-[#f4f4f2] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]",
          current && "ring-2 ring-ring/60 ring-offset-2 ring-offset-background",
        )}
        style={{ aspectRatio: String(aspect) }}
      >
        {status === "ready" ? children : null}
        {status === "loading" ? (
          <div
            className="absolute inset-0 flex flex-col gap-3 p-[8%]"
            aria-busy
          >
            <Skeleton className="h-4 w-2/3 bg-black/8" />
            <Skeleton className="h-3 w-full bg-black/8" />
            <Skeleton className="h-3 w-11/12 bg-black/8" />
            <Skeleton className="h-3 w-4/5 bg-black/8" />
            <Skeleton className="mt-4 h-3 w-full bg-black/8" />
            <Skeleton className="h-3 w-3/4 bg-black/8" />
          </div>
        ) : null}
        {status === "error" ? (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
          >
            <AlertTriangleIcon className="size-5 text-warning" />
            <p className="text-sm font-medium">
              Could not render page {pageNumber}
            </p>
            <p className="text-xs text-[#5a5a5a]">
              The page data is damaged or the renderer stopped.
            </p>
            {onRetry ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mt-1"
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
        {status === "ready" ? overlays : null}
      </div>
      <figcaption className="text-center text-xs tabular-nums text-muted-foreground">
        {pageNumber}
      </figcaption>
    </figure>
  );
}

/** Draws fixture text lines on a page so examples look like a worksheet. */
export function PdfPagePlaceholder({
  lines,
  title,
}: {
  lines: readonly string[];
  title?: string | undefined;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col gap-[0.9em] px-[10%] pt-[9%] pb-[8%] font-serif text-[clamp(8px,1.9cqw,15px)] leading-snug select-none @container"
      aria-hidden
    >
      {title ? (
        <p className="mb-[0.6em] text-[1.2em] font-semibold">{title}</p>
      ) : null}
      {lines.map((line, index) => (
        <p
          key={index}
          className={cn("whitespace-pre-wrap", line === "" && "h-[0.4em]")}
        >
          {line}
        </p>
      ))}
      <p className="mt-auto text-right text-[0.8em] text-[#777]">
        Análise Matemática I
      </p>
    </div>
  );
}

function rectStyle(rect: PageRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

export function HighlightOverlay({
  rect,
  color,
  kind = "highlight",
  selected,
  label,
  onSelect,
}: {
  rect: PageRect;
  color: AnnotationColor;
  kind?: "highlight" | "underline";
  selected?: boolean;
  label: string;
  onSelect?: () => void;
}) {
  const colors = annotationColorClasses[color];
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "absolute rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        kind === "highlight" && cn(colors.fill, "mix-blend-multiply"),
        kind === "underline" && "border-b-2 bg-transparent",
        kind === "underline" && colors.swatch.replace("bg-", "border-"),
        selected && "ring-2 ring-ring",
      )}
      style={rectStyle(rect)}
    />
  );
}

/** Dashed region with corner handles. `description` is the text alternative. */
export function SelectionRegion({
  rect,
  description,
  selected = true,
  color = "blue",
  onSelect,
}: {
  rect: PageRect;
  description: string;
  selected?: boolean;
  color?: AnnotationColor;
  onSelect?: () => void;
}) {
  const colors = annotationColorClasses[color];
  return (
    <button
      type="button"
      role="img"
      aria-label={`Selected region: ${description}`}
      onClick={onSelect}
      className={cn(
        "absolute rounded-[3px] border-2 border-dashed outline-none focus-visible:ring-2 focus-visible:ring-ring",
        colors.swatch.replace("bg-", "border-"),
        selected ? "bg-subject-blue/10" : "bg-transparent opacity-70",
      )}
      style={rectStyle(rect)}
    >
      {selected
        ? (
            [
              "-top-1 -left-1",
              "-top-1 -right-1",
              "-bottom-1 -left-1",
              "-bottom-1 -right-1",
            ] as const
          ).map((position) => (
            <span
              key={position}
              aria-hidden
              className={cn(
                "absolute size-2 rounded-[2px] border border-white bg-subject-blue shadow-sm",
                position,
              )}
            />
          ))
        : null}
    </button>
  );
}
