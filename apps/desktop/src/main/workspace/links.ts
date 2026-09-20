import type { ResourceLink } from "../../shared/ipc";
import { noteText } from "./search";
import type { OpenWorkspace } from "./workspace";

/**
 * A link into this workspace, as notes store it: `resit://resource/<id>`,
 * optionally with a page or highlight after it.
 */
const LINK_PATTERN = /resit:\/\/resource\/([A-Za-z0-9._~%-]+)/g;

/**
 * Every link one note makes to another note or document, counted. Notes
 * that cannot be read are skipped: the file view reports the problem.
 */
export async function workspaceLinks(
  workspace: OpenWorkspace,
): Promise<ResourceLink[]> {
  const resources = [...workspace.resources.values()].map(
    (entry) => entry.info,
  );
  const known = new Set(resources.map((resource) => resource.id));
  const counts = new Map<string, number>();

  for (const resource of resources) {
    if (resource.kind !== "note") continue;
    let body: string;
    try {
      body = await noteText(workspace, resource);
    } catch {
      continue;
    }
    for (const match of body.matchAll(LINK_PATTERN)) {
      let target: string;
      try {
        target = decodeURIComponent(match[1] ?? "");
      } catch {
        continue;
      }
      if (!target || target === resource.id || !known.has(target)) continue;
      const key = `${resource.id}\u0000${target}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts].map(([key, count]) => {
    const [from = "", to = ""] = key.split("\u0000");
    return { from, to, count };
  });
}
