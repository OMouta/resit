import { z } from "zod";

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
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type SidecarFile = z.infer<typeof sidecarFileSchema>;

export type ResourceKind = "note" | BinaryKind;

export interface SubjectInfo {
  id: string;
  name: string;
  color: SubjectColorValue;
  sortOrder: number;
  archived: boolean;
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
  resources: ResourceInfo[];
  issues: WorkspaceIssue[];
}

export interface RecentWorkspace {
  id: string;
  name: string;
  path: string;
}

export type SaveNoteResult =
  | { status: "saved"; revision: string; resource: ResourceInfo }
  | { status: "conflict"; currentRevision: string; currentBody: string }
  | { status: "missing" };
