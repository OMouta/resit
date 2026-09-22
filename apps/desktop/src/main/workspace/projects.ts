import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

import type { ConversationScope } from "../../shared/conversations";
import {
  projectFileSchema,
  projectInfo,
  type ProjectActivity,
  type ProjectDue,
  type ProjectFile,
  type ProjectInfo,
} from "../../shared/workspace";
import { readJson, slugify, uniquePath, writeJson } from "./files";
import {
  moveToTrash,
  projectsDir,
  withLock,
  WorkspaceError,
  type OpenWorkspace,
} from "./workspace";
import { t } from "../i18n";

/** Only subjects and files the workspace has, each once. */
function known(
  workspace: OpenWorkspace,
  input: { subjectIds: string[]; resourceIds: string[] },
): { subjectIds: string[]; resourceIds: string[] } {
  return {
    subjectIds: [...new Set(input.subjectIds)].filter((id) =>
      workspace.subjects.has(id),
    ),
    resourceIds: [...new Set(input.resourceIds)].filter((id) =>
      workspace.resources.has(id),
    ),
  };
}

export async function createProject(
  workspace: OpenWorkspace,
  input: {
    title: string;
    subjectIds: string[];
    resourceIds: string[];
    due?: ProjectDue | null | undefined;
    activity?: ProjectActivity | null | undefined;
  },
): Promise<ProjectInfo> {
  const directory = projectsDir(workspace);
  await mkdir(directory, { recursive: true });
  const path = await uniquePath(directory, slugify(input.title), ".json");
  const at = new Date().toISOString();
  const file: ProjectFile = {
    format: "resit-project",
    formatVersion: 1,
    id: randomUUID(),
    title: input.title,
    ...known(workspace, input),
    ...(input.due ? { due: input.due } : {}),
    ...(input.activity ? { activity: input.activity } : {}),
    createdAt: at,
    updatedAt: at,
  };
  await writeJson(path, file);
  const info = projectInfo(file);
  workspace.projects.set(info.id, { info, path });
  return info;
}

function projectEntry(workspace: OpenWorkspace, id: string) {
  const entry = workspace.projects.get(id);
  if (!entry) throw new WorkspaceError(t("That project no longer exists."));
  return entry;
}

/**
 * Renames a project or changes what it holds. Its file keeps its name. A
 * due date or activity of null clears it.
 */
export function updateProject(
  workspace: OpenWorkspace,
  input: {
    id: string;
    title?: string | undefined;
    subjectIds?: string[] | undefined;
    resourceIds?: string[] | undefined;
    due?: ProjectDue | null | undefined;
    activity?: ProjectActivity | null | undefined;
  },
): Promise<ProjectInfo> {
  const entry = projectEntry(workspace, input.id);
  return withLock(workspace, input.id, async () => {
    const file = projectFileSchema.parse(await readJson(entry.path));
    const contents = known(workspace, {
      subjectIds: input.subjectIds ?? file.subjectIds,
      resourceIds: input.resourceIds ?? file.resourceIds,
    });
    const { due, activity, ...rest } = file;
    const nextDue = input.due === undefined ? due : input.due;
    const nextActivity =
      input.activity === undefined ? activity : input.activity;
    const next: ProjectFile = {
      ...rest,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...contents,
      ...(nextDue ? { due: nextDue } : {}),
      ...(nextActivity ? { activity: nextActivity } : {}),
      updatedAt: new Date().toISOString(),
    };
    await writeJson(entry.path, next);
    entry.info = projectInfo(next);
    return entry.info;
  });
}

/** Moves the project to the trash. Its subjects and files stay put. */
export async function deleteProject(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  const entry = projectEntry(workspace, id);
  await moveToTrash(workspace, [entry.path], {
    kind: "project",
    id,
    title: entry.info.title,
  });
  workspace.projects.delete(id);
}

/**
 * Adds files to a project, leaving out those one of its subjects already
 * holds. Nothing changes for a project that no longer exists.
 */
export async function joinProject(
  workspace: OpenWorkspace,
  projectId: string,
  resourceIds: string[],
): Promise<void> {
  const project = workspace.projects.get(projectId)?.info;
  if (!project) return;
  const loose = resourceIds.filter((id) => {
    const resource = workspace.resources.get(id)?.info;
    return resource && !project.subjectIds.includes(resource.subjectId);
  });
  if (loose.length === 0) return;
  await updateProject(workspace, {
    id: projectId,
    resourceIds: [...project.resourceIds, ...loose],
  });
}

/**
 * The subjects and files a conversation reaches: its own, and its
 * project's as the project stands now.
 */
export function resolveScope(
  workspace: OpenWorkspace,
  scope: ConversationScope,
): { subjectIds: string[]; resourceIds: string[] } {
  const project = scope.projectId
    ? workspace.projects.get(scope.projectId)?.info
    : undefined;
  return {
    subjectIds: [
      ...new Set([...scope.subjectIds, ...(project?.subjectIds ?? [])]),
    ],
    resourceIds: [
      ...new Set([...scope.resourceIds, ...(project?.resourceIds ?? [])]),
    ],
  };
}
