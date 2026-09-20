import type {
  ConversationDetail,
  ConversationMeta,
  ConversationScope,
  ModelOption,
  ProviderState,
  TurnContext,
  TurnEvent,
} from "./conversations";
import type { AppSettings, SettingsPatch } from "./settings";
import type {
  Annotation,
  AnnotationColorValue,
  AnnotationSegment,
  AnnotationType,
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

export type DesktopEvent =
  | { type: "workspace-changed"; snapshot: WorkspaceSnapshot }
  /** The window is closing: save pending edits, then call confirmClose. */
  | { type: "before-close" }
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
  }): Promise<SubjectInfo>;
  updateSubject(input: {
    id: string;
    name?: string;
    color?: SubjectColorValue;
    sortOrder?: number;
  }): Promise<WorkspaceSnapshot>;
  deleteSubject(id: string): Promise<WorkspaceSnapshot>;

  createNote(input: {
    subjectId: string;
    title: string;
  }): Promise<ResourceInfo>;
  readNote(id: string): Promise<NoteDocument>;
  saveNote(input: {
    id: string;
    body: string;
    expectedRevision: string;
  }): Promise<SaveNoteResult>;
  renameResource(input: { id: string; title: string }): Promise<ResourceInfo>;
  deleteResource(id: string): Promise<WorkspaceSnapshot>;
  listTrash(): Promise<TrashEntry[]>;
  /** Moves a deleted item back where it came from. */
  restoreFromTrash(id: string): Promise<WorkspaceSnapshot>;
  importFiles(subjectId: string): Promise<ResourceInfo[]>;

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

  getProviderStatus(refresh: boolean): Promise<ProviderState>;
  /** Models the installed Claude Code offers. Empty when it is not ready. */
  getModels(): Promise<ModelOption[]>;
  listConversations(): Promise<ConversationMeta[]>;
  createConversation(scope: ConversationScope): Promise<ConversationMeta>;
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
  createNote: "resit:note-create",
  readNote: "resit:note-read",
  saveNote: "resit:note-save",
  renameResource: "resit:resource-rename",
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
  getProviderStatus: "resit:provider-status",
  getModels: "resit:provider-models",
  listConversations: "resit:conversation-list",
  createConversation: "resit:conversation-create",
  readConversation: "resit:conversation-read",
  updateConversation: "resit:conversation-update",
  deleteConversation: "resit:conversation-delete",
  sendMessage: "resit:turn-send",
  stopTurn: "resit:turn-stop",
  confirmClose: "resit:confirm-close",
} as const satisfies Record<
  Exclude<keyof DesktopApi, "healthCheck" | "onEvent">,
  string
>;
