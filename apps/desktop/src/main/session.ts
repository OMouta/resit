import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";

import type { AppState, DesktopEvent } from "../shared/ipc";
import { abandonRenders } from "./agent/render";
import { abortAllTurns } from "./agent/turns";
import { setLiveContext } from "./context";
import { moodleConnection } from "./moodle/credentials";
import {
  forgetLastWorkspace,
  loadSettings,
  rememberWorkspace,
} from "./settings";
import { readJson, writeJson } from "./workspace/files";
import {
  openWorkspace,
  scanWorkspace,
  snapshot,
  type OpenWorkspace,
} from "./workspace/workspace";

/** The workspace open in the window, plus its file watcher. */
let current: OpenWorkspace | null = null;
let watcher: FSWatcher | null = null;
let rescanTimer: NodeJS.Timeout | null = null;
let emit: (event: DesktopEvent) => void = () => undefined;

export function setEventSink(sink: (event: DesktopEvent) => void): void {
  emit = sink;
}

export function emitEvent(event: DesktopEvent): void {
  emit(event);
}

export function currentWorkspace(): OpenWorkspace {
  if (!current) throw new Error("No workspace is open.");
  return current;
}

export function hasWorkspace(): boolean {
  return current !== null;
}

function layoutPath(workspace: OpenWorkspace): string {
  return join(workspace.root, ".resit", "state", "layout.json");
}

async function readLayout(workspace: OpenWorkspace): Promise<unknown> {
  try {
    return await readJson(layoutPath(workspace));
  } catch {
    return null;
  }
}

export async function saveLayout(layout: unknown): Promise<void> {
  if (!current) return;
  await writeJson(layoutPath(current), layout);
}

/** Paths whose changes do not affect the resource tree. */
function ignored(filename: string): boolean {
  const path = filename.replaceAll("\\", "/");
  const base = path.split("/").at(-1) ?? "";
  return (
    path.startsWith(".resit/") ||
    path === ".resit" ||
    path.startsWith("conversations/") ||
    path.includes("/annotations/") ||
    /^subjects\/[^/]+\/activities\.json$/.test(path) ||
    base.endsWith(".tmp")
  );
}

function startWatching(workspace: OpenWorkspace): void {
  try {
    watcher = watch(workspace.root, { recursive: true }, (_type, filename) => {
      if (!filename || ignored(filename.toString())) return;
      if (rescanTimer) clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => {
        rescanTimer = null;
        if (current !== workspace) return;
        void scanWorkspace(workspace).then(
          () => {
            if (current === workspace)
              emit({
                type: "workspace-changed",
                snapshot: snapshot(workspace),
              });
          },
          (error: unknown) => console.error("Workspace rescan failed", error),
        );
      }, 400);
    });
    watcher.on("error", (error) => console.error("File watcher failed", error));
  } catch (error) {
    // Changes made outside resit then appear after the next app action.
    console.error("Unable to watch the workspace folder", error);
  }
}

function stopWatching(): void {
  watcher?.close();
  watcher = null;
  if (rescanTimer) clearTimeout(rescanTimer);
  rescanTimer = null;
}

export async function activateWorkspace(
  workspace: OpenWorkspace,
): Promise<void> {
  stopWatching();
  abortAllTurns();
  abandonRenders();
  setLiveContext(null);
  current = workspace;
  try {
    await rememberWorkspace({
      id: workspace.file.id,
      name: workspace.file.name,
      path: workspace.root,
    });
  } catch (error) {
    // The workspace is open either way; only the recent list is behind.
    console.error("Unable to save the recent workspaces", error);
  }
  startWatching(workspace);
}

export async function closeCurrentWorkspace(): Promise<void> {
  stopWatching();
  abortAllTurns();
  abandonRenders();
  setLiveContext(null);
  current = null;
  await forgetLastWorkspace();
}

export async function appState(extra?: {
  reopenError?: string;
}): Promise<AppState> {
  const settings = await loadSettings();
  return {
    settings,
    recent: settings.recent,
    moodle: await moodleConnection(),
    workspace: current ? snapshot(current) : null,
    layout: current ? await readLayout(current) : null,
    ...(extra?.reopenError ? { reopenError: extra.reopenError } : {}),
  };
}

async function openLastWorkspace(): Promise<string | undefined> {
  if (current) return undefined;
  const settings = await loadSettings();
  if (!settings.reopenLastWorkspace || !settings.lastWorkspacePath)
    return undefined;
  try {
    await activateWorkspace(await openWorkspace(settings.lastWorkspacePath));
    return undefined;
  } catch (error) {
    await forgetLastWorkspace().catch(() => undefined);
    return error instanceof Error ? error.message : String(error);
  }
}

let reopening: Promise<string | undefined> | null = null;

/**
 * Reopens the last workspace on launch, once however often it is asked for:
 * the renderer mounts twice in development. Failure leaves the start screen.
 */
export function reopenLastWorkspace(): Promise<string | undefined> {
  reopening ??= openLastWorkspace();
  return reopening;
}
