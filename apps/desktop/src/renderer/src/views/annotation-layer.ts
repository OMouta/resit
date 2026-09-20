import { cn } from "@resit/ui/lib/utils";

import type {
  Annotation,
  AnnotationColorValue,
} from "../../../shared/workspace";
import {
  rectsForPage,
  renderedPages,
  type PageViewSource,
} from "./annotation-geometry";

const LAYER_CLASS = "resit-annotation-layer";

/**
 * Marks blend with the page underneath, so a highlight over printed text
 * reads like a highlighter rather than a coloured box.
 */
const FILL: Record<AnnotationColorValue, string> = {
  yellow: "bg-subject-yellow/40 mix-blend-multiply",
  green: "bg-subject-green/35 mix-blend-multiply",
  blue: "bg-subject-blue/30 mix-blend-multiply",
  pink: "bg-subject-pink/30 mix-blend-multiply",
};

const LINE: Record<AnnotationColorValue, string> = {
  yellow: "border-subject-yellow",
  green: "border-subject-green",
  blue: "border-subject-blue",
  pink: "border-subject-pink",
};

function layerFor(page: HTMLDivElement): HTMLDivElement {
  const existing = page.querySelector<HTMLDivElement>(
    `:scope > .${LAYER_CLASS}`,
  );
  if (existing) return existing;
  const layer = document.createElement("div");
  // Marks are decorative: the annotation list is the keyboard path, and
  // clicks are matched against the stored geometry instead.
  layer.className = cn(LAYER_CLASS, "pointer-events-none absolute inset-0");
  layer.setAttribute("aria-hidden", "true");
  page.append(layer);
  return layer;
}

/**
 * Draws every annotation mark on the pages PDF.js currently has rendered.
 * Positions are fractions of the page, so zooming does not need a repaint,
 * but re-rendering a page drops the layer and needs one.
 */
export function paintAnnotations(
  source: PageViewSource,
  annotations: Annotation[],
  selectedId: string | null,
): void {
  for (const page of renderedPages(source)) {
    const marks: HTMLDivElement[] = [];
    for (const annotation of annotations) {
      for (const rect of rectsForPage(
        annotation,
        page.index,
        page.view.viewport,
      )) {
        const mark = document.createElement("div");
        mark.className = cn(
          "absolute",
          annotation.type === "highlight"
            ? cn("rounded-[2px]", FILL[annotation.color])
            : cn("border-b-2", LINE[annotation.color]),
          annotation.id === selectedId &&
            "outline-2 outline-offset-1 outline-ring",
        );
        mark.style.left = `${rect.x * 100}%`;
        mark.style.top = `${rect.y * 100}%`;
        mark.style.width = `${rect.width * 100}%`;
        mark.style.height = `${rect.height * 100}%`;
        marks.push(mark);
      }
    }
    layerFor(page.view.div).replaceChildren(...marks);
  }
}
