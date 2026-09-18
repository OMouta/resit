import { extname } from "node:path";
import { dialog, nativeTheme, shell, type BrowserWindow } from "electron";
import { z } from "zod";

import { CHANNELS, HEALTH_CHECK_CHANNEL } from "../shared/ipc";
import { settingsPatchSchema } from "../shared/settings";
import { subjectColorSchema } from "../shared/workspace";
import { checkHealth } from "./health";
import { handle, id, title } from "./ipc";
import {
  activateWorkspace,
  appState,
  closeCurrentWorkspace,
  currentWorkspace,
  reopenLastWorkspace,
  saveLayout,
} from "./session";
import { updateSettings } from "./settings";
import {
  createNote,
  createSubject,
  createWorkspace,
  deleteResource,
  deleteSubject,
  importFile,
  openWorkspace,
  readNote,
  readResourceBytes,
  renameResource,
  resourcePath,
  saveNote,
  snapshot,
  updateSubject,
} from "./workspace/workspace";

const path = z.string().min(1).max(4096);
const MAX_LAYOUT_BYTES = 256 * 1024;
const MAX_NOTE_BYTES = 20 * 1024 * 1024;

/** Extensions opened with "show in folder" instead of the default app. */
const NEVER_LAUNCH = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".ps1",
  ".sh",
  ".app",
  ".js",
  ".vbs",
  ".scr",
  ".lnk",
  ".jar",
  ".command",
  ".url",
  ".desktop",
  ".appimage",
]);

export function registerHandlers(window: () => BrowserWindow | null): void {
  let firstLoad = true;

  handle(HEALTH_CHECK_CHANNEL, z.tuple([]), () => checkHealth());

  handle(CHANNELS.getAppState, z.tuple([]), async () => {
    const reopenError = firstLoad ? await reopenLastWorkspace() : undefined;
    firstLoad = false;
    return appState(reopenError ? { reopenError } : undefined);
  });

  handle(
    CHANNELS.updateSettings,
    z.tuple([settingsPatchSchema]),
    async (patch) => {
      const settings = await updateSettings(patch);
      nativeTheme.themeSource = settings.theme;
      return settings;
    },
  );

  handle(CHANNELS.chooseFolder, z.tuple([title]), async (dialogTitle) => {
    const owner = window();
    const options: Electron.OpenDialogOptions = {
      title: dialogTitle,
      properties: ["openDirectory", "createDirectory"],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  handle(
    CHANNELS.createWorkspace,
    z.tuple([
      z.object({
        folder: path,
        name: title,
        subject: z.object({ name: title, color: subjectColorSchema }),
      }),
    ]),
    async (input) => {
      await activateWorkspace(await createWorkspace(input));
      return appState();
    },
  );

  handle(CHANNELS.openWorkspace, z.tuple([path]), async (folder) => {
    await activateWorkspace(await openWorkspace(folder));
    return appState();
  });

  handle(CHANNELS.closeWorkspace, z.tuple([]), async () => {
    await closeCurrentWorkspace();
    return appState();
  });

  handle(CHANNELS.saveLayout, z.tuple([z.unknown()]), async (layout) => {
    if (JSON.stringify(layout).length > MAX_LAYOUT_BYTES)
      throw new Error("Layout is too large to save.");
    await saveLayout(layout);
  });

  handle(
    CHANNELS.createSubject,
    z.tuple([z.object({ name: title, color: subjectColorSchema })]),
    (input) => createSubject(currentWorkspace(), input),
  );

  handle(
    CHANNELS.updateSubject,
    z.tuple([
      z.object({
        id,
        name: title.optional(),
        color: subjectColorSchema.optional(),
        sortOrder: z.number().int().optional(),
      }),
    ]),
    async (input) => {
      const workspace = currentWorkspace();
      await updateSubject(workspace, input);
      return snapshot(workspace);
    },
  );

  handle(CHANNELS.deleteSubject, z.tuple([id]), async (subjectId) => {
    const workspace = currentWorkspace();
    await deleteSubject(workspace, subjectId);
    return snapshot(workspace);
  });

  handle(
    CHANNELS.createNote,
    z.tuple([z.object({ subjectId: id, title })]),
    (input) => createNote(currentWorkspace(), input),
  );

  handle(CHANNELS.readNote, z.tuple([id]), (noteId) =>
    readNote(currentWorkspace(), noteId),
  );

  handle(
    CHANNELS.saveNote,
    z.tuple([
      z.object({
        id,
        body: z.string().max(MAX_NOTE_BYTES),
        expectedRevision: z.string().max(200),
      }),
    ]),
    (input) => saveNote(currentWorkspace(), input),
  );

  handle(CHANNELS.renameResource, z.tuple([z.object({ id, title })]), (input) =>
    renameResource(currentWorkspace(), input),
  );

  handle(CHANNELS.deleteResource, z.tuple([id]), async (resourceId) => {
    const workspace = currentWorkspace();
    await deleteResource(workspace, resourceId);
    return snapshot(workspace);
  });

  handle(CHANNELS.importFiles, z.tuple([id]), async (subjectId) => {
    const workspace = currentWorkspace();
    const owner = window();
    const options: Electron.OpenDialogOptions = {
      title: "Import files",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Documents, notes, and images",
          extensions: ["pdf", "md", "png", "jpg", "jpeg", "gif", "webp", "svg"],
        },
        { name: "All files", extensions: ["*"] },
      ],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return [];
    const imported = [];
    for (const sourcePath of result.filePaths)
      imported.push(await importFile(workspace, { subjectId, sourcePath }));
    return imported;
  });

  handle(CHANNELS.readResourceBytes, z.tuple([id]), (resourceId) =>
    readResourceBytes(currentWorkspace(), resourceId),
  );

  handle(CHANNELS.openResourceExternally, z.tuple([id]), async (resourceId) => {
    const workspace = currentWorkspace();
    const file = resourcePath(workspace, resourceId);
    if (NEVER_LAUNCH.has(extname(file).toLowerCase())) {
      shell.showItemInFolder(file);
      return;
    }
    const error = await shell.openPath(file);
    if (error) throw new Error(error);
  });
}
