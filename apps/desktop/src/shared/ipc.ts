import type { LiveContext } from "./context";
import type {
  ConversationDetail,
  ConversationMeta,
  ConversationScope,
  ModelOption,
  ProviderState,
  TurnContext,
  TurnEvent,
} from "./conversations";
import type {
  MoodleConnection,
  MoodleCourse,
  MoodleCourseContents,
  MoodleDownloadResult,
} from "./moodle";
import type { AppSettings, ProviderId, SettingsPatch } from "./settings";
import type {
  Annotation,
  AnnotationColorValue,
  AnnotationSegment,
  AnnotationType,
  FolderInfo,
  NoteRevision,
  NoteRevisionContent,
  RecentWorkspace,
  ResourceInfo,
  SaveNoteResult,
  SubjectColorValue,
  SubjectInfo,
  TrashEntry,
  WorkspaceSnapshot,
} from "./workspace";

export const HEALTH_CHECK_CHANNEL = "resit:health-check";
export const EVENT_CHANNEL = "resit:event";

export interface HealthCheckResult {
  status: "ok";
}

export interface AppState {
  settings: AppSettings;
  recent: RecentWorkspace[];
  /** The stored Moodle account, without contacting the site. */
  moodle: MoodleConnection;
  workspace: WorkspaceSnapshot | null;
  /** Saved tabs and panes for the open workspace, validated by the renderer. */
  layout: unknown;
  /** Why the last workspace could not be reopened, if it failed. */
  reopenError?: string;
}

export interface NoteDocument {
  resource: ResourceInfo;
  body: string;
  revision: string;
}

/** One PDF page drawn by the window, for an assistant that can see images. */
export interface RenderedPage {
  /** The image itself, base64 encoded. */
  data: string;
  mimeType: string;
  width: number;
  height: number;
}

export type DesktopEvent =
  | { type: "workspace-changed"; snapshot: WorkspaceSnapshot }
  /** The window is closing: save pending edits, then call confirmClose. */
  | { type: "before-close" }
  /** The assistant changed a PDF's highlights. */
  | { type: "annotations-changed"; documentId: string }
  /** The main process needs a PDF page drawn, for the assistant to look at. */
  | {
      type: "render-page";
      requestId: string;
      resourceId: string;
      page: number;
      maxWidth: number;
    }
  | {
      type: "moodle-progress";
      subjectId: string;
      filename: string;
      done: number;
      total: number;
    }
  | TurnEvent;

export interface SearchResult {
  resourceId: string;
  title: string;
  kind: ResourceInfo["kind"];
  subjectId: string;
  page?: number;
  snippet: string;
}

/** Every method the preload exposes. Each maps to one validated IPC channel. */
export interface DesktopApi {
  healthCheck(): Promise<HealthCheckResult>;
  getAppState(): Promise<AppState>;
  updateSettings(patch: SettingsPatch): Promise<AppSettings>;
  chooseFolder(title: string): Promise<string | null>;

  createWorkspace(input: {
    folder: string;
    name: string;
    subject: { name: string; color: SubjectColorValue };
  }): Promise<AppState>;
  openWorkspace(folder: string): Promise<AppState>;
  closeWorkspace(): Promise<AppState>;
  saveLayout(layout: unknown): Promise<void>;

  createSubject(input: {
    name: string;
    color: SubjectColorValue;
    /** Follows this Moodle course from the start. */
    moodleCourseId?: number;
  }): Promise<SubjectInfo>;
  updateSubject(input: {
    id: string;
    name?: string;
    color?: SubjectColorValue;
    sortOrder?: number;
  }): Promise<WorkspaceSnapshot>;
  deleteSubject(id: string): Promise<WorkspaceSnapshot>;

  /** Makes a folder inside a subject, or inside one of its folders. */
  createFolder(input: {
    subjectId: string;
    name: string;
    parent?: string;
  }): Promise<FolderInfo>;
  /**
   * Renames a folder, moves it into another, or both. An empty `parent` moves
   * it to the top of the subject; leaving it out keeps it where it is.
   */
  updateFolder(input: {
    subjectId: string;
    path: string;
    name?: string;
    parent?: string;
  }): Promise<{ folder: FolderInfo; snapshot: WorkspaceSnapshot }>;
  /** Moves a folder and everything in it to the trash. */
  deleteFolder(input: {
    subjectId: string;
    path: string;
  }): Promise<WorkspaceSnapshot>;

  createNote(input: {
    subjectId: string;
    title: string;
    folder?: string;
  }): Promise<ResourceInfo>;
  readNote(id: string): Promise<NoteDocument>;
  saveNote(input: {
    id: string;
    body: string;
    expectedRevision: string;
  }): Promise<SaveNoteResult>;
  /** Kept copies of a note's text, newest first. */
  listNoteRevisions(noteId: string): Promise<NoteRevision[]>;
  readNoteRevision(input: {
    noteId: string;
    revisionId: string;
  }): Promise<NoteRevisionContent>;
  /** Puts an older version back, keeping the text it replaced. */
  restoreNoteRevision(input: {
    noteId: string;
    revisionId: string;
  }): Promise<NoteDocument>;
  renameResource(input: { id: string; title: string }): Promise<ResourceInfo>;
  /** Moves a file to another subject or folder, keeping its ID. */
  moveResource(input: {
    id: string;
    subjectId: string;
    folder?: string;
  }): Promise<ResourceInfo>;
  deleteResource(id: string): Promise<WorkspaceSnapshot>;
  listTrash(): Promise<TrashEntry[]>;
  /** Moves a deleted item back where it came from. */
  restoreFromTrash(id: string): Promise<WorkspaceSnapshot>;
  importFiles(subjectId: string, folder?: string): Promise<ResourceInfo[]>;

  listAnnotations(documentId: string): Promise<Annotation[]>;
  createAnnotation(input: {
    documentId: string;
    type: AnnotationType;
    color: AnnotationColorValue;
    segments: AnnotationSegment[];
    comment?: string;
  }): Promise<Annotation>;
  /** An empty `comment` removes the comment. */
  updateAnnotation(input: {
    documentId: string;
    id: string;
    color?: AnnotationColorValue;
    comment?: string;
  }): Promise<Annotation>;
  deleteAnnotation(input: { documentId: string; id: string }): Promise<void>;

  readResourceBytes(id: string): Promise<Uint8Array>;
  openResourceExternally(id: string): Promise<void>;
  search(query: string): Promise<SearchResult[]>;
  /** Opens an http, https, or mailto link in the system browser. */
  openExternal(url: string): Promise<void>;

  /** `refresh` checks the stored token against the site. */
  getMoodleStatus(refresh: boolean): Promise<MoodleConnection>;
  connectMoodle(input: {
    siteUrl: string;
    username: string;
    password: string;
  }): Promise<MoodleConnection>;
  disconnectMoodle(): Promise<MoodleConnection>;
  listMoodleCourses(): Promise<MoodleCourse[]>;
  /** A `courseId` of 0 stops the subject following a course. */
  setMoodleCourse(input: {
    subjectId: string;
    courseId: number;
  }): Promise<SubjectInfo>;
  listMoodleItems(subjectId: string): Promise<MoodleCourseContents>;
  downloadMoodleItems(input: {
    subjectId: string;
    keys: string[];
  }): Promise<MoodleDownloadResult>;

  getProviderStatus(
    provider: ProviderId,
    refresh: boolean,
  ): Promise<ProviderState>;
  /** Models that provider offers. Empty when it is not ready. */
  getModels(provider: ProviderId): Promise<ModelOption[]>;
  listConversations(): Promise<ConversationMeta[]>;
  /** Without a provider, the one chosen in settings answers. */
  createConversation(
    scope: ConversationScope,
    provider?: ProviderId,
  ): Promise<ConversationMeta>;
  readConversation(id: string): Promise<ConversationDetail>;
  updateConversation(input: {
    id: string;
    title?: string;
    scope?: ConversationScope;
  }): Promise<ConversationMeta>;
  deleteConversation(id: string): Promise<void>;
  sendMessage(input: {
    conversationId: string;
    text: string;
    context: TurnContext;
  }): Promise<{ turnId: string }>;
  stopTurn(conversationId: string): Promise<void>;
  /** Tells the main process which files are open, for the assistant to see. */
  updateLiveContext(context: LiveContext): Promise<void>;
  /** Answers a render-page event with the drawn page, or why it failed. */
  deliverRenderedPage(result: {
    requestId: string;
    page?: RenderedPage;
    error?: string;
  }): Promise<void>;
  confirmClose(): Promise<void>;

  onEvent(listener: (event: DesktopEvent) => void): () => void;
}

export const CHANNELS = {
  getAppState: "resit:app-state",
  updateSettings: "resit:update-settings",
  chooseFolder: "resit:choose-folder",
  createWorkspace: "resit:workspace-create",
  openWorkspace: "resit:workspace-open",
  closeWorkspace: "resit:workspace-close",
  saveLayout: "resit:layout-save",
  createSubject: "resit:subject-create",
  updateSubject: "resit:subject-update",
  deleteSubject: "resit:subject-delete",
  createFolder: "resit:folder-create",
  updateFolder: "resit:folder-update",
  deleteFolder: "resit:folder-delete",
  createNote: "resit:note-create",
  readNote: "resit:note-read",
  saveNote: "resit:note-save",
  listNoteRevisions: "resit:note-history",
  readNoteRevision: "resit:note-revision",
  restoreNoteRevision: "resit:note-restore",
  renameResource: "resit:resource-rename",
  moveResource: "resit:resource-move",
  deleteResource: "resit:resource-delete",
  listTrash: "resit:trash-list",
  restoreFromTrash: "resit:trash-restore",
  importFiles: "resit:resource-import",
  listAnnotations: "resit:annotation-list",
  createAnnotation: "resit:annotation-create",
  updateAnnotation: "resit:annotation-update",
  deleteAnnotation: "resit:annotation-delete",
  readResourceBytes: "resit:resource-bytes",
  openResourceExternally: "resit:resource-open-external",
  search: "resit:search",
  openExternal: "resit:open-external",
  getMoodleStatus: "resit:moodle-status",
  connectMoodle: "resit:moodle-connect",
  disconnectMoodle: "resit:moodle-disconnect",
  listMoodleCourses: "resit:moodle-courses",
  setMoodleCourse: "resit:moodle-set-course",
  listMoodleItems: "resit:moodle-items",
  downloadMoodleItems: "resit:moodle-download",
  getProviderStatus: "resit:provider-status",
  getModels: "resit:provider-models",
  listConversations: "resit:conversation-list",
  createConversation: "resit:conversation-create",
  readConversation: "resit:conversation-read",
  updateConversation: "resit:conversation-update",
  deleteConversation: "resit:conversation-delete",
  sendMessage: "resit:turn-send",
  stopTurn: "resit:turn-stop",
  updateLiveContext: "resit:context-update",
  deliverRenderedPage: "resit:render-page-result",
  confirmClose: "resit:confirm-close",
} as const satisfies Record<
  Exclude<keyof DesktopApi, "healthCheck" | "onEvent">,
  string
>;
