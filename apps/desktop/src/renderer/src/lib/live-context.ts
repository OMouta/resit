import { useEffect, useRef } from "react";

import type { LiveContext, OpenFile } from "../../../shared/context";
import type { ResourceInfo } from "../../../shared/workspace";
import { viewFor } from "../views/view-registry";
import type { Layout } from "../workspace/layout";
import { api } from "./api";

const INTERVAL_MS = 1500;

/** The tabs open in each pane, and what the visible ones are showing. */
function openFiles(
  layout: Layout,
  resources: ReadonlyMap<string, ResourceInfo>,
): OpenFile[] {
  const files: OpenFile[] = [];
  layout.panes.forEach((pane, index) => {
    for (const tab of pane.tabs) {
      const resource = resources.get(tab.resourceId);
      if (!resource) continue;
      const visible = pane.activeTabId === tab.id;
      const view = visible ? (viewFor(resource.id)?.context() ?? {}) : {};
      files.push({
        resourceId: resource.id,
        title: resource.title,
        kind: resource.kind,
        pane: index + 1,
        visible,
        focused: visible && pane.id === layout.focusedPaneId,
        ...(view.page ? { page: view.page } : {}),
        ...(view.pageCount ? { pageCount: view.pageCount } : {}),
        ...(view.selection ? { selection: view.selection } : {}),
      });
    }
  });
  return files;
}

/**
 * Tells the main process what the window is showing, so the assistant can
 * see the file the student is looking at rather than guessing.
 */
export function useLiveContext(
  layout: Layout,
  resources: ReadonlyMap<string, ResourceInfo>,
): void {
  const sent = useRef("");
  const state = useRef({ layout, resources });
  state.current = { layout, resources };

  useEffect(() => {
    const report = () => {
      const files = openFiles(state.current.layout, state.current.resources);
      const key = JSON.stringify(files);
      if (key === sent.current) return;
      sent.current = key;
      const context: LiveContext = { at: new Date().toISOString(), files };
      api.updateLiveContext(context).catch(() => undefined);
    };
    report();
    const timer = window.setInterval(report, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // A new tab or pane is worth reporting before the next tick.
  useEffect(() => {
    const files = openFiles(layout, resources);
    const key = JSON.stringify(files);
    if (key === sent.current) return;
    sent.current = key;
    api
      .updateLiveContext({ at: new Date().toISOString(), files })
      .catch(() => undefined);
  }, [layout, resources]);
}
