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
  SubjectActivities,
} from "./moodle";
import type {
  Attempt,
  CardAction,
  CardInput,
  Flashcard,
  Outcome,
  PracticeOverview,
  QuestionInput,
  QuizFile,
  Rating,
  Response,
  ReviewItem,
} from "./practice";
import type {
  LearnerProfile,
  Preferences,
  PreferencesPatch,
  Topic,
  TopicInput,
  TopicLevel,
} from "./learner";
import type {
  Assessment,
  AssessmentInput,
  Availability,
  PlanFile,
  SessionInput,
  SessionStatus,
  StudySession,
} from "./planning";
import type { AppSettings, ProviderId, SettingsPatch } from "./settings";
import type {
  Annotation,
  AnnotationColorValue,
  AnnotationSegment,
  AnnotationType,
  FileRevision,
  FolderInfo,
  MarkdownExport,
  NoteDraft,
  NoteRevision,
  NoteRevisionContent,
  PackageOptions,
  ProjectInfo,
  PackageSummary,
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
  /** The computer's language, for when the setting follows it. */
  systemLocale: string;
  recent: RecentWorkspace[];
  /** The stored Moodle account, without contacting the site. */
  moodle: MoodleConnection;
  workspace: WorkspaceSnapshot | null;
  /** Saved tabs and panes for the open workspace, validated by the renderer. */
  layout: unknown;
  /** Why the last workspace could not be reopened, if it failed. */
  reopenError?: string;
  /** A workspace that was not opened because another copy of resit has it. */
  locked?: LockedWorkspace;
}

/** Where a workspace is already open, as its lock file tells it. */
export interface LockedWorkspace {
  path: string;
  /** The other copy runs on this computer. */
  here: boolean;
  host: string;
  since: string;
}

export interface NoteDocument {
  resource: ResourceInfo;
  body: string;
  revision: string;
}

/** Reading the text of a PDF's scanned pages. */
export interface TextRecognitionProgress {
  resourceId: string;
  /** Fetching language data, counted in bytes, then reading pages. */
  phase: "downloading" | "reading";
  done: number;
  total: number;
}

export interface TextRecognition {
  pageCount: number;
  /** Pages with no text that have not been read yet. */
  waiting: number;
  /** Pages whose text was read from the page image. */
  recognized: number;
  running: TextRecognitionProgress | null;
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
  /** A subject's Moodle activities were read again. */
  | { type: "moodle-activities-changed" }
  /** Cards or quizzes changed, in the window or through the assistant. */
  | { type: "practice-changed"; subjectId: string }
  /** The study plan changed, in the window or through the assistant. */
  | { type: "plan-changed" }
  /** The student clicked a session reminder. */
  | { type: "show-schedule" }
  /** The learner profile changed, in the window or through the assistant. */
  | { type: "learner-changed" }
  /** Bytes written by an export, or extracted from an archive. */
  | { type: "package-progress"; done: number; total: number }
  | ({ type: "ocr-progress" } & TextRecognitionProgress)
  | {
      type: "ocr-finished";
      resourceId: string;
      status: "done" | "cancelled" | "failed";
      /** Pages read before it finished or stopped. */
      recognized: number;
      message?: string;
    }
  | {
      type: "moodle-progress";
      subjectId: string;
      filename: string;
      done: number;
      total: number;
    }
  | TurnEvent;

/** One note's links to another note or document, and how many there are. */
export interface ResourceLink {
  from: string;
  to: string;
  count: number;
}

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
  /**
   * Leaves the open workspace as it is when another copy of resit has the
   * folder open, and says so in `locked`. `force` opens it anyway.
   */
  openWorkspace(folder: string, force?: boolean): Promise<AppState>;
  closeWorkspace(): Promise<AppState>;
  /** Saves the workspace as a .resit archive. Null if no file was chosen. */
  exportWorkspace(options: PackageOptions): Promise<string | null>;
  /** Picks a .resit archive and reads what it holds. */
  chooseArchive(): Promise<{ path: string; summary: PackageSummary } | null>;
  /**
   * Extracts the chosen archive into a new folder and opens it. Null if no
   * folder was chosen.
   */
  openArchive(path: string): Promise<AppState | null>;
  /** Stops the export or extraction running now. */
  stopPackage(): Promise<void>;
  /** Writes a subject's notes, or one note, as ordinary Markdown. */
  exportMarkdown(
    input: { subjectId: string } | { noteId: string },
  ): Promise<MarkdownExport | null>;
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

  createProject(input: {
    title: string;
    subjectIds: string[];
    resourceIds: string[];
  }): Promise<ProjectInfo>;
  updateProject(input: {
    id: string;
    title?: string;
    subjectIds?: string[];
    resourceIds?: string[];
  }): Promise<ProjectInfo>;
  /** Moves the project to the trash. Its subjects and files stay. */
  deleteProject(id: string): Promise<WorkspaceSnapshot>;

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
  /** Text kept from an earlier session that never reached the note. */
  readDraft(noteId: string): Promise<NoteDraft | null>;
  /** Keeps text the editor cannot save yet, such as during a conflict. */
  keepDraft(input: {
    id: string;
    body: string;
    expectedRevision: string;
  }): Promise<void>;
  discardDraft(noteId: string): Promise<void>;
  /** Makes the kept text the note's text, keeping what it replaces. */
  restoreDraft(noteId: string): Promise<NoteDocument>;
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
  /** Kept copies of an imported file, newest first. */
  listFileRevisions(resourceId: string): Promise<FileRevision[]>;
  /** Puts a kept copy of an imported file back, keeping what it replaces. */
  restoreFileRevision(input: {
    resourceId: string;
    revisionId: string;
  }): Promise<ResourceInfo>;
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
  /** Removes a deleted item from disk for good. */
  deleteFromTrash(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
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

  /** Which pages of a PDF have no text, and whether they are being read. */
  getTextRecognition(resourceId: string): Promise<TextRecognition>;
  /** Starts reading the text of a PDF's scanned pages on this computer. */
  recognizeText(resourceId: string): Promise<void>;
  stopTextRecognition(): Promise<void>;

  readResourceBytes(id: string): Promise<Uint8Array>;
  openResourceExternally(id: string): Promise<void>;
  search(query: string): Promise<SearchResult[]>;
  /** Links between notes and documents, for the graph. */
  listLinks(): Promise<ResourceLink[]>;
  /** Opens an http, https, or mailto link in the system browser. */
  openExternal(url: string): Promise<void>;

  /** Every subject's cards and quizzes, and today's reviews. */
  listPractice(): Promise<PracticeOverview>;
  setNewCardsPerDay(value: number): Promise<void>;
  /** Cards due now, in review order. Without a subject, every subject's. */
  getReviewQueue(filter: {
    subjectId?: string;
    topic?: string;
  }): Promise<ReviewItem[]>;
  rateCard(input: {
    subjectId: string;
    cardId: string;
    rating: Rating;
    durationMs?: number;
  }): Promise<{ reviewId: string; card: Flashcard }>;
  undoReview(input: {
    subjectId: string;
    reviewId: string;
  }): Promise<Flashcard>;
  createCard(input: CardInput & { subjectId: string }): Promise<Flashcard>;
  updateCard(
    input: CardInput & { subjectId: string; id: string },
  ): Promise<Flashcard>;
  changeCards(input: {
    subjectId: string;
    ids: string[];
    action: CardAction;
  }): Promise<void>;
  readQuiz(input: { subjectId: string; quizId: string }): Promise<QuizFile>;
  /** Creates a quiz, or replaces one's title and questions when `id` is set. */
  saveQuiz(input: {
    subjectId: string;
    id?: string;
    title: string;
    topic?: string;
    questions: QuestionInput[];
  }): Promise<QuizFile>;
  deleteQuiz(input: { subjectId: string; quizId: string }): Promise<void>;
  /** Carries on the quiz's unfinished attempt, or starts one. */
  startAttempt(input: { subjectId: string; quizId: string }): Promise<Attempt>;
  saveResponses(input: {
    subjectId: string;
    quizId: string;
    attemptId: string;
    responses: Record<string, Omit<Response, "mark">>;
  }): Promise<void>;
  submitAttempt(input: {
    subjectId: string;
    quizId: string;
    attemptId: string;
    responses: Record<string, Omit<Response, "mark">>;
  }): Promise<Attempt>;
  markResponse(input: {
    subjectId: string;
    quizId: string;
    attemptId: string;
    questionId: string;
    outcome: Outcome;
  }): Promise<Attempt>;

  getPlan(): Promise<PlanFile>;
  /** Adds a session, or changes one when `id` is set. */
  saveSession(input: SessionInput & { id?: string }): Promise<StudySession>;
  deleteSession(id: string): Promise<void>;
  setSessionStatus(input: {
    id: string;
    status: SessionStatus;
  }): Promise<StudySession>;
  /** Accepts or declines the assistant's suggested sessions and moves. */
  resolveProposals(input: { ids: string[]; accept: boolean }): Promise<void>;
  saveAssessment(input: AssessmentInput & { id?: string }): Promise<Assessment>;
  deleteAssessment(id: string): Promise<void>;
  setAvailability(slots: Availability[]): Promise<Availability[]>;
  /** Saves the plan as an .ics file. Returns where, or null if cancelled. */
  exportCalendar(): Promise<string | null>;

  /** The profile and what practice says about each topic. */
  getLearnerProfile(): Promise<LearnerProfile>;
  setPersonalization(on: boolean): Promise<void>;
  updatePreferences(patch: PreferencesPatch): Promise<Preferences>;
  saveTopic(input: TopicInput & { id?: string }): Promise<Topic>;
  deleteTopic(id: string): Promise<void>;
  /** Accepts the assistant's suggestion, at a corrected level if given, or rejects it. */
  resolveTopicProposal(input: {
    id: string;
    accept: boolean;
    level?: TopicLevel;
  }): Promise<void>;

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
  /** Activities as resit last saw them, without contacting Moodle. */
  listMoodleActivities(): Promise<SubjectActivities[]>;
  /** Reads every followed course again. Returns the subjects that failed. */
  refreshMoodleActivities(): Promise<{ subjectId: string; message: string }[]>;

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
  exportWorkspace: "resit:workspace-export",
  chooseArchive: "resit:archive-choose",
  openArchive: "resit:archive-open",
  stopPackage: "resit:package-stop",
  exportMarkdown: "resit:markdown-export",
  saveLayout: "resit:layout-save",
  createSubject: "resit:subject-create",
  updateSubject: "resit:subject-update",
  deleteSubject: "resit:subject-delete",
  createProject: "resit:project-create",
  updateProject: "resit:project-update",
  deleteProject: "resit:project-delete",
  createFolder: "resit:folder-create",
  updateFolder: "resit:folder-update",
  deleteFolder: "resit:folder-delete",
  createNote: "resit:note-create",
  readNote: "resit:note-read",
  saveNote: "resit:note-save",
  readDraft: "resit:draft-read",
  keepDraft: "resit:draft-keep",
  discardDraft: "resit:draft-discard",
  restoreDraft: "resit:draft-restore",
  listNoteRevisions: "resit:note-history",
  readNoteRevision: "resit:note-revision",
  restoreNoteRevision: "resit:note-restore",
  listFileRevisions: "resit:file-history",
  restoreFileRevision: "resit:file-restore",
  renameResource: "resit:resource-rename",
  moveResource: "resit:resource-move",
  deleteResource: "resit:resource-delete",
  listTrash: "resit:trash-list",
  restoreFromTrash: "resit:trash-restore",
  deleteFromTrash: "resit:trash-delete",
  emptyTrash: "resit:trash-empty",
  importFiles: "resit:resource-import",
  listAnnotations: "resit:annotation-list",
  createAnnotation: "resit:annotation-create",
  updateAnnotation: "resit:annotation-update",
  deleteAnnotation: "resit:annotation-delete",
  getTextRecognition: "resit:ocr-status",
  recognizeText: "resit:ocr-start",
  stopTextRecognition: "resit:ocr-stop",
  readResourceBytes: "resit:resource-bytes",
  openResourceExternally: "resit:resource-open-external",
  search: "resit:search",
  listLinks: "resit:links",
  openExternal: "resit:open-external",
  listPractice: "resit:practice-list",
  setNewCardsPerDay: "resit:practice-new-per-day",
  getReviewQueue: "resit:review-queue",
  rateCard: "resit:card-rate",
  undoReview: "resit:card-undo",
  createCard: "resit:card-create",
  updateCard: "resit:card-update",
  changeCards: "resit:cards-change",
  readQuiz: "resit:quiz-read",
  saveQuiz: "resit:quiz-save",
  deleteQuiz: "resit:quiz-delete",
  startAttempt: "resit:attempt-start",
  saveResponses: "resit:attempt-save",
  submitAttempt: "resit:attempt-submit",
  markResponse: "resit:attempt-mark",
  getPlan: "resit:plan",
  saveSession: "resit:session-save",
  deleteSession: "resit:session-delete",
  setSessionStatus: "resit:session-status",
  resolveProposals: "resit:plan-proposals",
  saveAssessment: "resit:assessment-save",
  deleteAssessment: "resit:assessment-delete",
  setAvailability: "resit:availability",
  exportCalendar: "resit:calendar-export",
  getLearnerProfile: "resit:learner",
  setPersonalization: "resit:learner-personalization",
  updatePreferences: "resit:learner-preferences",
  saveTopic: "resit:topic-save",
  deleteTopic: "resit:topic-delete",
  resolveTopicProposal: "resit:topic-proposal",
  getMoodleStatus: "resit:moodle-status",
  connectMoodle: "resit:moodle-connect",
  disconnectMoodle: "resit:moodle-disconnect",
  listMoodleCourses: "resit:moodle-courses",
  setMoodleCourse: "resit:moodle-set-course",
  listMoodleItems: "resit:moodle-items",
  downloadMoodleItems: "resit:moodle-download",
  listMoodleActivities: "resit:moodle-activities",
  refreshMoodleActivities: "resit:moodle-activities-refresh",
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
