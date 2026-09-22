import { Button } from "@resit/ui/components/button";
import { MoreHorizontalIcon, Rows2Icon } from "lucide-react";
import { useState } from "react";

import {
  PaneEmpty,
  PaneHeader,
} from "@resit/ui/patterns/navigation/pane-header";
import { ProjectRow } from "@resit/ui/patterns/navigation/project-row";
import {
  SidebarNavItem,
  SidebarSection,
} from "@resit/ui/patterns/navigation/sidebar-sections";
import { SplitLayout } from "@resit/ui/patterns/navigation/split-handle";
import { SubjectTree } from "@resit/ui/patterns/navigation/subject-tree";
import {
  DocumentTabs,
  tabsNeedingSubject,
  type DocumentTabItem,
} from "@resit/ui/patterns/navigation/document-tabs";
import { WorkspaceSwitcher } from "@resit/ui/patterns/navigation/workspace-switcher";
import { BookOpenIcon, LibraryIcon, Trash2Icon } from "lucide-react";

import {
  toSidebarProjects,
  toTabItem,
  toTreeSubjects,
} from "../../fixtures/adapters";
import { openTabs, workspace } from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

function TreeExample({
  ctx,
  archived,
  badge,
}: {
  ctx: ExampleContext;
  archived?: boolean;
  badge?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set([
        "sub_math",
        "sub_math/folder/Worksheets",
        "sub_math/folder/Worksheets/Solutions",
        "sub_num",
      ]),
  );
  const [active, setActive] = useState<string | undefined>("res_ws3_note");
  const [drop, setDrop] = useState<string | undefined>(
    ctx.state === "drag" ? "sub_prog" : undefined,
  );
  return (
    <SubjectTree
      subjects={toTreeSubjects({ includeArchived: archived ?? false }).map(
        (subject) =>
          badge && subject.linked ? { ...subject, badge: "3 new" } : subject,
      )}
      expandedIds={expanded}
      onExpandedChange={(id, open) => {
        setExpanded((previous) => {
          const next = new Set(previous);
          if (open) next.add(id);
          else next.delete(id);
          return next;
        });
        ctx.log("onExpandedChange", { id, open });
      }}
      activeResourceId={active}
      onSelect={(id) => {
        if (ctx.state === "drag") setDrop(id);
        ctx.log("onSelect", id);
      }}
      onOpenResource={(id) => {
        setActive(id);
        ctx.log("onOpenResource", id);
      }}
      onMoveSubject={(id, direction) =>
        ctx.log("onMoveSubject", { id, direction })
      }
      move={{
        canDrop: (dragged, target) =>
          target.kind !== "resource" &&
          !(target.kind === "folder" && target.folder.linked) &&
          dragged.id !== target.id,
        onMove: (dragged, target) =>
          ctx.log("onMove", { from: dragged.id, to: target.id }),
      }}
      renderActions={() => (
        <Button
          variant="subtle"
          size="icon-sm"
          aria-label="More"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontalIcon />
        </Button>
      )}
      draggingId={ctx.state === "drag" ? "res_prog_ptr" : undefined}
      dropTargetId={drop}
      className="py-1"
    />
  );
}

function TabsExample({
  ctx,
  tabs: initial,
  width,
}: {
  ctx: ExampleContext;
  tabs: DocumentTabItem[];
  width?: number;
}) {
  const [tabs, setTabs] = useState(initial);
  const [active, setActive] = useState(initial[0]?.id);
  const collisions = tabsNeedingSubject(tabs);
  return (
    <div style={{ width }} className="max-w-full">
      <DocumentTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          showSubject: tab.showSubject || collisions.has(tab.id),
        }))}
        activeId={active}
        onActivate={(id) => {
          setActive(id);
          ctx.log("onActivate", id);
        }}
        onClose={(id) => {
          setTabs((previous) => previous.filter((tab) => tab.id !== id));
          ctx.log("onClose", id);
        }}
        onReorder={(from, to) => {
          setTabs((previous) => {
            const next = [...previous];
            const [moved] = next.splice(from, 1);
            if (moved) next.splice(to, 0, moved);
            return next;
          });
          ctx.log("onReorder", { from, to });
        }}
        onDragOut={(id) => ctx.log("onDragOut", id)}
        onNewTab={() => ctx.log("onNewTab")}
      />
    </div>
  );
}

const baseTabs = openTabs.map(toTabItem);

export const page: ExamplePage = {
  section: "patterns",
  group: "Navigation",
  slug: "navigation",
  title: "Workspace navigation",
  description:
    "Sidebar, subject tree, projects, document tabs, pane headers, and split handles. Subject identity is always name plus colour, never colour alone.",
  source: "packages/ui/src/patterns/navigation/subject-tree.tsx",
  keywords: ["sidebar", "tree", "tabs", "panes", "split", "workspace"],
  examples: [
    {
      id: "switcher",
      title: "Workspace switcher",
      width: 240,
      surface: "sidebar",
      states: ["default", "read-only", "no-recents"],
      render: (ctx) => (
        <div className="p-2">
          <WorkspaceSwitcher
            workspace={workspace}
            recent={ctx.state === "no-recents" ? [] : workspace.recent}
            readOnly={ctx.state === "read-only"}
            onSwitch={(id) => ctx.log("onSwitch", id)}
            onCreate={() => ctx.log("onCreate")}
            onOpenFolder={() => ctx.log("onOpenFolder")}
          />
        </div>
      ),
    },
    {
      id: "tree",
      title: "Subject tree",
      description:
        "Arrow keys move, Right expands, Left collapses, Enter opens, typing jumps to a row, Alt+Up/Down reorders subjects. Folders filled from Moodle carry its mark. Dirty and missing rows are labelled, not just coloured.",
      width: 260,
      height: 460,
      surface: "sidebar",
      states: ["default", "archived", "drag", "badge"],
      render: (ctx) => (
        <TreeExample
          ctx={ctx}
          archived={ctx.state === "archived"}
          badge={ctx.state === "badge"}
        />
      ),
    },
    {
      id: "sections",
      title: "Sections and destinations",
      width: 240,
      surface: "sidebar",
      render: (ctx) => {
        const projects = toSidebarProjects();
        return (
          <div className="flex flex-col py-2">
            <SidebarSection
              title="Projects"
              count={projects.length}
              expanded
              onToggle={(open) => ctx.log("onToggle", open)}
            >
              <div className="flex flex-col gap-px px-1">
                {projects.map((project, index) => (
                  <ProjectRow
                    key={project.id}
                    {...project}
                    active={index === 0}
                    onClick={() => ctx.log("onOpenProject", project.id)}
                  />
                ))}
              </div>
            </SidebarSection>
            <div className="mt-2 flex flex-col gap-px px-1">
              <SidebarNavItem
                icon={<LibraryIcon />}
                label="Library"
                count={1}
                onClick={() => ctx.log("onNavigate", "library")}
              />
              <SidebarNavItem
                icon={<BookOpenIcon />}
                label="Study"
                active
                count={3}
                onClick={() => ctx.log("onNavigate", "study")}
              />
              <SidebarNavItem
                icon={<Trash2Icon />}
                label="Trash"
                count={3}
                onClick={() => ctx.log("onNavigate", "trash")}
              />
            </div>
          </div>
        );
      },
    },
    {
      id: "tabs",
      title: "Document tabs",
      description:
        "Two tabs share the title “Resolution — Worksheet 3”, so both show their subject. The pinned PDF is icon-only; the dirty note shows a dot until hovered; the missing PDF is flagged.",
      width: "full",
      states: ["default", "overflow", "narrow"],
      render: (ctx) => {
        const tabs =
          ctx.state === "overflow"
            ? [
                ...baseTabs,
                ...baseTabs.map((tab, index) => ({
                  ...tab,
                  id: `${tab.id}-copy-${index}`,
                  pinned: false,
                })),
              ]
            : baseTabs;
        return (
          <div className="-m-4">
            <TabsExample
              ctx={ctx}
              tabs={tabs}
              {...(ctx.state === "narrow" ? { width: 520 } : {})}
            />
          </div>
        );
      },
    },
    {
      id: "pane-header",
      title: "Pane header",
      width: "full",
      states: ["focused", "unfocused", "empty"],
      render: (ctx) => (
        <div className="-m-4 flex h-64 flex-col">
          <PaneHeader
            focused={ctx.state === "focused"}
            onSplitHorizontal={() => ctx.log("onSplitHorizontal")}
            onSplitVertical={() => ctx.log("onSplitVertical")}
            onMaximise={() => ctx.log("onMaximise")}
            onClose={() => ctx.log("onClose")}
          >
            {ctx.state === "empty" ? null : (
              <TabsExample ctx={ctx} tabs={baseTabs.slice(0, 3)} />
            )}
          </PaneHeader>
          {ctx.state === "empty" ? (
            <PaneEmpty
              actions={
                <Button variant="outline" size="sm">
                  Open recent
                </Button>
              }
            />
          ) : (
            <div className="document flex-1 p-6 text-muted-foreground">
              Pane content
            </div>
          )}
        </div>
      ),
    },
    {
      id: "split",
      title: "Split handles",
      description: "Drag the divider or focus it and press the arrow keys.",
      width: "full",
      height: 360,
      states: ["horizontal", "vertical", "nested"],
      render: (ctx) => (
        <SplitLayout
          direction={ctx.state === "vertical" ? "vertical" : "horizontal"}
          withHandle
          onLayoutChange={(layout) => ctx.log("onLayoutChange", layout)}
        >
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Rows2Icon className="mr-2 size-4" /> PDF
          </div>
          {ctx.state === "nested" ? (
            <SplitLayout direction="vertical">
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Note
              </div>
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Outline
              </div>
            </SplitLayout>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Note
            </div>
          )}
        </SplitLayout>
      ),
    },
  ],
};
