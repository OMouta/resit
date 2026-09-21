import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";

import type { AppState, DesktopEvent, LockedWorkspace } from "../shared/ipc";
import { abandonRenders } from "./agent/render";
import { abortAllTurns } from "./agent/turns";
import { setLiveContext } from "./context";
import { moodleConnection } from "./moodle/credentials";
import { refreshReminders } from "./planning/reminders";
import {
  forgetLastWorkspace,
  loadSettings,
  rememberWorkspace,
} from "./settings";
import { readJson, writeJson } from "./workspace/files";
import {
  acquireLock,
  heldHere,
  releaseLock,
  releaseLockSync,
  type WorkspaceLock,
} from "./workspace/lock";
import { closeSearchIndex, updateSearchIndex } from "./workspace/search";
import {
  createWorkspace,
  openWorkspace,
  readWorkspaceFile,
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
    path === "plan.json" ||
    path === "learner.json" ||
    /^subjects\/[^/]+\/practice(\/|$)/.test(path) ||
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
            if (current !== workspace) return;
            emit({ type: "workspace-changed", snapshot: snapshot(workspace) });
            void indexInBackground(workspace);
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

/** Reads new and changed files into the search index while nothing waits. */
async function indexInBackground(workspace: OpenWorkspace): Promise<void> {
  try {
    await updateSearchIndex(workspace);
  } catch (error) {
    console.error("Updating the search index failed", error);
  }
}

async function activateWorkspace(workspace: OpenWorkspace): Promise<void> {
  if (current && current.root !== workspace.root) {
    closeSearchIndex(current);
    await releaseLock(current.root).catch(() => undefined);
  }
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
  void refreshReminders();
  void indexInBackground(workspace);
}

function lockedWorkspace(path: string, lock: WorkspaceLock): LockedWorkspace {
  return { path, here: heldHere(lock), host: lock.host, since: lock.since };
}

/**
 * Opens a workspace folder, unless another copy of resit has it open. Then
 * nothing changes and the other copy's lock comes back; `force` opens the
 * workspace anyway.
 */
export async function openFolder(
  folder: string,
  force = false,
): Promise<LockedWorkspace | null> {
  await readWorkspaceFile(folder);
  const held = await acquireLock(folder, force);
  if (held) return lockedWorkspace(folder, held);
  let workspace: OpenWorkspace;
  try {
    workspace = await openWorkspace(folder);
  } catch (error) {
    if (current?.root !== folder)
      await releaseLock(folder).catch(() => undefined);
    throw error;
  }
  await activateWorkspace(workspace);
  return null;
}

export async function createAndOpen(
  input: Parameters<typeof createWorkspace>[0],
): Promise<void> {
  const workspace = await createWorkspace(input);
  await acquireLock(workspace.root, true);
  await activateWorkspace(workspace);
}

/** Lets go of the open workspace as the app quits. */
export function releaseWorkspaceSync(): void {
  if (current) releaseLockSync(current.root);
}

export async function closeCurrentWorkspace(): Promise<void> {
  stopWatching();
  abortAllTurns();
  abandonRenders();
  setLiveContext(null);
  if (current) {
    closeSearchIndex(current);
    await releaseLock(current.root).catch(() => undefined);
  }
  current = null;
  void refreshReminders();
  await forgetLastWorkspace();
}

export async function appState(extra?: {
  reopenError?: string | undefined;
  locked?: LockedWorkspace | null | undefined;
}): Promise<AppState> {
  const settings = await loadSettings();
  return {
    settings,
    recent: settings.recent,
    moodle: await moodleConnection(),
    workspace: current ? snapshot(current) : null,
    layout: current ? await readLayout(current) : null,
    ...(extra?.reopenError ? { reopenError: extra.reopenError } : {}),
    ...(extra?.locked ? { locked: extra.locked } : {}),
  };
}

interface Reopened {
  error?: string;
  locked?: LockedWorkspace;
}

async function openLastWorkspace(): Promise<Reopened> {
  if (current) return {};
  const settings = await loadSettings();
  if (!settings.reopenLastWorkspace || !settings.lastWorkspacePath) return {};
  try {
    const locked = await openFolder(settings.lastWorkspacePath);
    return locked ? { locked } : {};
  } catch (error) {
    await forgetLastWorkspace().catch(() => undefined);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

let reopening: Promise<Reopened> | null = null;

/**
 * Reopens the last workspace on launch, once however often it is asked for:
 * the renderer mounts twice in development. Failure leaves the start screen,
 * and so does a workspace another copy of resit has open.
 */
export function reopenLastWorkspace(): Promise<Reopened> {
  reopening ??= openLastWorkspace();
  return reopening;
}
