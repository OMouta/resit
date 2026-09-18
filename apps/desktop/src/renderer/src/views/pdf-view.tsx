import "pdfjs-dist/web/pdf_viewer.css";

import { ExternalLinkIcon, SearchIcon, XIcon } from "lucide-react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useRef, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { Input } from "@resit/ui/components/input";
import {
  PdfToolbar,
  type PdfZoom,
} from "@resit/ui/patterns/document/pdf-toolbar";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";

import type { ResourceInfo } from "../../../shared/workspace";
import { api, errorMessage } from "../lib/api";
import { useWidth } from "../lib/use-width";
import { registerView, takePendingPage } from "./view-registry";

GlobalWorkerOptions.workerSrc = workerUrl;

function scaleValue(zoom: PdfZoom): string {
  if (zoom === "fit-width") return "page-width";
  if (zoom === "fit-page") return "page-fit";
  return String(zoom);
}

/** A PDF read with PDF.js. Pages render lazily as they scroll into view. */
export function PdfView({
  resource,
  active,
}: {
  resource: ResourceInfo;
  active: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PDFViewer | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | { error: string }>(
    "loading",
  );
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState<PdfZoom>("fit-width");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);
  const compact = width > 0 && width < 640;
  const pendingPage = useRef(takePendingPage(resource.id));
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let loading: PDFDocumentLoadingTask | null = null;
    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus });
    const findController = new PDFFindController({ eventBus, linkService });
    const viewer = new PDFViewer({
      container,
      eventBus,
      linkService,
      findController,
      removePageBorders: true,
    });
    linkService.setViewer(viewer);
    viewerRef.current = viewer;
    eventBusRef.current = eventBus;

    eventBus.on("pagesinit", () => {
      viewer.currentScaleValue = scaleValue(zoomRef.current);
      if (pendingPage.current) {
        viewer.currentPageNumber = pendingPage.current;
        pendingPage.current = undefined;
      }
    });
    eventBus.on("pagechanging", (event: { pageNumber: number }) =>
      setPage(event.pageNumber),
    );

    void (async () => {
      try {
        const data = await api.readResourceBytes(resource.id);
        if (cancelled) return;
        loading = getDocument({ data, enableXfa: false });
        const document = await loading.promise;
        if (cancelled) return;
        viewer.setDocument(document);
        linkService.setDocument(document);
        setPageCount(document.numPages);
        setStatus("ready");
      } catch (reason) {
        if (!cancelled) setStatus({ error: errorMessage(reason) });
      }
    })();

    const resize = new ResizeObserver(() => {
      if (!viewer.pdfDocument || container.offsetParent === null) return;
      if (typeof zoomRef.current !== "number")
        viewer.currentScaleValue = scaleValue(zoomRef.current);
      else viewer.update();
    });
    resize.observe(container);

    return () => {
      cancelled = true;
      resize.disconnect();
      viewer.cleanup();
      viewerRef.current = null;
      void loading?.destroy();
    };
  }, [resource.id]);

  useEffect(() => {
    if (active && viewerRef.current?.pdfDocument) viewerRef.current.update();
  }, [active]);

  // The DOM selection moves when the student clicks into the chat box, so
  // remember the last text selected in this PDF.
  const selectionRef = useRef("");
  useEffect(() => {
    const onSelectionChange = () => {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.rangeCount === 0) return;
      if (!container.contains(selection.anchorNode)) return;
      selectionRef.current = selection.isCollapsed
        ? ""
        : selection.toString().trim();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  useEffect(
    () =>
      registerView(resource.id, {
        context: () => {
          const text = selectionRef.current;
          const viewer = viewerRef.current;
          return {
            ...(text ? { selection: text } : {}),
            ...(viewer?.pdfDocument
              ? { page: viewer.currentPageNumber, pageCount: viewer.pagesCount }
              : {}),
          };
        },
        goToPage: (page) => {
          const viewer = viewerRef.current;
          if (viewer?.pdfDocument && viewer.pagesCount > 0)
            viewer.currentPageNumber = Math.min(page, viewer.pagesCount);
          else pendingPage.current = page;
        },
      }),
    [resource.id],
  );

  const changeZoom = (next: PdfZoom) => {
    setZoom(next);
    const viewer = viewerRef.current;
    if (viewer?.pdfDocument) viewer.currentScaleValue = scaleValue(next);
  };

  const find = (findPrevious = false, again = true) => {
    eventBusRef.current?.dispatch("find", {
      source: null,
      type: again ? "again" : "",
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious,
      matchDiacritics: false,
    });
  };

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col overflow-hidden"
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "f"
        ) {
          event.preventDefault();
          setSearchOpen(true);
        }
      }}
    >
      <PdfToolbar
        page={page}
        pageCount={pageCount}
        onPageChange={(next) => {
          const viewer = viewerRef.current;
          if (viewer?.pdfDocument) viewer.currentPageNumber = next;
        }}
        zoom={zoom}
        onZoomChange={changeZoom}
        onRotate={() => {
          const viewer = viewerRef.current;
          if (viewer?.pdfDocument)
            viewer.pagesRotation = (viewer.pagesRotation + 90) % 360;
        }}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((open) => !open)}
        disabled={status !== "ready"}
        compact={compact}
        end={
          <ToolbarButton
            label="Open in default app"
            onClick={() => void api.openResourceExternally(resource.id)}
          >
            <ExternalLinkIcon />
          </ToolbarButton>
        }
      />
      {searchOpen ? (
        <form
          className="flex items-center gap-2 border-b bg-background px-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            find();
          }}
        >
          <SearchIcon className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            aria-label="Search in document"
            value={query}
            placeholder="Search in this PDF"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
              if (event.key === "Enter" && event.shiftKey) {
                event.preventDefault();
                find(true);
              }
            }}
            className="h-8 max-w-80"
          />
          <Button type="submit" size="sm" variant="secondary">
            Find next
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="subtle"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          >
            <XIcon />
          </Button>
        </form>
      ) : null}
      <div className="relative min-h-0 flex-1 bg-canvas">
        <div
          ref={containerRef}
          className="pdf-container absolute inset-0 overflow-auto"
          tabIndex={0}
          aria-label={`${resource.title}, PDF`}
        >
          <div className="pdfViewer" />
        </div>
        {typeof status === "object" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <EmptyState
              title="This PDF could not be opened"
              description={`${status.error} The original file is unchanged.`}
              actions={
                <Button
                  variant="secondary"
                  onClick={() => void api.openResourceExternally(resource.id)}
                >
                  Open in default app
                </Button>
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
