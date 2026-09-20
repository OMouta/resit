import "pdfjs-dist/web/pdf_viewer.css";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  ColumnsIcon,
  ExternalLinkIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
  SpreadMode,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { InlineMessage } from "@resit/ui/components/inline-message";
import { Input } from "@resit/ui/components/input";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import { AnnotationActions } from "@resit/ui/patterns/document/annotation-actions";
import { AnnotationRow } from "@resit/ui/patterns/document/annotation-row";
import {
  PdfToolbar,
  type PdfZoom,
} from "@resit/ui/patterns/document/pdf-toolbar";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";

import type { PdfPanel, PdfZoomSetting } from "../../../shared/settings";
import type {
  Annotation,
  AnnotationColorValue,
  AnnotationType,
  ResourceInfo,
} from "../../../shared/workspace";
import { PromptDialog, type PromptRequest } from "../components/prompt-dialog";
import { api, errorMessage } from "../lib/api";
import { citationMarkdown } from "../lib/citations";
import { useNotices } from "../lib/notices";
import { useSettings } from "../lib/settings-context";
import { useWidth } from "../lib/use-width";
import {
  annotationAtPoint,
  annotationPage,
  annotationText,
  segmentsFromSelection,
} from "./annotation-geometry";
import { paintAnnotations } from "./annotation-layer";
import { PdfOutline, PdfThumbnails } from "./pdf-panel";
import {
  registerView,
  requestAsk,
  takePendingTarget,
  type DocumentTarget,
} from "./view-registry";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Repainted whenever PDF.js rebuilds a page, which drops the mark layer. */
const REPAINT_EVENTS = [
  "pagesloaded",
  "pagerendered",
  "textlayerrendered",
  "rotationchanging",
] as const;

interface ActionBar {
  at: { x: number; y: number };
  /** The highlight being edited, or null for a fresh text selection. */
  annotationId: string | null;
}

function scaleValue(zoom: PdfZoom): string {
  if (zoom === "fit-width") return "page-width";
  if (zoom === "fit-page") return "page-fit";
  return String(zoom);
}

/** The zoom a PDF opens at, from the setting's percentage or fit. */
function settingZoom(setting: PdfZoomSetting): PdfZoom {
  if (setting === "fit-width" || setting === "fit-page") return setting;
  return Number(setting) / 100;
}

export interface PdfViewProps {
  resource: ResourceInfo;
  active: boolean;
  /** Quotes a highlight in the note the student is writing in. */
  onCite?: (markdown: string) => void;
}

/** A PDF read with PDF.js, with the student's saved highlights drawn on it. */
export function PdfView({ resource, active, onCite }: PdfViewProps) {
  const notices = useNotices();
  const settings = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PDFViewer | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const linkServiceRef = useRef<PDFLinkService | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | { error: string }>(
    "loading",
  );
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState<PdfZoom>(() =>
    settingZoom(settings.pdf.zoom),
  );
  const [spread, setSpread] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [foundMatches, setFoundMatches] = useState({ current: 0, total: 0 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [color, setColor] = useState<AnnotationColorValue>(
    settings.pdf.highlightColor,
  );
  const [panel, setPanel] = useState<PdfPanel>(settings.pdf.panel);
  const [bar, setBar] = useState<ActionBar | null>(null);
  const [prompt, setPrompt] = useState<PromptRequest | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);
  const compact = width > 0 && width < 720;
  // Where a link asked this PDF to open, before it could be shown.
  const [opening] = useState(() => takePendingTarget(resource.id));
  const pendingPage = useRef(opening?.page);
  const pendingAnnotation = useRef(opening?.annotationId);
  const loaded = useRef(false);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const repaint = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer?.pdfDocument)
      paintAnnotations(viewer, annotationsRef.current, selectedRef.current);
  }, []);

  const goToPage = useCallback((target: number) => {
    const viewer = viewerRef.current;
    if (viewer?.pdfDocument && viewer.pagesCount > 0)
      viewer.currentPageNumber = Math.min(target, viewer.pagesCount);
    else pendingPage.current = target;
  }, []);

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
    linkServiceRef.current = linkService;

    eventBus.on("pagesinit", () => {
      viewer.currentScaleValue = scaleValue(zoomRef.current);
      const wanted = pendingPage.current;
      if (wanted) {
        viewer.currentPageNumber = Math.min(wanted, viewer.pagesCount);
        pendingPage.current = undefined;
      }
    });
    eventBus.on("pagechanging", (event: { pageNumber: number }) =>
      setPage(event.pageNumber),
    );
    // How many matches the search found, and which one is showing.
    const counted = (event: {
      matchesCount?: { current: number; total: number };
    }) => setFoundMatches(event.matchesCount ?? { current: 0, total: 0 });
    eventBus.on("updatefindmatchescount", counted);
    eventBus.on("updatefindcontrolstate", counted);
    for (const name of REPAINT_EVENTS) eventBus.on(name, repaint);

    void (async () => {
      try {
        const data = await api.readResourceBytes(resource.id);
        if (cancelled) return;
        loading = getDocument({ data, enableXfa: false });
        const opened = await loading.promise;
        if (cancelled) return;
        viewer.setDocument(opened);
        linkService.setDocument(opened);
        setPdfDocument(opened);
        setPageCount(opened.numPages);
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
      linkServiceRef.current = null;
      setPdfDocument(null);
      void loading?.destroy();
    };
    // A new revision means the file itself changed, so the document reloads.
  }, [resource.id, resource.revision, repaint]);

  const missingHighlight = useCallback(
    () =>
      notices.notify({
        tone: "info",
        title: "That highlight is no longer in this PDF",
        detail: "The link opened the page it was on.",
      }),
    [notices],
  );

  // The student's highlights for this PDF, and anything waiting to be shown.
  useEffect(() => {
    let cancelled = false;
    api.listAnnotations(resource.id).then(
      (list) => {
        if (cancelled) return;
        setAnnotations(list);
        setAnnotationError(null);
        loaded.current = true;
        const wanted = pendingAnnotation.current;
        if (!wanted) return;
        pendingAnnotation.current = undefined;
        const found = list.find((entry) => entry.id === wanted);
        if (found) {
          setSelectedId(found.id);
          goToPage(annotationPage(found));
        } else missingHighlight();
      },
      (reason: unknown) => {
        if (!cancelled) setAnnotationError(errorMessage(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resource.id, goToPage, missingHighlight]);

  // The assistant can highlight this PDF while it is open.
  useEffect(
    () =>
      api.onEvent((event) => {
        if (
          event.type !== "annotations-changed" ||
          event.documentId !== resource.id
        )
          return;
        api.listAnnotations(resource.id).then(setAnnotations, () => undefined);
      }),
    [resource.id],
  );

  useEffect(repaint, [repaint, annotations, selectedId]);

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

  const show = useCallback(
    (target: DocumentTarget) => {
      if (target.annotationId) {
        const found = annotationsRef.current.find(
          (entry) => entry.id === target.annotationId,
        );
        if (found) {
          setSelectedId(found.id);
          goToPage(annotationPage(found));
          return;
        }
        // The highlights may not have loaded yet; resolve it once they do.
        if (loaded.current) missingHighlight();
        else pendingAnnotation.current = target.annotationId;
      }
      if (target.page) goToPage(target.page);
    },
    [goToPage, missingHighlight],
  );

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
        show,
      }),
    [resource.id, show],
  );

  /** Pixels inside the scrolling container, so the bar stays with the page. */
  const positionIn = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return null;
    const box = container.getBoundingClientRect();
    return {
      x: clientX - box.left + container.scrollLeft,
      y: Math.max(
        clientY - box.top + container.scrollTop,
        container.scrollTop + 48,
      ),
    };
  };

  /** Shows the selection bar above the first selected line, if there is one. */
  const showSelectionBar = (): boolean => {
    const container = containerRef.current;
    const selection = window.getSelection();
    if (!container || !selection || selection.isCollapsed) return false;
    if (selection.rangeCount === 0) return false;
    if (!container.contains(selection.anchorNode)) return false;
    const rect = selection.getRangeAt(0).getClientRects()[0];
    if (!rect) return false;
    const at = positionIn(rect.left + rect.width / 2, rect.top);
    if (!at) return false;
    setBar({ at, annotationId: null });
    return true;
  };

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    selectionRef.current = "";
  };

  const dropAnnotation = (id: string) => {
    setAnnotations((list) => list.filter((entry) => entry.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  const cite = (annotation: Annotation) => {
    if (!onCite) return;
    onCite(
      citationMarkdown({
        resourceId: resource.id,
        title: resource.title,
        page: annotationPage(annotation),
        annotationId: annotation.id,
        quote: annotationText(annotation),
      }),
    );
  };

  const ask = (annotation: Annotation) => {
    requestAsk({
      resourceId: resource.id,
      annotation: {
        id: annotation.id,
        page: annotationPage(annotation),
        text: annotationText(annotation),
        ...(annotation.comment ? { comment: annotation.comment } : {}),
      },
    });
  };

  /** Saves the current text selection as a highlight or underline. */
  const mark = async (
    type: AnnotationType,
    chosen: AnnotationColorValue,
  ): Promise<Annotation | null> => {
    const viewer = viewerRef.current;
    const selection = window.getSelection();
    if (!viewer?.pdfDocument || !selection) return null;
    const segments = segmentsFromSelection(selection, viewer);
    if (segments.length === 0) {
      notices.notify({
        tone: "info",
        title: "Select some text in the PDF first",
      });
      return null;
    }
    try {
      const created = await api.createAnnotation({
        documentId: resource.id,
        type,
        color: chosen,
        segments,
      });
      setAnnotations((list) => [...list, created]);
      setSelectedId(created.id);
      setBar(null);
      clearSelection();
      return created;
    } catch (error) {
      notices.fail("The highlight was not saved", error);
      return null;
    }
  };

  const recolour = async (
    annotation: Annotation,
    next: AnnotationColorValue,
  ) => {
    try {
      const updated = await api.updateAnnotation({
        documentId: resource.id,
        id: annotation.id,
        color: next,
      });
      setAnnotations((list) =>
        list.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (error) {
      notices.fail("The colour was not changed", error);
    }
  };

  const comment = (annotation: Annotation) => {
    setPrompt({
      title: annotation.comment ? "Edit comment" : "Add a comment",
      description: `On the highlight on page ${annotationPage(annotation)}.`,
      label: "Comment",
      placeholder: "I did not understand this step",
      ...(annotation.comment ? { initialValue: annotation.comment } : {}),
      submitLabel: "Save",
      onSubmit: async (text) => {
        try {
          const updated = await api.updateAnnotation({
            documentId: resource.id,
            id: annotation.id,
            comment: text,
          });
          setAnnotations((list) =>
            list.map((entry) => (entry.id === updated.id ? updated : entry)),
          );
        } catch (error) {
          notices.fail("The comment was not saved", error);
        }
      },
    });
  };

  const remove = async (annotation: Annotation) => {
    try {
      await api.deleteAnnotation({
        documentId: resource.id,
        id: annotation.id,
      });
      dropAnnotation(annotation.id);
      setBar(null);
    } catch (error) {
      notices.fail("The highlight was not deleted", error);
    }
  };

  const changeZoom = (next: PdfZoom) => {
    setZoom(next);
    const viewer = viewerRef.current;
    if (viewer?.pdfDocument) viewer.currentScaleValue = scaleValue(next);
  };

  const find = (findPrevious = false, again = true, text = query) => {
    eventBusRef.current?.dispatch("find", {
      source: null,
      type: again ? "again" : "",
      query: text,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious,
      matchDiacritics: false,
    });
  };

  const barAnnotation = bar?.annotationId
    ? (annotations.find((entry) => entry.id === bar.annotationId) ?? null)
    : null;

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
        if (event.key === "Escape" && bar) {
          setBar(null);
          setSelectedId(null);
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
        sidebarOpen={panel !== "none"}
        onToggleSidebar={() =>
          setPanel((current) =>
            current === "none"
              ? settings.pdf.panel === "none"
                ? "thumbnails"
                : settings.pdf.panel
              : "none",
          )
        }
        disabled={status !== "ready"}
        compact={compact}
        end={
          <>
            <ToolbarButton
              label={spread ? "One page at a time" : "Two pages side by side"}
              active={spread}
              disabled={status !== "ready"}
              onClick={() => {
                const viewer = viewerRef.current;
                const next = !spread;
                setSpread(next);
                if (viewer?.pdfDocument)
                  viewer.spreadMode = next ? SpreadMode.ODD : SpreadMode.NONE;
              }}
            >
              <ColumnsIcon />
            </ToolbarButton>
            <ToolbarButton
              label="Open in default app"
              onClick={() => void api.openResourceExternally(resource.id)}
            >
              <ExternalLinkIcon />
            </ToolbarButton>
          </>
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
              // Search as it is typed, so the count follows along.
              find(false, false, event.target.value);
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
          <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
            {query.trim()
              ? foundMatches.total > 0
                ? `${foundMatches.current}/${foundMatches.total}`
                : "No matches"
              : ""}
          </span>
          <ToolbarButton
            label="Previous match"
            disabled={foundMatches.total === 0}
            onClick={() => find(true)}
          >
            <ChevronUpIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Next match"
            disabled={foundMatches.total === 0}
            onClick={() => find()}
          >
            <ChevronDownIcon />
          </ToolbarButton>
          <Button
            type="button"
            size="icon-sm"
            variant="subtle"
            aria-label="Close search"
            className="ml-auto"
            onClick={() => setSearchOpen(false)}
          >
            <XIcon />
          </Button>
        </form>
      ) : null}
      {annotationError ? (
        <InlineMessage tone="warning" className="mx-3 mt-3">
          <p>{annotationError}</p>
        </InlineMessage>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {panel !== "none" ? (
          <div className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
            <div className="flex h-10 shrink-0 items-center border-b px-2">
              <Tabs
                value={panel}
                onValueChange={(value) => setPanel(value as PdfPanel)}
                className="w-full"
              >
                <TabsList aria-label="Side panel" className="w-full">
                  <TabsTrigger value="thumbnails" className="flex-1 text-xs">
                    Pages
                  </TabsTrigger>
                  <TabsTrigger value="outline" className="flex-1 text-xs">
                    Contents
                  </TabsTrigger>
                  <TabsTrigger value="highlights" className="flex-1 text-xs">
                    Marks
                    {annotations.length > 0 ? ` ${annotations.length}` : ""}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {panel === "thumbnails" ? (
              <PdfThumbnails
                document={pdfDocument}
                pageCount={pageCount}
                page={page}
                onSelect={goToPage}
              />
            ) : null}
            {panel === "outline" ? (
              <PdfOutline
                document={pdfDocument}
                onGoTo={(destination) => {
                  void linkServiceRef.current?.goToDestination(destination);
                }}
              />
            ) : null}
            {panel === "highlights" ? (
              <ScrollArea className="min-h-0 flex-1">
                {annotations.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">
                    Select text in the PDF to highlight it. Highlights are saved
                    beside the file and never change the PDF itself.
                  </p>
                ) : (
                  <div
                    role="listbox"
                    aria-label="Highlights"
                    className="flex flex-col gap-1 p-2"
                  >
                    {[...annotations]
                      .sort(
                        (a, b) =>
                          annotationPage(a) - annotationPage(b) ||
                          a.createdAt.localeCompare(b.createdAt),
                      )
                      .map((annotation) => (
                        <AnnotationRow
                          key={annotation.id}
                          id={annotation.id}
                          kind={annotation.type}
                          color={annotation.color}
                          page={annotationPage(annotation)}
                          text={annotationText(annotation)}
                          {...(annotation.comment
                            ? { comment: annotation.comment }
                            : {})}
                          createdAt={annotation.createdAt}
                          selected={annotation.id === selectedId}
                          orphaned={
                            annotation.documentRevision !== resource.revision
                          }
                          onSelect={() => {
                            setSelectedId(annotation.id);
                            goToPage(annotationPage(annotation));
                          }}
                          onGoToPage={goToPage}
                          onEdit={() => comment(annotation)}
                          onDelete={() => void remove(annotation)}
                        />
                      ))}
                  </div>
                )}
              </ScrollArea>
            ) : null}
          </div>
        ) : null}
        <div className="relative min-h-0 min-w-0 flex-1 bg-canvas">
          <div
            ref={containerRef}
            className="pdf-container absolute inset-0 overflow-auto"
            data-dim={settings.pdf.dimInDark}
            tabIndex={0}
            aria-label={`${resource.title}, PDF`}
            onMouseDown={() => setBar(null)}
            onMouseUp={(event) => {
              const { clientX, clientY } = event;
              // Let the browser finish updating the selection first.
              window.setTimeout(() => {
                if (showSelectionBar()) return;
                const viewer = viewerRef.current;
                const hit = viewer?.pdfDocument
                  ? annotationAtPoint(
                      annotationsRef.current,
                      viewer,
                      clientX,
                      clientY,
                    )
                  : null;
                if (!hit) {
                  setSelectedId(null);
                  return;
                }
                setSelectedId(hit.id);
                const at = positionIn(clientX, clientY);
                if (at) setBar({ at, annotationId: hit.id });
              }, 0);
            }}
            onKeyUp={(event) => {
              if (event.shiftKey || event.key === "Shift") showSelectionBar();
            }}
          >
            <div className="pdfViewer" />
            {bar ? (
              barAnnotation ? (
                <AnnotationActions
                  at={bar.at}
                  color={barAnnotation.color}
                  existing
                  onColor={(next) => void recolour(barAnnotation, next)}
                  {...(onCite ? { onCite: () => cite(barAnnotation) } : {})}
                  onAsk={() => ask(barAnnotation)}
                  onComment={() => comment(barAnnotation)}
                  onDelete={() => void remove(barAnnotation)}
                />
              ) : (
                <AnnotationActions
                  at={bar.at}
                  color={color}
                  onColor={(next) => {
                    setColor(next);
                    void mark("highlight", next);
                  }}
                  onUnderline={() => void mark("underline", color)}
                  {...(onCite
                    ? {
                        onCite: () => {
                          void mark("highlight", color).then((created) => {
                            if (created) cite(created);
                          });
                        },
                      }
                    : {})}
                />
              )
            ) : null}
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
      <PromptDialog request={prompt} onClose={() => setPrompt(null)} />
    </div>
  );
}
