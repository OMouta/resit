import { randomUUID } from "node:crypto";

import {
  annotationFileSchema,
  type Annotation,
  type AnnotationColorValue,
  type AnnotationFile,
  type AnnotationSegment,
  type AnnotationType,
} from "../../shared/workspace";
import { exists, readJson, writeJson } from "./files";
import {
  annotationsPath,
  resourceInfo,
  withLock,
  WorkspaceError,
  type OpenWorkspace,
} from "./workspace";
import { t } from "../i18n";

export const ANNOTATION_FORMAT_VERSION = 1;
const MAX_PER_DOCUMENT = 2000;

const now = () => new Date().toISOString();

function pdfRevision(workspace: OpenWorkspace, documentId: string): string {
  const info = resourceInfo(workspace, documentId);
  if (info.kind !== "pdf")
    throw new WorkspaceError(t("Only PDFs can hold highlights."));
  return info.revision;
}

/**
 * The annotations saved for one PDF. A missing file means none yet; a file
 * that cannot be parsed is an error, because it holds the student's work.
 */
async function loadFile(
  workspace: OpenWorkspace,
  documentId: string,
): Promise<AnnotationFile> {
  const path = annotationsPath(workspace, documentId);
  if (!(await exists(path)))
    return {
      format: "resit-annotations",
      formatVersion: ANNOTATION_FORMAT_VERSION,
      documentId,
      annotations: [],
    };
  let raw: unknown;
  try {
    raw = await readJson(path);
  } catch {
    throw new WorkspaceError(
      t(
        "The highlights saved for this PDF are not valid JSON. The file was left unchanged.",
      ),
    );
  }
  const parsed = annotationFileSchema.safeParse(raw);
  if (!parsed.success)
    throw new WorkspaceError(
      t(
        "The highlights saved for this PDF could not be read: {problem}. The file was left unchanged.",
        { problem: parsed.error.issues[0]?.message ?? t("unknown problem") },
      ),
    );
  if (parsed.data.formatVersion > ANNOTATION_FORMAT_VERSION)
    throw new WorkspaceError(
      t("These highlights were written by a newer version of resit."),
    );
  return parsed.data;
}

export async function listAnnotations(
  workspace: OpenWorkspace,
  documentId: string,
): Promise<Annotation[]> {
  pdfRevision(workspace, documentId);
  return (await loadFile(workspace, documentId)).annotations;
}

/** Reads, changes, and rewrites one document's annotations as a whole. */
function edit<T>(
  workspace: OpenWorkspace,
  documentId: string,
  change: (file: AnnotationFile) => T,
): Promise<T> {
  return withLock(workspace, `annotations:${documentId}`, async () => {
    const file = await loadFile(workspace, documentId);
    const result = change(file);
    await writeJson(annotationsPath(workspace, documentId), {
      ...file,
      formatVersion: ANNOTATION_FORMAT_VERSION,
      documentId,
    });
    return result;
  });
}

export function createAnnotation(
  workspace: OpenWorkspace,
  input: {
    documentId: string;
    type: AnnotationType;
    color: AnnotationColorValue;
    segments: AnnotationSegment[];
    comment?: string | undefined;
    /** Set when the assistant made the highlight rather than the student. */
    author?: "assistant" | undefined;
  },
): Promise<Annotation> {
  const revision = pdfRevision(workspace, input.documentId);
  const at = now();
  const annotation: Annotation = {
    id: randomUUID(),
    documentId: input.documentId,
    documentRevision: revision,
    type: input.type,
    color: input.color,
    segments: input.segments,
    ...(input.comment ? { comment: input.comment } : {}),
    ...(input.author ? { author: input.author } : {}),
    createdAt: at,
    updatedAt: at,
  };
  return edit(workspace, input.documentId, (file) => {
    if (file.annotations.length >= MAX_PER_DOCUMENT)
      throw new WorkspaceError(
        t(
          "This PDF already has {count} highlights. Delete some before adding more.",
          { count: MAX_PER_DOCUMENT },
        ),
      );
    file.annotations.push(annotation);
    return annotation;
  });
}

export function updateAnnotation(
  workspace: OpenWorkspace,
  input: {
    documentId: string;
    id: string;
    color?: AnnotationColorValue | undefined;
    /** An empty string removes the comment. */
    comment?: string | undefined;
  },
): Promise<Annotation> {
  pdfRevision(workspace, input.documentId);
  return edit(workspace, input.documentId, (file) => {
    const index = file.annotations.findIndex((entry) => entry.id === input.id);
    const current = file.annotations[index];
    if (!current)
      throw new WorkspaceError(t("That highlight is no longer in this PDF."));
    const next: Annotation = {
      ...current,
      ...(input.color ? { color: input.color } : {}),
      updatedAt: now(),
    };
    if (input.comment !== undefined) {
      if (input.comment) next.comment = input.comment;
      else delete next.comment;
    }
    file.annotations[index] = next;
    return next;
  });
}

export function deleteAnnotation(
  workspace: OpenWorkspace,
  input: { documentId: string; id: string },
): Promise<void> {
  pdfRevision(workspace, input.documentId);
  return edit(workspace, input.documentId, (file) => {
    const remaining = file.annotations.filter((entry) => entry.id !== input.id);
    if (remaining.length === file.annotations.length)
      throw new WorkspaceError(t("That highlight is no longer in this PDF."));
    file.annotations = remaining;
  });
}
