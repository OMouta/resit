import { Button } from "@resit/ui/components/button";
import { MoreHorizontalIcon, StarIcon } from "lucide-react";
import { useState } from "react";

import { AnnotationRow } from "@resit/ui/patterns/document/annotation-row";
import {
  CitationBlock,
  CitationChip,
} from "@resit/ui/patterns/document/citation-block";
import { DocumentHeader } from "@resit/ui/patterns/document/document-header";
import {
  EditorToolbar,
  type EditorBlock,
  type EditorMark,
  type TextStyle,
} from "@resit/ui/patterns/document/editor-toolbar";
import {
  MathBlock,
  MathInline,
  MathText,
} from "@resit/ui/patterns/document/math";
import { NoteOutline } from "@resit/ui/patterns/document/note-outline";
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
import { RelatedResourceRow } from "@resit/ui/patterns/document/related-resource-row";
import {
  StudyCallout,
  type CalloutKind,
} from "@resit/ui/patterns/document/study-callout";

import {
  annotations,
  citations,
  mathSamples,
  noteMarkdown,
  outline,
  pdfDocument,
  relatedResources,
} from "../../fixtures/documents";
import { resourceById } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

function EditorToolbarExample({ ctx }: { ctx: ExampleContext }) {
  const [textStyle, setTextStyle] = useState<TextStyle>("paragraph");
  const [marks, setMarks] = useState<EditorMark[]>(["bold"]);
  const [blocks, setBlocks] = useState<EditorBlock[]>([]);
  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item)
      ? list.filter((entry) => entry !== item)
      : [...list, item];
  return (
    <EditorToolbar
      textStyle={textStyle}
      onTextStyleChange={(style) => {
        setTextStyle(style);
        ctx.log("onTextStyleChange", style);
      }}
      marks={marks}
      onToggleMark={(mark) => {
        setMarks((previous) => toggle(previous, mark));
        ctx.log("onToggleMark", mark);
      }}
      activeBlocks={blocks}
      onBlock={(block) => {
        setBlocks((previous) => toggle(previous, block));
        ctx.log("onBlock", block);
      }}
      canUndo
      canRedo={false}
      onUndo={() => ctx.log("onUndo")}
      onRedo={() => ctx.log("onRedo")}
      disabled={ctx.state === "read-only"}
      compact={ctx.state === "compact"}
      end={<span className="px-2 text-xs text-muted-foreground">Saved</span>}
    />
  );
}

function PdfToolbarExample({ ctx }: { ctx: ExampleContext }) {
  const [page, setPage] = useState(7);
  const [zoom, setZoom] = useState<PdfZoom>(1.25);
  const [tool, setTool] = useState<AnnotationTool>("highlight");
  const [color, setColor] = useState<AnnotationColor>("yellow");
  const [search, setSearch] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  return (
    <PdfToolbar
      page={page}
      pageCount={pdfDocument.pageCount}
      onPageChange={(next) => {
        setPage(next);
        ctx.log("onPageChange", next);
      }}
      zoom={zoom}
      onZoomChange={(next) => {
        setZoom(next);
        ctx.log("onZoomChange", next);
      }}
      onRotate={() => ctx.log("onRotate")}
      searchOpen={search}
      onToggleSearch={() => setSearch((value) => !value)}
      sidebarOpen={sidebar}
      onToggleSidebar={() => setSidebar((value) => !value)}
      tool={tool}
      onToolChange={(next) => {
        setTool(next);
        ctx.log("onToolChange", next);
      }}
      color={color}
      onColorChange={(next) => {
        setColor(next);
        ctx.log("onColorChange", next);
      }}
      compact={ctx.state === "compact"}
      disabled={ctx.state === "disabled"}
    />
  );
}

const page7 = pdfDocument.pages[6]!;
const region = annotations.find((entry) => entry.kind === "region")!;

function PageExample({ ctx }: { ctx: ExampleContext }) {
  const [selected, setSelected] = useState<string | undefined>("ann_2");
  const status =
    ctx.state === "loading"
      ? "loading"
      : ctx.state === "error"
        ? "error"
        : "ready";
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <PdfPageFrame
        pageNumber={7}
        status={status}
        current
        onRetry={() => ctx.log("onRetry")}
        overlays={
          <>
            <HighlightOverlay
              rect={{ x: 0.1, y: 0.09, width: 0.78, height: 0.035 }}
              color="yellow"
              label="Highlight: Prove the following limits using the definition."
              selected={selected === "ann_1"}
              onSelect={() => {
                setSelected("ann_1");
                ctx.log("onSelect", "ann_1");
              }}
            />
            <HighlightOverlay
              rect={{ x: 0.1, y: 0.365, width: 0.5, height: 0.03 }}
              color="green"
              kind="underline"
              label="Underline: Exercise 3"
              selected={selected === "ann_3"}
              onSelect={() => setSelected("ann_3")}
            />
            <SelectionRegion
              rect={region.rect!}
              description={region.description ?? ""}
              selected={selected === "ann_2"}
              onSelect={() => {
                setSelected("ann_2");
                ctx.log("onSelect", "ann_2");
              }}
            />
          </>
        }
      >
        <PdfPagePlaceholder
          lines={page7.lines}
          title="Worksheet 3 — Limits and continuity"
        />
      </PdfPageFrame>
    </div>
  );
}

const calloutKinds: CalloutKind[] = [
  "definition",
  "theorem",
  "example",
  "warning",
  "prerequisite",
  "ai-explanation",
];

export const page: ExamplePage = {
  section: "patterns",
  group: "Document",
  slug: "document",
  title: "Notes and PDFs",
  description:
    "Editor chrome, study blocks, and PDF controls. The editing and rendering engines stay outside; these components take data and callbacks.",
  source: "packages/ui/src/patterns/document/pdf-toolbar.tsx",
  keywords: [
    "editor",
    "toolbar",
    "pdf",
    "annotation",
    "citation",
    "math",
    "outline",
    "callout",
  ],
  examples: [
    {
      id: "header",
      title: "Document header",
      width: "full",
      states: ["editable", "read-only", "long-title"],
      render: (ctx) => {
        const resource = resourceById(
          ctx.state === "long-title" ? "res_deriv_pdf" : "res_ws3_note",
        );
        return (
          <div className="-m-4">
            <DocumentHeader
              title={resource.title}
              subject={{ name: "Mathematics", color: "blue" }}
              path={resource.path}
              modifiedAt={resource.modifiedAt}
              readOnly={ctx.state === "read-only"}
              onRename={(title) => ctx.log("onRename", title)}
              actions={
                <>
                  <Button
                    variant="subtle"
                    size="icon"
                    aria-label="Favourite"
                    onClick={() => ctx.log("favourite")}
                  >
                    <StarIcon />
                  </Button>
                  <Button
                    variant="subtle"
                    size="icon"
                    aria-label="More"
                    onClick={() => ctx.log("more")}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </>
              }
            />
          </div>
        );
      },
    },
    {
      id: "editor-toolbar",
      title: "Editor toolbar",
      width: "full",
      states: ["default", "compact", "read-only"],
      render: (ctx) => (
        <div className="-m-4">
          <EditorToolbarExample ctx={ctx} />
        </div>
      ),
    },
    {
      id: "outline",
      title: "Note outline",
      width: 260,
      states: ["default", "empty"],
      render: (ctx) => (
        <NoteOutline
          headings={ctx.state === "empty" ? [] : outline}
          activeId="h2a"
          onNavigate={(id) => ctx.log("onNavigate", id)}
        />
      ),
    },
    {
      id: "math",
      title: "Mathematics",
      description:
        "Inline, display, long overflow, and the error state for broken source.",
      width: "full",
      render: () => (
        <div className="document">
          <p>
            The limit <MathInline>{mathSamples.limit}</MathInline> exists even
            though the function is undefined at <MathInline>x = 2</MathInline>.
          </p>
          <MathBlock numbered="1">{mathSamples.epsilonDelta}</MathBlock>
          <MathBlock>{mathSamples.long}</MathBlock>
          <MathBlock>{mathSamples.matrix}</MathBlock>
          <MathBlock>{mathSamples.broken}</MathBlock>
          <p>
            Inline error: <MathInline>{mathSamples.unknownCommand}</MathInline>{" "}
            keeps the sentence readable.
          </p>
        </div>
      ),
    },
    {
      id: "note",
      title: "Note body",
      width: "full",
      render: () => (
        <MathText className="document">
          {noteMarkdown
            .replace(/^# (.*)$/m, "$1")
            .replace(/^## /gm, "")
            .replace(/^> /gm, "")}
        </MathText>
      ),
    },
    {
      id: "callouts",
      title: "Study callouts",
      width: "full",
      render: (ctx) => (
        <div className="document flex max-w-none flex-col gap-3">
          {calloutKinds.map((kind) => (
            <StudyCallout
              key={kind}
              kind={kind}
              source={{
                label: "Worksheet 3, page 7",
                onOpen: () => ctx.log("onOpenSource", kind),
              }}
              pending={kind === "ai-explanation"}
              onAccept={() => ctx.log("onAccept")}
              onDismiss={() => ctx.log("onDismiss")}
            >
              <MathText>
                {kind === "theorem"
                  ? "If $\\lim_{x\\to a} f(x) = L$ and $\\lim_{x\\to a} g(x) = M$, then $\\lim_{x\\to a} (f+g)(x) = L + M$."
                  : kind === "prerequisite"
                    ? "Absolute value inequalities: $|u| < c \\iff -c < u < c$. Used in every ε–δ proof below."
                    : "Factor the constant out: $|3x - 6| = |3(x-2)| = 3|x - 2|$, because $|ab| = |a|\\,|b|$."}
              </MathText>
            </StudyCallout>
          ))}
        </div>
      ),
    },
    {
      id: "pdf-toolbar",
      title: "PDF toolbar",
      width: "full",
      states: ["default", "compact", "disabled"],
      render: (ctx) => (
        <div className="-m-4">
          <PdfToolbarExample ctx={ctx} />
        </div>
      ),
    },
    {
      id: "pdf-page",
      title: "PDF page with overlays",
      description:
        "Highlight, underline, and a selected region with handles. The region has a text description for screen readers.",
      width: "full",
      surface: "muted",
      states: ["ready", "loading", "error"],
      render: (ctx) => <PageExample ctx={ctx} />,
    },
    {
      id: "annotations",
      title: "Annotation rows",
      width: 380,
      render: (ctx) => (
        <div
          role="listbox"
          aria-label="Annotations"
          className="flex w-full flex-col gap-1"
        >
          {annotations.map((annotation, index) => (
            <AnnotationRow
              key={annotation.id}
              {...annotation}
              selected={index === 1}
              orphaned={index === 3}
              onSelect={(id) => ctx.log("onSelect", id)}
              onGoToPage={(pageNumber) => ctx.log("onGoToPage", pageNumber)}
              onEdit={(id) => ctx.log("onEdit", id)}
              onDelete={(id) => ctx.log("onDelete", id)}
            />
          ))}
        </div>
      ),
    },
    {
      id: "citations",
      title: "Citations",
      description:
        "Short, long (collapsed), missing source, and the chip used in chat.",
      width: "full",
      render: (ctx) => (
        <div className="document max-w-none">
          {citations.map((citation) => (
            <CitationBlock
              key={citation.id}
              source={{
                resourceId: citation.resourceId,
                title: citation.resourceTitle,
                subjectName: citation.subjectName,
                ...(citation.page !== undefined ? { page: citation.page } : {}),
              }}
              quote={citation.quote}
              missing={citation.missing ?? false}
              onOpen={(source) => ctx.log("onOpen", source.resourceId)}
              onLocate={(source) => ctx.log("onLocate", source.resourceId)}
              onRemove={(source) => ctx.log("onRemove", source.resourceId)}
            />
          ))}
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Inline chips:
            {citations.map((citation) => (
              <CitationChip
                key={citation.id}
                source={{
                  resourceId: citation.resourceId,
                  title: citation.resourceTitle,
                  ...(citation.page !== undefined
                    ? { page: citation.page }
                    : {}),
                }}
                missing={citation.missing ?? false}
                onOpen={(source) => ctx.log("onOpenChip", source.resourceId)}
              />
            ))}
          </p>
        </div>
      ),
    },
    {
      id: "related",
      title: "Related resources",
      width: 360,
      render: (ctx) => (
        <div className="flex w-full flex-col">
          {relatedResources.map((related) => (
            <RelatedResourceRow
              key={related.resourceId}
              resourceId={related.resourceId}
              kind={resourceById(related.resourceId).kind}
              title={related.title}
              subjectName={related.subjectName}
              reason={related.reason}
              missing={related.missing ?? false}
              onOpen={(id) => ctx.log("onOpen", id)}
            />
          ))}
        </div>
      ),
    },
  ],
};
