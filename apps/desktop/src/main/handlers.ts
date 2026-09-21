import { extname } from "node:path";
import { dialog, nativeTheme, shell, type BrowserWindow } from "electron";
import { z } from "zod";

import { liveContextSchema } from "../shared/context";
import { scopeSchema, turnContextSchema } from "../shared/conversations";
import { CHANNELS, HEALTH_CHECK_CHANNEL } from "../shared/ipc";
import type { MoodleLink } from "../shared/moodle";
import { providerIdSchema, settingsPatchSchema } from "../shared/settings";
import {
  annotationColorSchema,
  annotationSegmentSchema,
  annotationTypeSchema,
  subjectColorSchema,
} from "../shared/workspace";
import { deliverRenderedPage } from "./agent/render";
import { startTurn, stopTurn } from "./agent/turns";
import { setLiveContext } from "./context";
import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from "./workspace/annotations";
import {
  listNoteRevisions,
  readNoteRevision,
  restoreNoteRevision,
  saveNoteWithHistory,
} from "./workspace/history";
import {
  createConversation,
  deleteConversation,
  listConversations,
  readConversation,
  updateConversation,
} from "./conversations/store";
import { checkHealth } from "./health";
import { handle, id, title } from "./ipc";
import { MoodleError, userCourses } from "./moodle/client";
import {
  connectMoodle,
  disconnectMoodle,
  moodleSession,
  moodleStatus,
  moodleUserId,
} from "./moodle/credentials";
import {
  downloadItems,
  listActivities,
  listItems,
  refreshActivities,
} from "./moodle/sync";
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
import { workspaceLinks } from "./workspace/links";
import { searchWorkspace } from "./workspace/search";
import { listTrash, restoreFromTrash } from "./workspace/trash";
import {
  createFolder,
  createNote,
  createSubject,
  createWorkspace,
  deleteFolder,
  deleteResource,
  deleteSubject,
  importFile,
  linkSubject,
  moveResource,
  openWorkspace,
  readNote,
  readResourceBytes,
  renameResource,
  resourceInfo,
  resourcePath,
  snapshot,
  updateFolder,
  updateSubject,
} from "./workspace/workspace";

const path = z.string().min(1).max(4096);
const folderPath = z.string().trim().min(1).max(200);
/** A folder to put something in. Empty means the top of the subject. */
const parentFolder = z.string().trim().max(200);
const courseId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const MAX_LAYOUT_BYTES = 256 * 1024;
const MAX_NOTE_BYTES = 20 * 1024 * 1024;
/** A drawn page arrives base64 encoded, so it is larger than the image. */
const MAX_PAGE_IMAGE_BYTES = 12 * 1024 * 1024;
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

/** Looks a course up among the student's enrolments before linking to it. */
async function moodleLink(course: number): Promise<MoodleLink> {
  const session = await moodleSession();
  const courses = await userCourses(session, await moodleUserId());
  const found = courses.find((entry) => entry.id === course);
  if (!found)
    throw new MoodleError("That course is not one of your Moodle enrolments.");
  return {
    siteUrl: session.siteUrl,
    courseId: found.id,
    shortname: found.shortname,
    fullname: found.fullname,
  };
}

export function registerHandlers(
  window: () => BrowserWindow | null,
  onConfirmClose: () => void,
): void {
  handle(HEALTH_CHECK_CHANNEL, z.tuple([]), () => checkHealth());

  handle(CHANNELS.getAppState, z.tuple([]), async () => {
    const reopenError = await reopenLastWorkspace();
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
    z.tuple([
      z.object({
        name: title,
        color: subjectColorSchema,
        moodleCourseId: courseId.optional(),
      }),
    ]),
    async ({ moodleCourseId, ...input }) =>
      createSubject(currentWorkspace(), {
        ...input,
        ...(moodleCourseId ? { moodle: await moodleLink(moodleCourseId) } : {}),
      }),
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
    CHANNELS.createFolder,
    z.tuple([
      z.object({ subjectId: id, name: title, parent: folderPath.optional() }),
    ]),
    (input) => createFolder(currentWorkspace(), input),
  );

  handle(
    CHANNELS.updateFolder,
    z.tuple([
      z.object({
        subjectId: id,
        path: folderPath,
        name: title.optional(),
        parent: parentFolder.optional(),
      }),
    ]),
    async (input) => {
      const workspace = currentWorkspace();
      const folder = await updateFolder(workspace, input);
      return { folder, snapshot: snapshot(workspace) };
    },
  );

  handle(
    CHANNELS.deleteFolder,
    z.tuple([z.object({ subjectId: id, path: folderPath })]),
    async (input) => {
      const workspace = currentWorkspace();
      await deleteFolder(workspace, input);
      return snapshot(workspace);
    },
  );

  handle(
    CHANNELS.createNote,
    z.tuple([
      z.object({ subjectId: id, title, folder: folderPath.optional() }),
    ]),
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
    (input) => saveNoteWithHistory(currentWorkspace(), input, "edit"),
  );

  handle(CHANNELS.listNoteRevisions, z.tuple([id]), (noteId) =>
    listNoteRevisions(currentWorkspace(), noteId),
  );

  handle(
    CHANNELS.readNoteRevision,
    z.tuple([z.object({ noteId: id, revisionId: z.string().max(200) })]),
    (input) =>
      readNoteRevision(currentWorkspace(), input.noteId, input.revisionId),
  );

  handle(
    CHANNELS.restoreNoteRevision,
    z.tuple([z.object({ noteId: id, revisionId: z.string().max(200) })]),
    async (input) => {
      const workspace = currentWorkspace();
      const restored = await restoreNoteRevision(
        workspace,
        input.noteId,
        input.revisionId,
      );
      emitEvent({ type: "workspace-changed", snapshot: snapshot(workspace) });
      return { resource: resourceInfo(workspace, input.noteId), ...restored };
    },
  );

  handle(CHANNELS.renameResource, z.tuple([z.object({ id, title })]), (input) =>
    renameResource(currentWorkspace(), input),
  );

  handle(
    CHANNELS.moveResource,
    z.tuple([
      z.object({
        id,
        subjectId: id,
        folder: folderPath.optional(),
      }),
    ]),
    (input) => moveResource(currentWorkspace(), input),
  );

  handle(CHANNELS.deleteResource, z.tuple([id]), async (resourceId) => {
    const workspace = currentWorkspace();
    await deleteResource(workspace, resourceId);
    return snapshot(workspace);
  });

  handle(
    CHANNELS.importFiles,
    z.tuple([id, folderPath.optional()]),
    async (subjectId, intoFolder) => {
      const workspace = currentWorkspace();
      const owner = window();
      const options: Electron.OpenDialogOptions = {
        title: "Import files",
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "Documents, notes, and images",
            extensions: [
              "pdf",
              "md",
              "png",
              "jpg",
              "jpeg",
              "gif",
              "webp",
              "svg",
            ],
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
        imported.push(
          await importFile(workspace, {
            subjectId,
            sourcePath,
            ...(intoFolder ? { folder: intoFolder } : {}),
          }),
        );
      return imported;
    },
  );

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

  handle(CHANNELS.listLinks, z.tuple([]), () =>
    workspaceLinks(currentWorkspace()),
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

  handle(CHANNELS.getMoodleStatus, z.tuple([z.boolean()]), (refresh) =>
    moodleStatus(refresh),
  );

  handle(
    CHANNELS.connectMoodle,
    z.tuple([
      z.object({
        siteUrl: z.string().trim().min(1).max(2048),
        username: z.string().trim().min(1).max(200),
        password: z.string().min(1).max(500),
      }),
    ]),
    (input) => connectMoodle(input),
  );

  handle(CHANNELS.disconnectMoodle, z.tuple([]), () => disconnectMoodle());

  handle(CHANNELS.listMoodleCourses, z.tuple([]), async () =>
    userCourses(await moodleSession(), await moodleUserId()),
  );

  handle(
    CHANNELS.setMoodleCourse,
    z.tuple([
      z.object({ subjectId: id, courseId: z.number().int().nonnegative() }),
    ]),
    async (input) => {
      const workspace = currentWorkspace();
      const subject = await linkSubject(workspace, {
        subjectId: input.subjectId,
        link: input.courseId ? await moodleLink(input.courseId) : null,
      });
      emitEvent({ type: "workspace-changed", snapshot: snapshot(workspace) });
      return subject;
    },
  );

  handle(CHANNELS.listMoodleItems, z.tuple([id]), async (subjectId) => {
    const contents = await listItems(
      currentWorkspace(),
      await moodleSession(),
      subjectId,
    );
    emitEvent({ type: "moodle-activities-changed" });
    return contents;
  });

  handle(
    CHANNELS.downloadMoodleItems,
    z.tuple([
      z.object({
        subjectId: id,
        keys: z.array(z.string().max(500)).min(1).max(500),
      }),
    ]),
    async (input) => {
      const workspace = currentWorkspace();
      const result = await downloadItems(workspace, await moodleSession(), {
        subjectId: input.subjectId,
        keys: input.keys,
        onProgress: ({ filename, done, total }) =>
          emitEvent({
            type: "moodle-progress",
            subjectId: input.subjectId,
            filename,
            done,
            total,
          }),
      });
      emitEvent({ type: "workspace-changed", snapshot: snapshot(workspace) });
      emitEvent({ type: "moodle-activities-changed" });
      return result;
    },
  );

  handle(CHANNELS.listMoodleActivities, z.tuple([]), () =>
    listActivities(currentWorkspace()),
  );

  handle(CHANNELS.refreshMoodleActivities, z.tuple([]), async () => {
    const failures = await refreshActivities(
      currentWorkspace(),
      await moodleSession(),
    );
    emitEvent({ type: "moodle-activities-changed" });
    return failures;
  });

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
      z.object({ id, title: title.optional(), scope: scopeSchema.optional() }),
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

  handle(CHANNELS.updateLiveContext, z.tuple([liveContextSchema]), (context) =>
    setLiveContext(context),
  );

  handle(
    CHANNELS.deliverRenderedPage,
    z.tuple([
      z.object({
        requestId: z.string().max(200),
        page: z
          .object({
            data: z.string().max(MAX_PAGE_IMAGE_BYTES),
            mimeType: z.enum(["image/png", "image/jpeg"]),
            width: z.number().int().positive().max(20_000),
            height: z.number().int().positive().max(20_000),
          })
          .optional(),
        error: z.string().max(500).optional(),
      }),
    ]),
    (result) => deliverRenderedPage(result),
  );

  handle(CHANNELS.confirmClose, z.tuple([]), () => onConfirmClose());
}
