import { extname } from "node:path";
import { dialog, nativeTheme, shell, type BrowserWindow } from "electron";
import { z } from "zod";

import { scopeSchema, turnContextSchema } from "../shared/conversations";
import { CHANNELS, HEALTH_CHECK_CHANNEL } from "../shared/ipc";
import { providerIdSchema, settingsPatchSchema } from "../shared/settings";
import {
  annotationColorSchema,
  annotationSegmentSchema,
  annotationTypeSchema,
  subjectColorSchema,
} from "../shared/workspace";
import { startTurn, stopTurn } from "./agent/turns";
import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from "./workspace/annotations";
import {
  createConversation,
  deleteConversation,
  listConversations,
  readConversation,
  updateConversation,
} from "./conversations/store";
import { checkHealth } from "./health";
import { handle, id, title } from "./ipc";
import {
  activateWorkspace,
  appState,
  closeCurrentWorkspace,
  currentWorkspace,
  emitEvent,
  reopenLastWorkspace,
  saveLayout,
} from "./session";
import { claudeModels, claudeStatus } from "./providers/claude";
import { codexModels, codexStatus } from "./providers/codex";
import { loadSettings, updateSettings } from "./settings";
import { searchWorkspace } from "./workspace/search";
import { listTrash, restoreFromTrash } from "./workspace/trash";
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
const MAX_COMMENT_CHARS = 4000;

/** One selection: its pages, the lines on each, and the text they cover. */
const segments = z
  .array(
    annotationSegmentSchema.extend({
      quads: annotationSegmentSchema.shape.quads.max(600),
      text: z.string().max(20_000),
    }),
  )
  .min(1)
  .max(50);

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

export function registerHandlers(
  window: () => BrowserWindow | null,
  onConfirmClose: () => void,
): void {
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
      if (patch.claude && "executablePath" in patch.claude)
        void claudeStatus(true);
      if (
        patch.codex &&
        ("executablePath" in patch.codex || "homePath" in patch.codex)
      )
        void codexStatus(true);
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

  handle(CHANNELS.listTrash, z.tuple([]), () => listTrash(currentWorkspace()));

  handle(CHANNELS.restoreFromTrash, z.tuple([id]), async (entryId) => {
    const workspace = currentWorkspace();
    await restoreFromTrash(workspace, entryId);
    return snapshot(workspace);
  });

  handle(CHANNELS.listAnnotations, z.tuple([id]), (documentId) =>
    listAnnotations(currentWorkspace(), documentId),
  );

  handle(
    CHANNELS.createAnnotation,
    z.tuple([
      z.object({
        documentId: id,
        type: annotationTypeSchema,
        color: annotationColorSchema,
        segments,
        comment: z.string().max(MAX_COMMENT_CHARS).optional(),
      }),
    ]),
    (input) => createAnnotation(currentWorkspace(), input),
  );

  handle(
    CHANNELS.updateAnnotation,
    z.tuple([
      z.object({
        documentId: id,
        id,
        color: annotationColorSchema.optional(),
        comment: z.string().max(MAX_COMMENT_CHARS).optional(),
      }),
    ]),
    (input) => updateAnnotation(currentWorkspace(), input),
  );

  handle(
    CHANNELS.deleteAnnotation,
    z.tuple([z.object({ documentId: id, id })]),
    (input) => deleteAnnotation(currentWorkspace(), input),
  );

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

  handle(CHANNELS.search, z.tuple([z.string().max(200)]), (query) =>
    searchWorkspace(currentWorkspace(), query, {
      allow: () => true,
      limit: 30,
    }),
  );

  handle(
    CHANNELS.openExternal,
    z.tuple([z.string().max(4096)]),
    async (url) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error("That link is not a valid address.");
      }
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol))
        throw new Error("Only web and email links open outside resit.");
      await shell.openExternal(parsed.href);
    },
  );

  handle(CHANNELS.getModels, z.tuple([providerIdSchema]), (provider) =>
    provider === "codex" ? codexModels() : claudeModels(),
  );

  handle(
    CHANNELS.getProviderStatus,
    z.tuple([providerIdSchema, z.boolean()]),
    (provider, refresh) =>
      provider === "codex" ? codexStatus(refresh) : claudeStatus(refresh),
  );

  handle(CHANNELS.listConversations, z.tuple([]), () =>
    listConversations(currentWorkspace()),
  );

  handle(
    CHANNELS.createConversation,
    z.tuple([scopeSchema, providerIdSchema.optional()]),
    async (scope, provider) =>
      createConversation(
        currentWorkspace(),
        scope,
        provider ?? (await loadSettings()).provider,
      ),
  );

  handle(CHANNELS.readConversation, z.tuple([id]), (conversationId) =>
    readConversation(currentWorkspace(), conversationId),
  );

  handle(
    CHANNELS.updateConversation,
    z.tuple([
      z.object({
        id,
        title: title.optional(),
        scope: scopeSchema.optional(),
        provider: providerIdSchema.optional(),
      }),
    ]),
    ({ id: conversationId, ...patch }) =>
      updateConversation(currentWorkspace(), conversationId, patch),
  );

  handle(CHANNELS.deleteConversation, z.tuple([id]), async (conversationId) => {
    await stopTurn(conversationId);
    await deleteConversation(currentWorkspace(), conversationId);
  });

  handle(
    CHANNELS.sendMessage,
    z.tuple([
      z.object({
        conversationId: id,
        text: z.string().trim().min(1).max(20_000),
        context: turnContextSchema,
      }),
    ]),
    (input) => startTurn(currentWorkspace(), emitEvent, input),
  );

  handle(CHANNELS.stopTurn, z.tuple([id]), (conversationId) =>
    stopTurn(conversationId),
  );

  handle(CHANNELS.confirmClose, z.tuple([]), () => onConfirmClose());
}
