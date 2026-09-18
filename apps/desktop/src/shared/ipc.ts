import type { AppSettings, SettingsPatch } from "./settings";
import type {
  RecentWorkspace,
  ResourceInfo,
  SaveNoteResult,
  SubjectColorValue,
  SubjectInfo,
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

export type DesktopEvent = {
  type: "workspace-changed";
  snapshot: WorkspaceSnapshot;
};

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
  importFiles(subjectId: string): Promise<ResourceInfo[]>;
  readResourceBytes(id: string): Promise<Uint8Array>;
  openResourceExternally(id: string): Promise<void>;

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
  importFiles: "resit:resource-import",
  readResourceBytes: "resit:resource-bytes",
  openResourceExternally: "resit:resource-open-external",
} as const satisfies Record<
  Exclude<keyof DesktopApi, "healthCheck" | "onEvent">,
  string
>;
