import { z } from "zod";

const tabSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  title: z.string(),
});

const paneSchema = z.object({
  id: z.string(),
  tabs: z.array(tabSchema),
  activeTabId: z.string().nullable(),
});

export const layoutSchema = z.object({
  version: z.literal(1),
  panes: z.array(paneSchema).min(1).max(2),
  focusedPaneId: z.string(),
  sidebarOpen: z.boolean(),
  aiOpen: z.boolean(),
  expanded: z.array(z.string()),
  conversationId: z.string().nullable().catch(null),
});

export type Tab = z.infer<typeof tabSchema>;
export type Pane = z.infer<typeof paneSchema>;
export type Layout = z.infer<typeof layoutSchema>;

/** The graph opens in a tab of its own rather than as a file. */
export const GRAPH_TAB_ID = "resit:graph";
export const SCHEDULE_TAB_ID = "resit:schedule";
export const PRACTICE_TAB_ID = "resit:practice";
export const PROFILE_TAB_ID = "resit:profile";

/** One quiz, by subject and quiz ID. */
export function quizTabId(subjectId: string, quizId: string): string {
  return `resit:quiz:${subjectId}:${quizId}`;
}

export function parseQuizTabId(
  tabResourceId: string,
): { subjectId: string; quizId: string } | null {
  const match = /^resit:quiz:([^:]+):([^:]+)$/.exec(tabResourceId);
  return match?.[1] && match[2]
    ? { subjectId: match[1], quizId: match[2] }
    : null;
}

/** A project's page, listing what it holds. */
export function projectTabId(projectId: string): string {
  return `resit:project:${projectId}`;
}

export function parseProjectTabId(tabResourceId: string): string | null {
  return /^resit:project:([^:]+)$/.exec(tabResourceId)?.[1] ?? null;
}

/** A Moodle activity's page, by subject and Moodle module. */
export function activityTabId(subjectId: string, moduleId: number): string {
  return `resit:activity:${subjectId}:${moduleId}`;
}

export function parseActivityTabId(
  tabResourceId: string,
): { subjectId: string; moduleId: number } | null {
  const match = /^resit:activity:([^:]+):(\d+)$/.exec(tabResourceId);
  return match?.[1] && match[2]
    ? { subjectId: match[1], moduleId: Number(match[2]) }
    : null;
}

/** A subject's Moodle course page, as resit last read it. */
export function courseTabId(subjectId: string): string {
  return `resit:course:${subjectId}`;
}

export function parseCourseTabId(tabResourceId: string): string | null {
  return /^resit:course:([^:]+)$/.exec(tabResourceId)?.[1] ?? null;
}

const newId = () => crypto.randomUUID();

export function emptyLayout(expanded: string[] = []): Layout {
  const pane = { id: newId(), tabs: [], activeTabId: null };
  return {
    version: 1,
    panes: [pane],
    focusedPaneId: pane.id,
    sidebarOpen: true,
    aiOpen: false,
    expanded,
    conversationId: null,
  };
}

/** Parses a saved layout, falling back to an empty one. */
export function restoreLayout(saved: unknown, expanded: string[]): Layout {
  const parsed = layoutSchema.safeParse(saved);
  if (!parsed.success) return emptyLayout(expanded);
  const layout = parsed.data;
  if (!layout.panes.some((pane) => pane.id === layout.focusedPaneId))
    layout.focusedPaneId = layout.panes[0]!.id;
  return layout;
}

export type LayoutAction =
  | { type: "open"; resourceId: string; title: string; paneId?: string }
  | { type: "activate"; paneId: string; tabId: string }
  | { type: "close"; paneId: string; tabId: string }
  | { type: "close-resource"; resourceId: string }
  | { type: "rename-resource"; resourceId: string; title: string }
  | { type: "reorder"; paneId: string; from: number; to: number }
  | { type: "move-to-other-pane"; paneId: string; tabId: string }
  | { type: "split"; paneId: string }
  | { type: "close-pane"; paneId: string }
  | { type: "focus"; paneId: string }
  | { type: "toggle-sidebar" }
  | { type: "set-ai-open"; open: boolean }
  | { type: "set-expanded"; id: string; expanded: boolean }
  | { type: "set-conversation"; conversationId: string | null };

function updatePane(
  layout: Layout,
  paneId: string,
  update: (pane: Pane) => Pane,
): Layout {
  return {
    ...layout,
    panes: layout.panes.map((pane) =>
      pane.id === paneId ? update(pane) : pane,
    ),
  };
}

/** Removes a tab and picks the neighbour that becomes active. */
function withoutTab(pane: Pane, tabId: string): Pane {
  const index = pane.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return pane;
  const tabs = pane.tabs.filter((tab) => tab.id !== tabId);
  const activeTabId =
    pane.activeTabId === tabId
      ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
      : pane.activeTabId;
  return { ...pane, tabs, activeTabId };
}

/** Drops an empty second pane so a lone empty split never lingers. */
function collapseEmptyPanes(layout: Layout): Layout {
  if (layout.panes.length < 2) return layout;
  const panes = layout.panes.filter((pane) => pane.tabs.length > 0);
  if (panes.length === layout.panes.length) return layout;
  const kept = panes.length > 0 ? panes : [layout.panes[0]!];
  return {
    ...layout,
    panes: kept,
    focusedPaneId: kept.some((pane) => pane.id === layout.focusedPaneId)
      ? layout.focusedPaneId
      : kept[0]!.id,
  };
}

/**
 * Tabs and panes. A resource is open in at most one tab, so opening it
 * again focuses the existing tab.
 */
export function layoutReducer(layout: Layout, action: LayoutAction): Layout {
  switch (action.type) {
    case "open": {
      for (const pane of layout.panes) {
        const tab = pane.tabs.find(
          (entry) => entry.resourceId === action.resourceId,
        );
        if (tab)
          return {
            ...updatePane(layout, pane.id, (current) => ({
              ...current,
              activeTabId: tab.id,
            })),
            focusedPaneId: pane.id,
          };
      }
      const paneId = action.paneId ?? layout.focusedPaneId;
      const tab: Tab = {
        id: newId(),
        resourceId: action.resourceId,
        title: action.title,
      };
      return {
        ...updatePane(layout, paneId, (pane) => {
          const index = pane.tabs.findIndex(
            (entry) => entry.id === pane.activeTabId,
          );
          const tabs = [...pane.tabs];
          tabs.splice(index + 1, 0, tab);
          return { ...pane, tabs, activeTabId: tab.id };
        }),
        focusedPaneId: paneId,
      };
    }
    case "activate":
      return {
        ...updatePane(layout, action.paneId, (pane) => ({
          ...pane,
          activeTabId: action.tabId,
        })),
        focusedPaneId: action.paneId,
      };
    case "close":
      return collapseEmptyPanes(
        updatePane(layout, action.paneId, (pane) =>
          withoutTab(pane, action.tabId),
        ),
      );
    case "close-resource":
      return collapseEmptyPanes({
        ...layout,
        panes: layout.panes.map((pane) => {
          const tab = pane.tabs.find(
            (entry) => entry.resourceId === action.resourceId,
          );
          return tab ? withoutTab(pane, tab.id) : pane;
        }),
      });
    case "rename-resource":
      return {
        ...layout,
        panes: layout.panes.map((pane) => ({
          ...pane,
          tabs: pane.tabs.map((tab) =>
            tab.resourceId === action.resourceId
              ? { ...tab, title: action.title }
              : tab,
          ),
        })),
      };
    case "reorder":
      return updatePane(layout, action.paneId, (pane) => {
        const tabs = [...pane.tabs];
        const [moved] = tabs.splice(action.from, 1);
        if (moved) tabs.splice(action.to, 0, moved);
        return { ...pane, tabs };
      });
    case "move-to-other-pane": {
      const source = layout.panes.find((pane) => pane.id === action.paneId);
      const tab = source?.tabs.find((entry) => entry.id === action.tabId);
      if (!source || !tab) return layout;
      let panes = layout.panes;
      let target = panes.find((pane) => pane.id !== source.id);
      if (!target) {
        if (source.tabs.length < 2) return layout;
        target = { id: newId(), tabs: [], activeTabId: null };
        panes = [...panes, target];
      }
      const targetId = target.id;
      return collapseEmptyPanes({
        ...layout,
        focusedPaneId: targetId,
        panes: panes.map((pane) => {
          if (pane.id === source.id) return withoutTab(pane, tab.id);
          if (pane.id === targetId)
            return { ...pane, tabs: [...pane.tabs, tab], activeTabId: tab.id };
          return pane;
        }),
      });
    }
    case "split": {
      if (layout.panes.length > 1) return layout;
      const source = layout.panes[0]!;
      const active = source.tabs.find((tab) => tab.id === source.activeTabId);
      const moving = active && source.tabs.length > 1 ? active : null;
      const pane: Pane = {
        id: newId(),
        tabs: moving ? [moving] : [],
        activeTabId: moving?.id ?? null,
      };
      return {
        ...layout,
        panes: [moving ? withoutTab(source, moving.id) : source, pane],
        focusedPaneId: pane.id,
      };
    }
    case "close-pane": {
      if (layout.panes.length < 2) return layout;
      const closing = layout.panes.find((pane) => pane.id === action.paneId);
      const other = layout.panes.find((pane) => pane.id !== action.paneId);
      if (!closing || !other) return layout;
      const merged: Pane = {
        ...other,
        tabs: [...other.tabs, ...closing.tabs],
        activeTabId: other.activeTabId ?? closing.activeTabId,
      };
      return { ...layout, panes: [merged], focusedPaneId: merged.id };
    }
    case "focus":
      return layout.focusedPaneId === action.paneId
        ? layout
        : { ...layout, focusedPaneId: action.paneId };
    case "toggle-sidebar":
      return { ...layout, sidebarOpen: !layout.sidebarOpen };
    case "set-ai-open":
      return { ...layout, aiOpen: action.open };
    case "set-expanded":
      return {
        ...layout,
        expanded: action.expanded
          ? [...new Set([...layout.expanded, action.id])]
          : layout.expanded.filter((id) => id !== action.id),
      };
    case "set-conversation":
      return { ...layout, conversationId: action.conversationId };
  }
}

export function activeTab(
  layout: Layout,
  paneId = layout.focusedPaneId,
): Tab | null {
  const pane = layout.panes.find((entry) => entry.id === paneId);
  return pane?.tabs.find((tab) => tab.id === pane.activeTabId) ?? null;
}
