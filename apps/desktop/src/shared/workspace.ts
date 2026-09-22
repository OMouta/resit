import { z } from "zod";

import {
  moodleFileRefSchema,
  moodleLinkSchema,
  type MoodleLink,
} from "./moodle";
import { dateSchema, timeSchema } from "./planning";

export const SUBJECT_COLOR_VALUES = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

export const subjectColorSchema = z.enum(SUBJECT_COLOR_VALUES);
export type SubjectColorValue = z.infer<typeof subjectColorSchema>;

const timestamp = z.iso.datetime({ offset: true });

/** `workspace.json`. Unknown fields are kept when the file is rewritten. */
export const workspaceFileSchema = z.looseObject({
  format: z.literal("resit-workspace"),
  formatVersion: z.number().int().positive(),
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
  locale: z.string().optional(),
  timezone: z.string().optional(),
});
export type WorkspaceFile = z.infer<typeof workspaceFileSchema>;

/** `subjects/<folder>/subject.json`. */
export const subjectFileSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  color: subjectColorSchema.catch("gray"),
  sortOrder: z.number().catch(0),
  archived: z.boolean().catch(false),
  /** Set when the subject follows a Moodle course. */
  moodle: moodleLinkSchema.optional().catch(undefined),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type SubjectFile = z.infer<typeof subjectFileSchema>;

export const binaryKindSchema = z.enum(["pdf", "image", "attachment"]);
export type BinaryKind = z.infer<typeof binaryKindSchema>;

/** `<file>.resource.json`, stored beside a binary resource. */
export const sidecarFileSchema = z.looseObject({
  id: z.string().min(1),
  type: binaryKindSchema,
  title: z.string().min(1),
  subjectId: z.string().min(1),
  originalFilename: z.string(),
  contentHash: z.string(),
  revision: z.string(),
  /** Set when the file was downloaded from Moodle. */
  moodle: moodleFileRefSchema.optional().catch(undefined),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type SidecarFile = z.infer<typeof sidecarFileSchema>;

export type ResourceKind = "note" | BinaryKind;

/** When a project is due, on the student's clock. */
export const projectDueSchema = z.object({
  date: dateSchema,
  time: timeSchema.optional(),
});
export type ProjectDue = z.infer<typeof projectDueSchema>;

/** The Moodle activity a project is the work for, such as an assignment. */
export const projectActivitySchema = z.object({
  subjectId: z.string().min(1),
  moduleId: z.number().int().nonnegative(),
});
export type ProjectActivity = z.infer<typeof projectActivitySchema>;

/**
 * `projects/<name>.json`: subjects and files from across the workspace,
 * grouped. A project refers to them; it does not copy them.
 */
export const projectFileSchema = z.looseObject({
  format: z.literal("resit-project"),
  formatVersion: z.number().int().positive(),
  id: z.string().min(1),
  title: z.string().min(1),
  subjectIds: z.array(z.string()).catch([]),
  resourceIds: z.array(z.string()).catch([]),
  due: projectDueSchema.optional().catch(undefined),
  activity: projectActivitySchema.optional().catch(undefined),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ProjectFile = z.infer<typeof projectFileSchema>;

export interface ProjectInfo {
  id: string;
  title: string;
  subjectIds: string[];
  /** Files added on their own, beyond the subjects. */
  resourceIds: string[];
  /** Set by the student. A linked Moodle activity's own date wins. */
  due?: ProjectDue;
  activity?: ProjectActivity;
}

/** What the window is told about a project file. */
export function projectInfo(file: ProjectFile): ProjectInfo {
  return {
    id: file.id,
    title: file.title,
    subjectIds: file.subjectIds,
    resourceIds: file.resourceIds,
    ...(file.due ? { due: file.due } : {}),
    ...(file.activity ? { activity: file.activity } : {}),
  };
}

export interface SubjectInfo {
  id: string;
  name: string;
  color: SubjectColorValue;
  sortOrder: number;
  archived: boolean;
  /** The Moodle course this subject follows, if any. */
  moodle?: MoodleLink;
}

export interface ResourceInfo {
  id: string;
  kind: ResourceKind;
  title: string;
  subjectId: string;
  /** Workspace-relative path with forward slashes. */
  path: string;
  /** Folder inside the subject's notes/documents area, if nested. */
  folder?: string;
  revision: string;
  size: number;
  updatedAt: string;
}

export interface FolderInfo {
  subjectId: string;
  /** Folder path inside the subject, with forward slashes. */
  path: string;
  /** Holds files resit downloaded from the subject's Moodle course. */
  moodle: boolean;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  root: string;
}

export interface WorkspaceIssue {
  kind: "duplicate-id" | "invalid-file";
  path: string;
  message: string;
}

export interface WorkspaceSnapshot {
  workspace: WorkspaceInfo;
  subjects: SubjectInfo[];
  projects: ProjectInfo[];
  folders: FolderInfo[];
  resources: ResourceInfo[];
  issues: WorkspaceIssue[];
}

export interface RecentWorkspace {
  id: string;
  name: string;
  path: string;
}

export type TrashKind =
  ResourceKind | "subject" | "folder" | "conversation" | "quiz" | "project";

/** One deletion sitting in `.resit/trash`. */
export interface TrashEntry {
  /** The folder inside `.resit/trash` holding this deletion. */
  id: string;
  kind: TrashKind;
  title: string;
  subjectName: string | null;
  deletedAt: string;
  /** Where the deleted item came from, relative to the workspace. */
  originalPath: string;
  /** For a subject, the notes and files it holds. */
  ownedCount?: number;
}

/** The private parts of a workspace, which an export can leave out. */
export interface PackageOptions {
  conversations: boolean;
  learner: boolean;
  history: boolean;
  trash: boolean;
}

/** What a .resit archive holds, read before anything is extracted. */
export interface PackageSummary {
  workspaceName: string;
  exportedAt: string;
  files: number;
  bytes: number;
}

export interface MarkdownExport {
  folder: string;
  notes: number;
  files: number;
  /** Links left as resit:// addresses: to notes not exported, or gone. */
  unresolved: number;
}

/** Note text that was not saved, kept so it survives a restart. */
export interface NoteDraft {
  body: string;
  savedAt: string;
}

export type SaveNoteResult =
  | { status: "saved"; revision: string; resource: ResourceInfo }
  | { status: "conflict"; currentRevision: string; currentBody: string }
  | { status: "missing" };

export const ANNOTATION_TYPE_VALUES = ["highlight", "underline"] as const;
export const ANNOTATION_COLOR_VALUES = [
  "yellow",
  "green",
  "blue",
  "pink",
] as const;

export const annotationTypeSchema = z.enum(ANNOTATION_TYPE_VALUES);
export type AnnotationType = z.infer<typeof annotationTypeSchema>;
export const annotationColorSchema = z.enum(ANNOTATION_COLOR_VALUES);
export type AnnotationColorValue = z.infer<typeof annotationColorSchema>;

const coordinate = z.number().finite();
/** `[xMin, yMin, xMax, yMax]` in PDF user space. */
const rect = z.tuple([coordinate, coordinate, coordinate, coordinate]);
/**
 * Corners of one selected line, in PDF user space, in the order PDF
 * QuadPoints uses: top-left, top-right, bottom-left, bottom-right.
 */
const quad = z.tuple([
  coordinate,
  coordinate,
  coordinate,
  coordinate,
  coordinate,
  coordinate,
  coordinate,
  coordinate,
]);
export type AnnotationQuad = z.infer<typeof quad>;

/** One page's worth of a selection. A selection may span several pages. */
export const annotationSegmentSchema = z.looseObject({
  pageIndex: z.number().int().nonnegative(),
  cropBox: rect,
  quads: z.array(quad).min(1),
  text: z.string(),
});
export type AnnotationSegment = z.infer<typeof annotationSegmentSchema>;

export const annotationSchema = z.looseObject({
  id: z.string().min(1),
  documentId: z.string().min(1),
  /** The PDF's revision when the annotation was made. */
  documentRevision: z.string(),
  type: annotationTypeSchema,
  color: annotationColorSchema.catch("yellow"),
  segments: z.array(annotationSegmentSchema).min(1),
  comment: z.string().optional(),
  /** Absent on the student's own highlights. */
  author: z.literal("assistant").optional().catch(undefined),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Annotation = z.infer<typeof annotationSchema>;

/** `subjects/<folder>/annotations/<documentId>.json`. */
export const annotationFileSchema = z.looseObject({
  format: z.literal("resit-annotations"),
  formatVersion: z.number().int().positive(),
  documentId: z.string().min(1),
  annotations: z.array(annotationSchema),
});
export type AnnotationFile = z.infer<typeof annotationFileSchema>;

/** Why resit kept a copy of a note before changing it. */
export const REVISION_CAUSES = ["edit", "assistant", "restore"] as const;
export type RevisionCause = (typeof REVISION_CAUSES)[number];

/** One kept copy of a note's text, taken before the change its cause names. */
export interface NoteRevision {
  id: string;
  at: string;
  cause: RevisionCause;
  size: number;
}

export interface NoteRevisionContent extends NoteRevision {
  body: string;
}

/** One kept copy of an imported file, taken before it was replaced. */
export interface FileRevision {
  id: string;
  at: string;
  /** Replaced by a newer copy, or by putting a kept one back. */
  cause: "replace" | "restore";
  size: number;
}
