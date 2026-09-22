import { writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { app, dialog, nativeTheme, shell, type BrowserWindow } from "electron";
import { z } from "zod";

import { liveContextSchema } from "../shared/context";
import { scopeSchema, turnContextSchema } from "../shared/conversations";
import { CHANNELS, HEALTH_CHECK_CHANNEL } from "../shared/ipc";
import { detailSchema, topicLevelSchema } from "../shared/learner";
import type { MoodleLink } from "../shared/moodle";
import {
  availabilitySchema,
  dateSchema,
  SESSION_STATUS_VALUES,
  sessionKindSchema,
  sessionTargetSchema,
  timeSchema,
} from "../shared/planning";
import {
  CARD_ACTION_VALUES,
  cardKindSchema,
  outcomeSchema,
  practiceSourceSchema,
  questionKindSchema,
  ratingSchema,
} from "../shared/practice";
import {
  providerIdSchema,
  resolveLocale,
  settingsPatchSchema,
} from "../shared/settings";
import {
  annotationColorSchema,
  annotationSegmentSchema,
  annotationTypeSchema,
  projectActivitySchema,
  projectDueSchema,
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
  discardDraft,
  keepDraft,
  readDraft,
  restoreDraft,
} from "./workspace/drafts";
import {
  listFileRevisions,
  listNoteRevisions,
  readNoteRevision,
  restoreFileRevision,
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
import { setLocale } from "./i18n";
import { handle, id, title } from "./ipc";
import { MoodleError, userCourses } from "./moodle/client";
import {
  connectMoodle,
  disconnectMoodle,
  moodleSession,
  moodleStatus,
  moodleUserId,
} from "./moodle/credentials";
import { readMedia } from "./moodle/media";
import { officeContent } from "./workspace/text";
import { answerApproval, openApprovals } from "./agent/approvals";
import {
  downloadItems,
  listActivities,
  listItems,
  refreshActivities,
} from "./moodle/sync";
import {
  appState,
  closeCurrentWorkspace,
  createAndOpen,
  currentWorkspace,
  emitEvent,
  hasWorkspace,
  openFolder,
  reopenLastWorkspace,
  saveLayout,
} from "./session";
import {
  changeCards,
  createCards,
  deleteQuiz,
  listPractice,
  markResponse,
  rateCard,
  readQuiz,
  reviewQueue,
  saveQuiz,
  saveResponses,
  setNewCardsPerDay,
  startAttempt,
  submitAttempt,
  undoReview,
  updateCard,
} from "./practice/store";
import {
  deleteTopic,
  learnerProfile,
  resolveTopicProposal,
  saveTopic,
  setPersonalization,
  updatePreferences,
} from "./learner/store";
import { calendarFile } from "./planning/ics";
import { refreshReminders } from "./planning/reminders";
import {
  deleteAssessment,
  deleteSession,
  readPlan,
  resolveProposals,
  saveAssessment,
  saveSession,
  setAvailability,
  setSessionStatus,
} from "./planning/store";
import { claudeModels, claudeStatus } from "./providers/claude";
import { codexModels, codexStatus } from "./providers/codex";
import { loadSettings, updateSettings } from "./settings";
import {
  startTextRecognition,
  stopTextRecognition,
  textRecognitionProgress,
} from "./text-recognition";
import { recognitionState } from "./workspace/ocr";
import { workspaceLinks } from "./workspace/links";
import {
  createProject,
  deleteProject,
  updateProject,
} from "./workspace/projects";
import { exportMarkdown } from "./workspace/markdown-export";
import {
  exportPackage,
  extractPackage,
  readPackage,
} from "./workspace/package";
import { searchWorkspace } from "./workspace/search";
import {
  deleteFromTrash,
  emptyTrash,
  listTrash,
  restoreFromTrash,
} from "./workspace/trash";
import {
  createFolder,
  createNote,
  createSubject,
  deleteFolder,
  deleteResource,
  deleteSubject,
  importFile,
  linkSubject,
  moveResource,
  readNote,
  readResourceBytes,
  renameResource,
  resourceInfo,
  resourcePath,
  snapshot,
  updateFolder,
  updateSubject,
} from "./workspace/workspace";
import { t } from "./i18n";

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
const MAX_CARD_CHARS = 20_000;
const MAX_ANSWER_CHARS = 50_000;

const topic = z.string().max(100).optional();
const card = {
  kind: cardKindSchema,
  front: z.string().max(MAX_CARD_CHARS),
  back: z.string().max(MAX_CARD_CHARS),
  topic,
  source: practiceSourceSchema.optional(),
};
const question = z.object({
  id: z.string().max(100).optional(),
  kind: questionKindSchema,
  prompt: z.string().max(MAX_CARD_CHARS),
  options: z.array(z.string().max(2000)).max(12).optional(),
  answer: z.string().max(MAX_CARD_CHARS).optional(),
  accept: z.array(z.string().max(2000)).max(20).optional(),
  hint: z.string().max(MAX_CARD_CHARS).optional(),
  solution: z.string().max(MAX_ANSWER_CHARS).optional(),
  topic,
  source: practiceSourceSchema.optional(),
});
const responses = z.record(
  z.string().max(100),
  z.object({
    answer: z.string().max(MAX_ANSWER_CHARS),
    flagged: z.boolean().optional(),
    hintShown: z.boolean().optional(),
  }),
);
const quizRef = { subjectId: id, quizId: id };

const session = {
  title,
  subjectId: id.optional(),
  kind: sessionKindSchema,
  date: dateSchema,
  start: timeSchema,
  end: timeSchema,
  target: sessionTargetSchema.optional(),
  notes: z.string().max(4000).optional(),
};
const assessment = {
  title,
  subjectId: id.optional(),
  date: dateSchema,
  time: timeSchema.optional(),
  notes: z.string().max(4000).optional(),
};

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
  ".py",
  ".pyw",
  ".vbs",
  ".scr",
  ".lnk",
  ".jar",
  ".command",
  ".url",
  ".desktop",
  ".appimage",
]);

/** A name for a file the save dialog suggests, without characters it refuses. */
function fileName(name: string, fallback: string): string {
  return name.replace(/[<>:"/\\|?*]/g, " ").trim() || fallback;
}

/** The export or extraction running now. There is one at a time. */
let packageJob: AbortController | null = null;
/** Archives the student picked, the only ones that may be extracted. */
const chosenArchives = new Set<string>();

async function packageTask<T>(
  run: (
    signal: AbortSignal,
    onProgress: (done: number, total: number) => void,
  ) => Promise<T>,
): Promise<T> {
  if (packageJob)
    throw new Error(t("An export or an archive is being written already."));
  const controller = new AbortController();
  packageJob = controller;
  let last = 0;
  try {
    return await run(controller.signal, (done, total) => {
      // Progress arrives per chunk; the window needs far fewer updates.
      if (done < total && Date.now() - last < 100) return;
      last = Date.now();
      emitEvent({ type: "package-progress", done, total });
    });
  } finally {
    packageJob = null;
  }
}

/** Looks a course up among the student's enrolments before linking to it. */
async function moodleLink(course: number): Promise<MoodleLink> {
  const session = await moodleSession();
  const courses = await userCourses(session, await moodleUserId());
  const found = courses.find((entry) => entry.id === course);
  if (!found)
    throw new MoodleError(
      t("That course is not one of your Moodle enrolments."),
    );
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
    const reopened = await reopenLastWorkspace();
    return appState({
      reopenError: reopened.error,
      // Opened anyway since.
      locked: hasWorkspace() ? undefined : reopened.locked,
    });
  });

  handle(
    CHANNELS.updateSettings,
    z.tuple([settingsPatchSchema]),
    async (patch) => {
      const settings = await updateSettings(patch);
      nativeTheme.themeSource = settings.theme;
      setLocale(resolveLocale(settings.language, app.getLocale()));
      if (patch.reminders) void refreshReminders();
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
      await createAndOpen(input);
      return appState();
    },
  );

  handle(
    CHANNELS.openWorkspace,
    z.tuple([path, z.boolean().optional()]),
    async (folder, force) =>
      appState({ locked: await openFolder(folder, force) }),
  );

  handle(CHANNELS.closeWorkspace, z.tuple([]), async () => {
    await closeCurrentWorkspace();
    return appState();
  });

  handle(
    CHANNELS.exportWorkspace,
    z.tuple([
      z.object({
        conversations: z.boolean(),
        learner: z.boolean(),
        history: z.boolean(),
        trash: z.boolean(),
      }),
    ]),
    async (options) => {
      const workspace = currentWorkspace();
      const owner = window();
      const dialogOptions: Electron.SaveDialogOptions = {
        title: t("Export the workspace"),
        defaultPath: `${fileName(workspace.file.name, t("Workspace"))}.resit`,
        filters: [{ name: t("resit workspace"), extensions: ["resit"] }],
      };
      const result = owner
        ? await dialog.showSaveDialog(owner, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      const destination = result.filePath;
      if (result.canceled || !destination) return null;
      await packageTask((signal, onProgress) =>
        exportPackage(workspace, { destination, options, signal, onProgress }),
      );
      return destination;
    },
  );

  handle(CHANNELS.chooseArchive, z.tuple([]), async () => {
    const owner = window();
    const options: Electron.OpenDialogOptions = {
      title: t("Open a .resit archive"),
      properties: ["openFile"],
      filters: [
        { name: t("resit workspace"), extensions: ["resit"] },
        { name: t("All files"), extensions: ["*"] },
      ],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    const archive = result.filePaths[0];
    if (result.canceled || !archive) return null;
    const summary = await readPackage(archive);
    chosenArchives.add(archive);
    return { path: archive, summary };
  });

  handle(CHANNELS.openArchive, z.tuple([path]), async (archive) => {
    if (!chosenArchives.has(archive))
      throw new Error(t("Choose the archive again."));
    const owner = window();
    const options: Electron.OpenDialogOptions = {
      title: t("Choose where to put the workspace"),
      properties: ["openDirectory", "createDirectory"],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    const parent = result.filePaths[0];
    if (result.canceled || !parent) return null;
    const root = await packageTask((signal, onProgress) =>
      extractPackage(archive, parent, { signal, onProgress }),
    );
    chosenArchives.delete(archive);
    return appState({ locked: await openFolder(root) });
  });

  handle(CHANNELS.stopPackage, z.tuple([]), () => {
    packageJob?.abort(new Error(t("Stopped before it finished.")));
  });

  handle(
    CHANNELS.exportMarkdown,
    z.tuple([z.union([z.object({ subjectId: id }), z.object({ noteId: id })])]),
    async (input) => {
      const workspace = currentWorkspace();
      const notes =
        "subjectId" in input
          ? snapshot(workspace).resources.filter(
              (resource) =>
                resource.subjectId === input.subjectId &&
                resource.kind === "note",
            )
          : [resourceInfo(workspace, input.noteId)];
      const name =
        "subjectId" in input
          ? (workspace.subjects.get(input.subjectId)?.info.name ?? t("Notes"))
          : (notes[0]?.title ?? t("Note"));
      const owner = window();
      const options: Electron.OpenDialogOptions = {
        title: t("Choose where to save the Markdown files"),
        properties: ["openDirectory", "createDirectory"],
      };
      const result = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options);
      const parent = result.filePaths[0];
      if (result.canceled || !parent) return null;
      return exportMarkdown(workspace, { notes, parent, name });
    },
  );

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

  const projectContents = {
    subjectIds: z.array(id).max(100),
    resourceIds: z.array(id).max(2000),
    due: projectDueSchema.nullable().optional(),
    activity: projectActivitySchema.nullable().optional(),
  };

  handle(
    CHANNELS.createProject,
    z.tuple([z.object({ title, ...projectContents })]),
    (input) => createProject(currentWorkspace(), input),
  );

  handle(
    CHANNELS.updateProject,
    z.tuple([
      z.object({
        id,
        title: title.optional(),
        subjectIds: projectContents.subjectIds.optional(),
        resourceIds: projectContents.resourceIds.optional(),
        due: projectContents.due,
        activity: projectContents.activity,
      }),
    ]),
    (input) => updateProject(currentWorkspace(), input),
  );

  handle(CHANNELS.deleteProject, z.tuple([id]), async (projectId) => {
    const workspace = currentWorkspace();
    await deleteProject(workspace, projectId);
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
    async (input) => {
      const workspace = currentWorkspace();
      let result;
      try {
        result = await saveNoteWithHistory(workspace, input, "edit");
      } catch (error) {
        await keepDraft(workspace, input).catch(() => undefined);
        throw error;
      }
      if (result.status === "saved")
        await discardDraft(workspace, input.id).catch(() => undefined);
      else await keepDraft(workspace, input).catch(() => undefined);
      return result;
    },
  );

  handle(CHANNELS.readDraft, z.tuple([id]), async (noteId) => {
    const workspace = currentWorkspace();
    const draft = await readDraft(workspace, noteId);
    if (!draft) return null;
    // Saved since, by another route.
    if (draft.body === (await readNote(workspace, noteId)).body) {
      await discardDraft(workspace, noteId);
      return null;
    }
    return draft;
  });

  handle(
    CHANNELS.keepDraft,
    z.tuple([
      z.object({
        id,
        body: z.string().max(MAX_NOTE_BYTES),
        expectedRevision: z.string().max(200),
      }),
    ]),
    (input) => keepDraft(currentWorkspace(), input),
  );

  handle(CHANNELS.discardDraft, z.tuple([id]), (noteId) =>
    discardDraft(currentWorkspace(), noteId),
  );

  handle(CHANNELS.restoreDraft, z.tuple([id]), async (noteId) => {
    const workspace = currentWorkspace();
    const restored = await restoreDraft(workspace, noteId);
    emitEvent({ type: "workspace-changed", snapshot: snapshot(workspace) });
    return restored;
  });

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

  handle(CHANNELS.listFileRevisions, z.tuple([id]), (resourceId) =>
    listFileRevisions(currentWorkspace(), resourceId),
  );

  handle(
    CHANNELS.restoreFileRevision,
    z.tuple([z.object({ resourceId: id, revisionId: z.string().max(200) })]),
    async (input) => {
      const workspace = currentWorkspace();
      const resource = await restoreFileRevision(
        workspace,
        input.resourceId,
        input.revisionId,
      );
      emitEvent({ type: "workspace-changed", snapshot: snapshot(workspace) });
      return resource;
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
        title: t("Import files"),
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: t("Documents, notes, and images"),
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
          { name: t("All files"), extensions: ["*"] },
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

  handle(CHANNELS.deleteFromTrash, z.tuple([id]), (entryId) =>
    deleteFromTrash(currentWorkspace(), entryId),
  );

  handle(CHANNELS.emptyTrash, z.tuple([]), () =>
    emptyTrash(currentWorkspace()),
  );

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

  handle(CHANNELS.getTextRecognition, z.tuple([id]), async (resourceId) => {
    const state = await recognitionState(currentWorkspace(), resourceId);
    return {
      pageCount: state.pageCount,
      waiting: state.waiting.length,
      recognized: state.recognized,
      running: textRecognitionProgress(resourceId),
    };
  });

  handle(CHANNELS.recognizeText, z.tuple([id]), (resourceId) => {
    const workspace = currentWorkspace();
    return startTextRecognition(workspace, resourceId, {
      emit: emitEvent,
      stillOpen: () => hasWorkspace() && currentWorkspace() === workspace,
    });
  });

  handle(CHANNELS.stopTextRecognition, z.tuple([]), () =>
    stopTextRecognition(),
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

  /** Runs a practice change, then tells the window the subject changed. */
  const practice =
    <Input extends { subjectId: string }, Result>(
      run: (input: Input) => Promise<Result>,
    ) =>
    async (input: Input) => {
      const result = await run(input);
      emitEvent({ type: "practice-changed", subjectId: input.subjectId });
      return result;
    };

  handle(CHANNELS.listPractice, z.tuple([]), () =>
    listPractice(currentWorkspace()),
  );

  handle(
    CHANNELS.setNewCardsPerDay,
    z.tuple([z.number().int().min(0).max(1000)]),
    (value) => setNewCardsPerDay(currentWorkspace(), value),
  );

  handle(
    CHANNELS.getReviewQueue,
    z.tuple([z.object({ subjectId: id.optional(), topic })]),
    (filter) => reviewQueue(currentWorkspace(), filter),
  );

  handle(
    CHANNELS.rateCard,
    z.tuple([
      z.object({
        subjectId: id,
        cardId: id,
        rating: ratingSchema,
        durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
      }),
    ]),
    practice((input) => rateCard(currentWorkspace(), input)),
  );

  handle(
    CHANNELS.undoReview,
    z.tuple([z.object({ subjectId: id, reviewId: id })]),
    practice((input) =>
      undoReview(currentWorkspace(), input.subjectId, input.reviewId),
    ),
  );

  handle(
    CHANNELS.createCard,
    z.tuple([z.object({ subjectId: id, ...card })]),
    practice(async ({ subjectId, ...input }) => {
      const [created] = await createCards(currentWorkspace(), subjectId, [
        input,
      ]);
      if (!created) throw new Error(t("The card was not created."));
      return created;
    }),
  );

  handle(
    CHANNELS.updateCard,
    z.tuple([z.object({ subjectId: id, id, ...card })]),
    practice(({ subjectId, id: cardId, ...input }) =>
      updateCard(currentWorkspace(), subjectId, cardId, input),
    ),
  );

  handle(
    CHANNELS.changeCards,
    z.tuple([
      z.object({
        subjectId: id,
        ids: z.array(id).min(1).max(20_000),
        action: z.enum(CARD_ACTION_VALUES),
      }),
    ]),
    practice((input) =>
      changeCards(currentWorkspace(), input.subjectId, input.ids, input.action),
    ),
  );

  handle(CHANNELS.readQuiz, z.tuple([z.object(quizRef)]), (input) =>
    readQuiz(currentWorkspace(), input.subjectId, input.quizId),
  );

  handle(
    CHANNELS.saveQuiz,
    z.tuple([
      z.object({
        subjectId: id,
        id: id.optional(),
        title,
        topic,
        questions: z.array(question).min(1).max(100),
      }),
    ]),
    practice(({ subjectId, ...input }) =>
      saveQuiz(currentWorkspace(), subjectId, input),
    ),
  );

  handle(
    CHANNELS.deleteQuiz,
    z.tuple([z.object(quizRef)]),
    practice((input) =>
      deleteQuiz(currentWorkspace(), input.subjectId, input.quizId),
    ),
  );

  handle(
    CHANNELS.startAttempt,
    z.tuple([z.object(quizRef)]),
    practice((input) =>
      startAttempt(currentWorkspace(), input.subjectId, input.quizId),
    ),
  );

  handle(
    CHANNELS.saveResponses,
    z.tuple([z.object({ ...quizRef, attemptId: id, responses })]),
    (input) =>
      saveResponses(
        currentWorkspace(),
        input.subjectId,
        input.quizId,
        input.attemptId,
        input.responses,
      ),
  );

  handle(
    CHANNELS.submitAttempt,
    z.tuple([z.object({ ...quizRef, attemptId: id, responses })]),
    practice((input) =>
      submitAttempt(
        currentWorkspace(),
        input.subjectId,
        input.quizId,
        input.attemptId,
        input.responses,
      ),
    ),
  );

  handle(
    CHANNELS.markResponse,
    z.tuple([
      z.object({
        ...quizRef,
        attemptId: id,
        questionId: id,
        outcome: outcomeSchema,
      }),
    ]),
    practice(({ subjectId, quizId, ...input }) =>
      markResponse(currentWorkspace(), subjectId, quizId, input),
    ),
  );

  /** Runs a plan change, then updates reminders and tells the window. */
  const plan =
    <Args extends unknown[], Result>(run: (...args: Args) => Promise<Result>) =>
    async (...args: Args) => {
      const result = await run(...args);
      emitEvent({ type: "plan-changed" });
      void refreshReminders();
      return result;
    };

  handle(CHANNELS.getPlan, z.tuple([]), () => readPlan(currentWorkspace()));

  handle(
    CHANNELS.saveSession,
    z.tuple([z.object({ id: id.optional(), ...session })]),
    plan((input) => saveSession(currentWorkspace(), input)),
  );

  handle(
    CHANNELS.deleteSession,
    z.tuple([id]),
    plan((sessionId) => deleteSession(currentWorkspace(), sessionId)),
  );

  handle(
    CHANNELS.setSessionStatus,
    z.tuple([z.object({ id, status: z.enum(SESSION_STATUS_VALUES) })]),
    plan((input) =>
      setSessionStatus(currentWorkspace(), input.id, input.status),
    ),
  );

  handle(
    CHANNELS.resolveProposals,
    z.tuple([
      z.object({ ids: z.array(id).min(1).max(500), accept: z.boolean() }),
    ]),
    plan((input) =>
      resolveProposals(currentWorkspace(), input.ids, input.accept),
    ),
  );

  handle(
    CHANNELS.saveAssessment,
    z.tuple([z.object({ id: id.optional(), ...assessment })]),
    plan((input) => saveAssessment(currentWorkspace(), input)),
  );

  handle(
    CHANNELS.deleteAssessment,
    z.tuple([id]),
    plan((assessmentId) => deleteAssessment(currentWorkspace(), assessmentId)),
  );

  handle(
    CHANNELS.setAvailability,
    z.tuple([z.array(availabilitySchema).max(100)]),
    plan((slots) => setAvailability(currentWorkspace(), slots)),
  );

  handle(CHANNELS.exportCalendar, z.tuple([]), async () => {
    const workspace = currentWorkspace();
    const owner = window();
    const options: Electron.SaveDialogOptions = {
      title: t("Export the study plan"),
      defaultPath: `${workspace.file.name.replace(/[<>:"/\\|?*]/g, " ").trim() || t("Study plan")}.ics`,
      filters: [{ name: t("Calendar"), extensions: ["ics"] }],
    };
    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    const names = new Map(
      [...workspace.subjects.values()].map((entry) => [
        entry.info.id,
        entry.info.name,
      ]),
    );
    await writeFile(
      result.filePath,
      calendarFile(await readPlan(workspace), names),
      "utf8",
    );
    return result.filePath;
  });

  /** Runs a profile change, then tells the window. */
  const learner =
    <Args extends unknown[], Result>(run: (...args: Args) => Promise<Result>) =>
    async (...args: Args) => {
      const result = await run(...args);
      emitEvent({ type: "learner-changed" });
      return result;
    };

  handle(CHANNELS.getLearnerProfile, z.tuple([]), () =>
    learnerProfile(currentWorkspace()),
  );

  handle(
    CHANNELS.setPersonalization,
    z.tuple([z.boolean()]),
    learner((on) => setPersonalization(currentWorkspace(), on)),
  );

  handle(
    CHANNELS.updatePreferences,
    z.tuple([
      z.object({
        detail: detailSchema.optional(),
        hintsFirst: z.boolean().optional(),
        about: z.string().max(2000).optional(),
        goals: z.string().max(2000).optional(),
      }),
    ]),
    learner((patch) => updatePreferences(currentWorkspace(), patch)),
  );

  handle(
    CHANNELS.saveTopic,
    z.tuple([
      z.object({
        id: id.optional(),
        name: title,
        subjectId: id.optional(),
        level: topicLevelSchema,
        note: z.string().max(2000).optional(),
      }),
    ]),
    learner((input) => saveTopic(currentWorkspace(), input)),
  );

  handle(
    CHANNELS.deleteTopic,
    z.tuple([id]),
    learner((topicId) => deleteTopic(currentWorkspace(), topicId)),
  );

  handle(
    CHANNELS.resolveTopicProposal,
    z.tuple([
      z.object({
        id,
        accept: z.boolean(),
        level: topicLevelSchema.optional(),
      }),
    ]),
    learner((input) => resolveTopicProposal(currentWorkspace(), input)),
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

  handle(CHANNELS.readMoodleMedia, z.tuple([z.string().max(100)]), (name) =>
    readMedia(currentWorkspace(), name),
  );

  handle(CHANNELS.readOfficeContent, z.tuple([id]), (resourceId) =>
    officeContent(currentWorkspace(), resourceId),
  );

  handle(
    CHANNELS.answerApproval,
    z.tuple([
      z.object({
        id: z.string().max(100),
        approved: z.boolean(),
        always: z.boolean().optional(),
      }),
    ]),
    ({ id, approved, always }) => answerApproval(id, approved, always),
  );

  handle(CHANNELS.listApprovals, z.tuple([id]), (conversationId) =>
    openApprovals(conversationId),
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
