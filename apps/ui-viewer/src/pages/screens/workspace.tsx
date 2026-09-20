import { useState } from "react";

import { ScrollArea } from "@resit/ui/components/scroll-area";
import { CitationBlock } from "@resit/ui/patterns/document/citation-block";
import { DocumentHeader } from "@resit/ui/patterns/document/document-header";
import {
  EditorToolbar,
  type EditorMark,
  type TextStyle,
} from "@resit/ui/patterns/document/editor-toolbar";
import { MathText } from "@resit/ui/patterns/document/math";
import { NoteOutline } from "@resit/ui/patterns/document/note-outline";
import { StudyCallout } from "@resit/ui/patterns/document/study-callout";
import { SaveStatus } from "@resit/ui/patterns/files/save-status";
import {
  DocumentTabs,
  tabsNeedingSubject,
} from "@resit/ui/patterns/navigation/document-tabs";
import { PaneHeader } from "@resit/ui/patterns/navigation/pane-header";

import { toTabItem } from "../../fixtures/adapters";
import { citations, noteMarkdown, outline } from "../../fixtures/documents";
import { openTabs, resourceById } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";
import { ScreenFrame, screenExample } from "./shared";

function Screen({ ctx }: { ctx: ExampleContext }) {
  const [tabs, setTabs] = useState(
    openTabs.filter((tab) => tab.paneId === "right"),
  );
  const [activeId, setActiveId] = useState("tab_2");
  const [textStyle, setTextStyle] = useState<TextStyle>("paragraph");
  const [marks, setMarks] = useState<EditorMark[]>([]);
  const items = tabs.map(toTabItem);
  const collisions = tabsNeedingSubject(items);
  const active = tabs.find((tab) => tab.id === activeId);
  const note = resourceById(active?.resourceId ?? "res_ws3_note");
  const cite = citations[1]!;

  return (
    <ScreenFrame
      ctx={ctx}
      title={`${note.title} — Studies 2026/27`}
      activeResourceId={note.id}
      ai={{ open: ctx.state === "with-ai" }}
      toolbarEnd={
        <SaveStatus
          state="unsaved"
          detail="Draft kept on disk. Last save 21:05"
          onAction={() => ctx.log("save")}
        />
      }
      onOpenResource={(id) => {
        const existing = tabs.find((tab) => tab.resourceId === id);
        if (existing) setActiveId(existing.id);
        else {
          const tab = {
            id: `tab_${id}`,
            resourceId: id,
            paneId: "right" as const,
          };
          setTabs((previous) => [...previous, tab]);
          setActiveId(tab.id);
        }
      }}
    >
      <PaneHeader
        focused
        onSplitHorizontal={() => ctx.log("split")}
        onMaximise={() => ctx.log("maximise")}
      >
        <DocumentTabs
          tabs={items.map((tab) => ({
            ...tab,
            showSubject: collisions.has(tab.id),
          }))}
          activeId={activeId}
          onActivate={setActiveId}
          onClose={(id) => {
            setTabs((previous) => previous.filter((tab) => tab.id !== id));
            if (id === activeId)
              setActiveId(tabs.find((tab) => tab.id !== id)?.id ?? "");
          }}
          onReorder={(from, to) =>
            setTabs((previous) => {
              const next = [...previous];
              const [moved] = next.splice(from, 1);
              if (moved) next.splice(to, 0, moved);
              return next;
            })
          }
          onNewTab={() => ctx.log("newTab")}
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
        compact={ctx.viewport !== null && ctx.viewport < 1100}
      />
      <div className="flex min-h-0 flex-1">
        <ScrollArea className="min-w-0 flex-1">
          <div className="mx-auto max-w-[52rem]">
            <DocumentHeader
              title={note.title}
              subject={{ name: "Mathematics", color: "blue" }}
              path={note.path}
              modifiedAt={note.modifiedAt}
              onRename={(title) => ctx.log("rename", title)}
            />
            <div className="px-6 pb-16">
              {note.kind === "note" ? (
                <>
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
                        Absolute value inequalities: $|u| &lt; c \iff -c &lt; u
                        &lt; c$.
                      </MathText>
                    </StudyCallout>
                    <CitationBlock
                      source={{
                        resourceId: cite.resourceId,
                        title: cite.resourceTitle,
                        subjectName: cite.subjectName,
                      }}
                      quote={cite.quote}
                      onOpen={() => ctx.log("openCitation")}
                    />
                  </div>
                </>
              ) : (
                <p className="document text-muted-foreground">
                  {note.kind === "pdf" ? `${note.pages} pages.` : "Attachment."}{" "}
                  Open in the split view to read beside a note.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
        <aside className="hidden w-56 shrink-0 border-l @4xl:block">
          <p className="px-3 pt-3 pb-1 text-2xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            Outline
          </p>
          <NoteOutline
            headings={outline}
            activeId="h2a"
            onNavigate={(id) => ctx.log("outline", id)}
          />
        </aside>
      </div>
    </ScreenFrame>
  );
}

export const page: ExamplePage = {
  section: "screens",
  slug: "workspace",
  title: "Workspace",
  description:
    "Sidebar, document tabs, the note editor with its outline, and the AI panel. Narrow the width to see panels overlay instead of squeezing the note.",
  source: "packages/ui/src/patterns/screens/app-shell.tsx",
  keywords: ["main", "editor", "note", "sidebar", "shell"],
  examples: [
    {
      id: "workspace",
      title: "Note with sidebar",
      ...screenExample,
      states: ["default", "with-ai"],
      render: (ctx) => (
        <Screen key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
  ],
};
