import { useState } from "react";

import {
  DocumentTabs,
  tabsNeedingSubject,
} from "@resit/ui/patterns/navigation/document-tabs";
import {
  PaneEmpty,
  PaneHeader,
} from "@resit/ui/patterns/navigation/pane-header";
import { SplitLayout } from "@resit/ui/patterns/navigation/split-handle";
import {
  WorkspaceSidebar,
  type SidebarDestination,
} from "@resit/ui/patterns/navigation/workspace-sidebar";

import {
  toSidebarProjects,
  toTabItem,
  toTreeSubjects,
} from "../../fixtures/adapters";
import {
  openTabs,
  resourceById,
  workspace,
  type TabFixture,
} from "../../fixtures/workspace";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

type PaneId = "left" | "right";

function Composition({ ctx }: { ctx: ExampleContext }) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["sub_math", "sub_prog"]),
  );
  const [sections, setSections] = useState({ subjects: true, projects: true });
  const [tabs, setTabs] = useState<TabFixture[]>(openTabs);
  const [active, setActive] = useState<Record<PaneId, string | undefined>>({
    left: "tab_1",
    right: "tab_2",
  });
  const [focused, setFocused] = useState<PaneId>("right");
  const [destination, setDestination] = useState<
    SidebarDestination | undefined
  >();

  const paneTabs = (pane: PaneId) => tabs.filter((tab) => tab.paneId === pane);
  const activeResource = (pane: PaneId) => {
    const tab = tabs.find((entry) => entry.id === active[pane]);
    return tab ? resourceById(tab.resourceId) : undefined;
  };

  const open = (resourceId: string) => {
    const existing = tabs.find(
      (tab) => tab.resourceId === resourceId && tab.paneId === focused,
    );
    if (existing) {
      setActive((previous) => ({ ...previous, [focused]: existing.id }));
      return;
    }
    const id = `tab_${Date.now()}`;
    setTabs((previous) => [...previous, { id, resourceId, paneId: focused }]);
    setActive((previous) => ({ ...previous, [focused]: id }));
    ctx.log("openResource", { resourceId, pane: focused });
  };

  const close = (id: string) => {
    setTabs((previous) => {
      const closing = previous.find((tab) => tab.id === id);
      const next = previous.filter((tab) => tab.id !== id);
      if (closing && active[closing.paneId] === id) {
        const remaining = next.filter((tab) => tab.paneId === closing.paneId);
        setActive((current) => ({
          ...current,
          [closing.paneId]: remaining.at(-1)?.id,
        }));
      }
      return next;
    });
    ctx.log("closeTab", id);
  };

  const renderPane = (pane: PaneId) => {
    const items = paneTabs(pane).map(toTabItem);
    const collisions = tabsNeedingSubject(items);
    const resource = activeResource(pane);
    return (
      <div
        className="flex h-full min-h-0 flex-col bg-background"
        onFocusCapture={() => setFocused(pane)}
        onPointerDownCapture={() => setFocused(pane)}
      >
        <PaneHeader
          focused={focused === pane}
          onSplitHorizontal={() => ctx.log("splitHorizontal", pane)}
          onSplitVertical={() => ctx.log("splitVertical", pane)}
          onMaximise={() => ctx.log("maximise", pane)}
          onClose={() => ctx.log("closePane", pane)}
        >
          <DocumentTabs
            tabs={items.map((tab) => ({
              ...tab,
              showSubject: collisions.has(tab.id),
            }))}
            activeId={active[pane]}
            onActivate={(id) =>
              setActive((previous) => ({ ...previous, [pane]: id }))
            }
            onClose={close}
            onReorder={(from, to) => {
              setTabs((previous) => {
                const mine = previous.filter((tab) => tab.paneId === pane);
                const others = previous.filter((tab) => tab.paneId !== pane);
                const [moved] = mine.splice(from, 1);
                if (moved) mine.splice(to, 0, moved);
                return [...others, ...mine];
              });
            }}
            onDragOut={(id) => {
              const target: PaneId = pane === "left" ? "right" : "left";
              setTabs((previous) =>
                previous.map((tab) =>
                  tab.id === id ? { ...tab, paneId: target } : tab,
                ),
              );
              setActive((previous) => ({ ...previous, [target]: id }));
              ctx.log("moveTabToPane", { id, target });
            }}
            onNewTab={() => ctx.log("newTab", pane)}
          />
        </PaneHeader>
        {resource ? (
          <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-6">
            <div className="document">
              <h1>{resource.title}</h1>
              <p className="text-muted-foreground">
                {resource.kind === "pdf" ? `${resource.pages} pages` : "Note"} ·{" "}
                {resource.path}
              </p>
              {resource.missing ? (
                <p className="text-warning">
                  This file is missing from the workspace folder.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <PaneEmpty />
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="hidden w-60 shrink-0 border-r @lg:block">
        <WorkspaceSidebar
          switcher={{
            workspace,
            recent: workspace.recent,
            onSwitch: (id) => ctx.log("switchWorkspace", id),
            onCreate: () => ctx.log("createWorkspace"),
            onOpenFolder: () => ctx.log("openFolder"),
          }}
          tree={{
            subjects: toTreeSubjects(),
            expandedIds: expanded,
            onExpandedChange: (id, isOpen) =>
              setExpanded((previous) => {
                const next = new Set(previous);
                if (isOpen) next.add(id);
                else next.delete(id);
                return next;
              }),
            activeResourceId: activeResource(focused)?.id ?? "",
            onSelect: () => {},
            onOpenResource: open,
            onMoveSubject: (id, direction) =>
              ctx.log("moveSubject", { id, direction }),
          }}
          projects={toSidebarProjects()}
          onOpenProject={(id) => ctx.log("openProject", id)}
          activeDestination={destination}
          onNavigate={(next) => {
            setDestination(next);
            ctx.log("navigate", next);
          }}
          counts={{ trash: 3, conversations: 4 }}
          onAddSubject={() => ctx.log("addSubject")}
          onAddProject={() => ctx.log("addProject")}
          sections={sections}
          onSectionToggle={(section, isOpen) =>
            setSections((previous) => ({ ...previous, [section]: isOpen }))
          }
        />
      </div>
      <div className="min-w-0 flex-1">
        <SplitLayout direction="horizontal" minSize={240}>
          {renderPane("left")}
          {renderPane("right")}
        </SplitLayout>
      </div>
    </div>
  );
}

export const page: ExamplePage = {
  section: "patterns",
  group: "Navigation",
  slug: "navigation-composition",
  title: "Navigation composition",
  description:
    "Sidebar, two panes, and tab strips wired together with fixture data. Double-click or press Enter on a resource to open it in the focused pane; drag a tab above or below its strip to move it to the other pane. Below 1024px the sidebar hides.",
  source: "packages/ui/src/patterns/navigation/workspace-sidebar.tsx",
  keywords: ["composition", "workspace", "panes"],
  examples: [
    {
      id: "workspace",
      title: "Sidebar with two panes",
      width: "full",
      height: 640,
      render: (ctx) => <Composition key={ctx.resetKey} ctx={ctx} />,
    },
  ],
};
