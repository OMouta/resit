import { readFile } from "node:fs/promises";

import { isTextFile, type ResourceInfo } from "../../shared/workspace";
import { assertInsideWorkspace } from "./files";
import { resourcePath, type OpenWorkspace } from "./workspace";

/** Imported files whose words resit can read, for search and the assistant. */
export function hasReadableText(info: ResourceInfo): boolean {
  return info.kind === "attachment" && isTextFile(info.path);
}

/** The words in an imported file, or null for a kind it cannot read. */
export async function readableText(
  workspace: OpenWorkspace,
  resourceId: string,
): Promise<string | null> {
  const info = workspace.resources.get(resourceId)?.info;
  if (!info || !hasReadableText(info)) return null;
  const path = resourcePath(workspace, resourceId);
  await assertInsideWorkspace(workspace.root, path);
  return readFile(path, "utf8");
}
