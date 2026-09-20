import { useState } from "react";

import { ScrollArea } from "@resit/ui/components/scroll-area";
import { DocumentHeader } from "@resit/ui/patterns/document/document-header";
import { MathText } from "@resit/ui/patterns/document/math";
import {
  HighlightOverlay,
  PdfPageFrame,
  PdfPagePlaceholder,
  SelectionRegion,
} from "@resit/ui/patterns/document/pdf-page";
import {
  PdfToolbar,
  type AnnotationTool,
  type PdfZoom,
} from "@resit/ui/patterns/document/pdf-toolbar";
import { DocumentTabs } from "@resit/ui/patterns/navigation/document-tabs";
import { PaneHeader } from "@resit/ui/patterns/navigation/pane-header";

import { toTabItem } from "../../fixtures/adapters";
import { failedTurn, turns } from "../../fixtures/chat";
import { annotations, pdfDocument } from "../../fixtures/documents";
import { openTabs, resourceById } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { ScreenFrame, screenExample } from "./shared";

function Screen({ ctx }: { ctx: ExampleContext }) {
  const [page, setPage] = useState(7);
  const [zoom, setZoom] = useState<PdfZoom>("fit-width");
  const [tool, setTool] = useState<AnnotationTool>("region");
  const pdf = resourceById("res_ws3_pdf");
  const region = annotations[1]!;
  const ai =
    ctx.state === "failed"
      ? {
          open: true,
          turns: [...turns.slice(0, 3), failedTurn],
          status: {
            kind: "failed" as const,
            message: "Claude Code exited with code 1 before finishing.",
          },
        }
      : ctx.state === "no-provider"
        ? {
            open: true,
            turns: turns.slice(0, 2),
            status: {
              kind: "missing-provider" as const,
              providerName: "Claude Code",
            },
          }
        : { open: true };

  return (
    <ScreenFrame
      ctx={ctx}
      title="Worksheet 3 — Studies 2026/27"
      activeResourceId={pdf.id}
      ai={ai}
      sidebarOpen={false}
    >
      <PaneHeader focused>
        <DocumentTabs
          tabs={openTabs.filter((tab) => tab.paneId === "left").map(toTabItem)}
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
        tool={tool}
        onToolChange={setTool}
        color="blue"
        onColorChange={() => {}}
        onToggleSearch={() => ctx.log("search")}
      />
      <ScrollArea className="min-h-0 flex-1 bg-muted/60">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
          <DocumentHeader
            title={pdf.title}
            subject={{ name: "Mathematics", color: "blue" }}
            path={pdf.path}
            modifiedAt={pdf.modifiedAt}
            className="px-0 pt-0"
          />
          <div className="document -mt-4 text-sm text-muted-foreground">
            <MathText paragraphClassName="my-0">
              Select a region and ask about it. The conversation sees the
              subject, this PDF, page 7, and the region: nothing else.
            </MathText>
          </div>
          <PdfPageFrame
            pageNumber={7}
            current
            overlays={
              <>
                <HighlightOverlay
                  rect={{ x: 0.1, y: 0.09, width: 0.78, height: 0.035 }}
                  color="yellow"
                  label="Highlight on the exercise heading"
                />
                <SelectionRegion
                  rect={region.rect!}
                  description={region.description ?? ""}
                />
              </>
            }
          >
            <PdfPagePlaceholder
              lines={pdfDocument.pages[6]!.lines}
              title={pdf.title}
            />
          </PdfPageFrame>
        </div>
      </ScrollArea>
    </ScreenFrame>
  );
}

export const page: ExamplePage = {
  section: "screens",
  slug: "ai-study",
  title: "AI-assisted study",
  description:
    "A worksheet with a selected region and the conversation about it: scope chips, tool activity, citations, and an edit awaiting review. Failure and missing-provider states keep the layout.",
  source: "packages/ui/src/patterns/ai/ai-panel.tsx",
  keywords: ["ai", "conversation", "region", "context"],
  examples: [
    {
      id: "study",
      title: "Ask about a region",
      ...screenExample,
      states: ["review", "failed", "no-provider"],
      render: (ctx) => (
        <Screen key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
  ],
};
