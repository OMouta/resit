import { useState } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@resit/ui/components/resizable";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { AnnotationRow } from "@resit/ui/patterns/document/annotation-row";
import { CitationBlock } from "@resit/ui/patterns/document/citation-block";
import { DocumentHeader } from "@resit/ui/patterns/document/document-header";
import {
  EditorToolbar,
  type EditorMark,
  type TextStyle,
} from "@resit/ui/patterns/document/editor-toolbar";
import { MathText } from "@resit/ui/patterns/document/math";
import {
  HighlightOverlay,
  PdfPageFrame,
  PdfPagePlaceholder,
  SelectionRegion,
} from "@resit/ui/patterns/document/pdf-page";
import {
  PdfToolbar,
  type AnnotationColor,
  type AnnotationTool,
  type PdfZoom,
} from "@resit/ui/patterns/document/pdf-toolbar";
import { StudyCallout } from "@resit/ui/patterns/document/study-callout";

import {
  annotations,
  citations,
  noteMarkdown,
  pdfDocument,
} from "../../fixtures/documents";
import { resourceById } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

function Split({ ctx }: { ctx: ExampleContext }) {
  const [page, setPage] = useState(7);
  const [zoom, setZoom] = useState<PdfZoom>("fit-width");
  const [tool, setTool] = useState<AnnotationTool>("select");
  const [color, setColor] = useState<AnnotationColor>("yellow");
  const [sidebar, setSidebar] = useState(false);
  const [textStyle, setTextStyle] = useState<TextStyle>("paragraph");
  const [marks, setMarks] = useState<EditorMark[]>([]);
  const note = resourceById("res_ws3_note");
  const pdf = resourceById("res_ws3_pdf");
  const region = annotations[1]!;
  const cite = citations[0]!;
  const zoomWidth = typeof zoom === "number" ? 520 * zoom : undefined;

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full @container">
      <ResizablePanel
        minSize={280}
        className="flex min-h-0 flex-col bg-background"
      >
        <PdfToolbar
          page={page}
          pageCount={pdfDocument.pageCount}
          onPageChange={setPage}
          zoom={zoom}
          onZoomChange={setZoom}
          onRotate={() => ctx.log("rotate")}
          sidebarOpen={sidebar}
          onToggleSidebar={() => setSidebar((value) => !value)}
          onToggleSearch={() => ctx.log("search")}
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          compact={ctx.viewport !== null && ctx.viewport < 1100}
        />
        <div className="flex min-h-0 flex-1">
          {sidebar ? (
            <ScrollArea className="w-64 shrink-0 border-r">
              <div
                role="listbox"
                aria-label="Annotations"
                className="flex flex-col gap-1 p-2"
              >
                {annotations.map((annotation) => (
                  <AnnotationRow
                    key={annotation.id}
                    {...annotation}
                    selected={
                      annotation.page === page && annotation.id === region.id
                    }
                    onGoToPage={setPage}
                    onSelect={(id) => ctx.log("selectAnnotation", id)}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : null}
          <ScrollArea className="min-w-0 flex-1 bg-muted/60">
            <div className="flex flex-col gap-6 p-6">
              {[page, page + 1]
                .filter((number) => number <= pdfDocument.pageCount)
                .map((number) => {
                  const data = pdfDocument.pages[number - 1]!;
                  return (
                    <PdfPageFrame
                      key={number}
                      pageNumber={number}
                      current={number === page}
                      {...(zoomWidth ? { width: zoomWidth } : {})}
                      overlays={
                        number === 7 ? (
                          <>
                            <HighlightOverlay
                              rect={{
                                x: 0.1,
                                y: 0.09,
                                width: 0.78,
                                height: 0.035,
                              }}
                              color="yellow"
                              label="Highlight on the exercise heading"
                            />
                            <SelectionRegion
                              rect={region.rect!}
                              description={region.description ?? ""}
                            />
                          </>
                        ) : null
                      }
                    >
                      <PdfPagePlaceholder
                        lines={data.lines}
                        title={number === 7 ? pdf.title : undefined}
                      />
                    </PdfPageFrame>
                  );
                })}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        minSize={320}
        className="flex min-h-0 flex-col bg-background"
      >
        <EditorToolbar
          textStyle={textStyle}
          onTextStyleChange={setTextStyle}
          marks={marks}
          onToggleMark={(mark) =>
            setMarks((previous) =>
              previous.includes(mark)
                ? previous.filter((m) => m !== mark)
                : [...previous, mark],
            )
          }
          onBlock={(block) => ctx.log("block", block)}
          canUndo
          canRedo={false}
          onUndo={() => ctx.log("undo")}
          onRedo={() => ctx.log("redo")}
          compact={ctx.viewport !== null && ctx.viewport < 1100}
          end={
            <span className="px-2 text-xs text-muted-foreground">
              Unsaved changes
            </span>
          }
        />
        <ScrollArea className="min-h-0 flex-1">
          <DocumentHeader
            title={note.title}
            subject={{ name: "Mathematics", color: "blue" }}
            path={note.path}
            modifiedAt={note.modifiedAt}
            onRename={(title) => ctx.log("rename", title)}
          />
          <div className="px-6 pb-10">
            <MathText className="document">
              {noteMarkdown
                .replace(/^# .*\n\n/m, "")
                .replace(/^## /gm, "")
                .replace(/^> .*\n\n/gm, "")}
            </MathText>
            <div className="document">
              <StudyCallout
                kind="prerequisite"
                source={{
                  label: "Sequences — ∑ and ∏ notation",
                  onOpen: () => ctx.log("openSource"),
                }}
              >
                <MathText>
                  Absolute value inequalities: $|u| &lt; c \iff -c &lt; u &lt;
                  c$.
                </MathText>
              </StudyCallout>
              <CitationBlock
                source={{
                  resourceId: cite.resourceId,
                  title: cite.resourceTitle,
                  subjectName: cite.subjectName,
                  page: cite.page ?? 7,
                }}
                quote={cite.quote}
                onOpen={() => setPage(7)}
              />
            </div>
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export const page: ExamplePage = {
  section: "patterns",
  group: "Document",
  slug: "document-split",
  title: "PDF and note side by side",
  description:
    "Worksheet page 7 on the left with a selected region; the resolution note on the right. Use the Width control at 1024 or 800 to see the toolbars collapse.",
  source: "packages/ui/src/patterns/document/pdf-page.tsx",
  keywords: ["split", "pdf", "note", "layout"],
  examples: [
    {
      id: "split",
      title: "Side by side",
      width: "full",
      height: 680,
      render: (ctx) => <Split key={ctx.resetKey} ctx={ctx} />,
    },
  ],
};
