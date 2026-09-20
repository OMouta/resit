import type { PageViewport } from "pdfjs-dist";

import type {
  Annotation,
  AnnotationQuad,
  AnnotationSegment,
} from "../../../shared/workspace";

/**
 * The parts of a PDF.js page view this module needs. `getPageView` is
 * untyped, so the shape is stated here instead.
 */
export interface PageView {
  div: HTMLDivElement;
  textLayer: { div: HTMLDivElement } | null;
  viewport: PageViewport;
  getPagePoint(x: number, y: number): number[];
}

export interface PageViewSource {
  pagesCount: number;
  getPageView(index: number): unknown;
}

/** A rectangle as fractions of the page box, so it survives zooming. */
export interface FractionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Pages that are rendered right now, with the box their text sits in. */
export function renderedPages(
  source: PageViewSource,
): { index: number; view: PageView; box: DOMRect }[] {
  const pages: { index: number; view: PageView; box: DOMRect }[] = [];
  for (let index = 0; index < source.pagesCount; index += 1) {
    const view = source.getPageView(index) as PageView | undefined;
    const layer = view?.textLayer?.div;
    if (!view || !layer?.isConnected) continue;
    pages.push({ index, view, box: layer.getBoundingClientRect() });
  }
  return pages;
}

function contains(box: DOMRect, x: number, y: number): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

/**
 * Joins the client rects of one selected line into a single rectangle. A
 * wide gap, such as the gutter between two columns, stays separate.
 */
function mergeLines(rects: Box[]): Box[] {
  const lines: Box[] = [];
  for (const rect of [...rects].sort(
    (a, b) => a.top - b.top || a.left - b.left,
  )) {
    const height = rect.bottom - rect.top;
    const match = lines.find((line) => {
      const overlap =
        Math.min(line.bottom, rect.bottom) - Math.max(line.top, rect.top);
      if (overlap < 0.6 * Math.min(height, line.bottom - line.top))
        return false;
      const gap = Math.max(line.left - rect.right, rect.left - line.right);
      return gap <= 2 * height;
    });
    if (!match) {
      lines.push({ ...rect });
      continue;
    }
    match.left = Math.min(match.left, rect.left);
    match.right = Math.max(match.right, rect.right);
    match.top = Math.min(match.top, rect.top);
    match.bottom = Math.max(match.bottom, rect.bottom);
  }
  return lines;
}

/** PDF.js returns points as arrays; this keeps the pair typed. */
function point(values: number[]): [number, number] {
  return [values[0] ?? 0, values[1] ?? 0];
}

/** Corners in the order PDF QuadPoints uses: top-left, top-right, bottom-left, bottom-right. */
function quadFrom(
  view: PageView,
  box: DOMRect,
  rect: Box,
): AnnotationQuad | null {
  if (rect.right - rect.left < 0.5 || rect.bottom - rect.top < 0.5) return null;
  const [ax, ay] = point(
    view.getPagePoint(rect.left - box.left, rect.top - box.top),
  );
  const [bx, by] = point(
    view.getPagePoint(rect.right - box.left, rect.bottom - box.top),
  );
  const xMin = Math.min(ax, bx);
  const xMax = Math.max(ax, bx);
  const yMin = Math.min(ay, by);
  const yMax = Math.max(ay, by);
  return [xMin, yMax, xMax, yMax, xMin, yMin, xMax, yMin];
}

/** `[xMin, yMin, xMax, yMax]` covered by one quad. */
export function quadBounds(
  quad: AnnotationQuad,
): [number, number, number, number] {
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * Turns a text selection inside the viewer into one segment per page, in
 * unrotated PDF user space so the highlight holds at any zoom or rotation.
 */
export function segmentsFromSelection(
  selection: Selection,
  source: PageViewSource,
): AnnotationSegment[] {
  if (selection.rangeCount === 0 || selection.isCollapsed) return [];
  const pages = renderedPages(source);
  if (pages.length === 0) return [];
  const perPage = new Map<number, Box[]>();
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    for (const client of range.getClientRects()) {
      if (client.width < 0.5 || client.height < 0.5) continue;
      const centreX = client.left + client.width / 2;
      const centreY = client.top + client.height / 2;
      const page = pages.find((entry) => contains(entry.box, centreX, centreY));
      if (!page) continue;
      const rects = perPage.get(page.index) ?? [];
      rects.push({
        left: client.left,
        top: client.top,
        right: client.right,
        bottom: client.bottom,
      });
      perPage.set(page.index, rects);
    }
  }

  const text = selection.toString();
  const segments: AnnotationSegment[] = [];
  for (const page of pages) {
    const rects = perPage.get(page.index);
    if (!rects) continue;
    const quads = mergeLines(rects)
      .map((rect) => quadFrom(page.view, page.box, rect))
      .filter((quad): quad is AnnotationQuad => quad !== null);
    if (quads.length === 0) continue;
    const box = page.view.viewport.viewBox;
    segments.push({
      pageIndex: page.index,
      cropBox: [box[0] ?? 0, box[1] ?? 0, box[2] ?? 0, box[3] ?? 0],
      quads,
      // One page's share of a selection is not separable from the rest, so
      // every segment carries the whole quoted text.
      text,
    });
  }
  return segments;
}

/** Where an annotation's lines fall on one page, as fractions of the page. */
export function rectsForPage(
  annotation: Annotation,
  pageIndex: number,
  viewport: PageViewport,
): FractionRect[] {
  const rects: FractionRect[] = [];
  for (const segment of annotation.segments) {
    if (segment.pageIndex !== pageIndex) continue;
    for (const quad of segment.quads) {
      const [xMin, yMin, xMax, yMax] = quadBounds(quad);
      const [ax, ay] = point(viewport.convertToViewportPoint(xMin, yMin));
      const [bx, by] = point(viewport.convertToViewportPoint(xMax, yMax));
      const left = Math.min(ax, bx) / viewport.width;
      const right = Math.max(ax, bx) / viewport.width;
      const top = Math.min(ay, by) / viewport.height;
      const bottom = Math.max(ay, by) / viewport.height;
      rects.push({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      });
    }
  }
  return rects;
}

/** The topmost annotation under a screen point, if any. */
export function annotationAtPoint(
  annotations: Annotation[],
  source: PageViewSource,
  clientX: number,
  clientY: number,
): Annotation | null {
  const page = renderedPages(source).find((entry) =>
    contains(entry.box, clientX, clientY),
  );
  if (!page) return null;
  const x = (clientX - page.box.left) / page.box.width;
  const y = (clientY - page.box.top) / page.box.height;
  for (const annotation of [...annotations].reverse())
    for (const rect of rectsForPage(annotation, page.index, page.view.viewport))
      if (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      )
        return annotation;
  return null;
}

/** The first page an annotation touches, numbered from 1. */
export function annotationPage(annotation: Annotation): number {
  return (
    Math.min(...annotation.segments.map((segment) => segment.pageIndex)) + 1
  );
}

export function annotationText(annotation: Annotation): string {
  return annotation.segments[0]?.text ?? "";
}
