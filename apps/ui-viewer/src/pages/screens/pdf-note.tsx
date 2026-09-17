import { useState } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@resit/ui/components/resizable";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { AnnotationRow } from "@resit/ui/patterns/document/annotation-row";
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
import { DocumentTabs } from "@resit/ui/patterns/navigation/document-tabs";
import { PaneHeader } from "@resit/ui/patterns/navigation/pane-header";

import { toTabItem } from "../../fixtures/adapters";
import {
  annotations,
  noteMarkdown,
  pdfDocument,
} from "../../fixtures/documents";
import { openTabs, resourceById } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { ScreenFrame, screenExample } from "./shared";

function Screen({ ctx }: { ctx: ExampleContext }) {
  const [page, setPage] = useState(7);
  const [zoom, setZoom] = useState<PdfZoom>("fit-width");
  const [tool, setTool] = useState<AnnotationTool>("select");
  const [color, setColor] = useState<AnnotationColor>("yellow");
  const [sidebar, setSidebar] = useState(false);
  const [focused, setFocused] = useState<"pdf" | "note">("pdf");
  const [textStyle, setTextStyle] = useState<TextStyle>("paragraph");
  const [marks, setMarks] = useState<EditorMark[]>([]);
  const pdf = resourceById("res_ws3_pdf");
  const note = resourceById("res_ws3_note");
  const region = annotations[1]!;
  const compact = ctx.viewport !== null && ctx.viewport < 1280;
  const leftTabs = openTabs
    .filter((tab) => tab.paneId === "left")
    .map(toTabItem);
  const rightTabs = openTabs
    .filter((tab) => tab.paneId === "right")
    .slice(0, 2)
    .map(toTabItem);

  return (
    <ScreenFrame
      ctx={ctx}
      title="Worksheet 3 · Resolution — ISEP 2026/27"
      activeResourceId={focused === "pdf" ? pdf.id : note.id}
      ai={{ open: ctx.state === "with-ai" }}
      sidebarOpen={ctx.state !== "with-ai"}
    >
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel
          minSize={320}
          className="flex min-h-0 flex-col"
          onFocusCapture={() => setFocused("pdf")}
          onPointerDownCapture={() => setFocused("pdf")}
        >
          <PaneHeader
            focused={focused === "pdf"}
            onSplitVertical={() => ctx.log("split")}
            onClose={() => ctx.log("closePane")}
          >
            <DocumentTabs
              tabs={leftTabs}
              activeId="tab_1"
              onActivate={(id) => ctx.log("activate", id)}
              onClose={(id) => ctx.log("close", id)}
            />
          </PaneHeader>
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
            compact={compact}
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
                      selected={annotation.id === region.id}
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
                  .map((number) => (
                    <PdfPageFrame
                      key={number}
                      pageNumber={number}
                      current={number === page}
                      {...(typeof zoom === "number"
                        ? { width: 520 * zoom }
                        : {})}
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
                        lines={pdfDocument.pages[number - 1]!.lines}
                        title={number === 7 ? pdf.title : undefined}
                      />
                    </PdfPageFrame>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          minSize={320}
          className="flex min-h-0 flex-col"
          onFocusCapture={() => setFocused("note")}
          onPointerDownCapture={() => setFocused("note")}
        >
          <PaneHeader
            focused={focused === "note"}
            onSplitVertical={() => ctx.log("split")}
            onClose={() => ctx.log("closePane")}
          >
            <DocumentTabs
              tabs={rightTabs.map((tab) => ({ ...tab, showSubject: true }))}
              activeId="tab_2"
              onActivate={(id) => ctx.log("activate", id)}
              onClose={(id) => ctx.log("close", id)}
            />
          </PaneHeader>
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
            compact
          />
          <ScrollArea className="min-h-0 flex-1">
            <DocumentHeader
              title={note.title}
              subject={{ name: "Mathematics", color: "blue" }}
              path={note.path}
              modifiedAt={note.modifiedAt}
            />
            <div className="px-6 pb-16">
              <MathText className="document">
                {noteMarkdown
                  .replace(/^# .*\n\n/m, "")
                  .replace(/^## /gm, "")
                  .replace(/^> .*\n\n/gm, "")}
              </MathText>
              <div className="document">
                <StudyCallout
                  kind="ai-explanation"
                  pending
                  source={{
                    label: "Conversation · page 7",
                    onOpen: () => ctx.log("openConversation"),
                  }}
                  onAccept={() => ctx.log("acceptExplanation")}
                  onDismiss={() => ctx.log("dismissExplanation")}
                >
                  <MathText>
                    Factor the constant out: $|3x - 6| = |3(x-2)| = 3|x - 2|$,
                    because $|ab| = |a|\,|b|$.
                  </MathText>
                </StudyCallout>
              </div>
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ScreenFrame>
  );
}

export const page: ExamplePage = {
  section: "screens",
  slug: "pdf-note",
  title: "PDF and note split",
  description:
    "Worksheet on the left with a selected region, resolution note on the right. The focused pane supplies the AI context; the other pane does not become an attachment.",
  source: "packages/ui/src/patterns/document/pdf-page.tsx",
  keywords: ["split", "pdf", "note", "reading"],
  examples: [
    {
      id: "split",
      title: "Side by side",
      ...screenExample,
      states: ["default", "with-ai"],
      render: (ctx) => (
        <Screen key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
  ],
};
