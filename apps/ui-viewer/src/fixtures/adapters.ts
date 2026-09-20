import type { DocumentTabItem } from "@resit/ui/patterns/navigation/document-tabs";
import type { TreeSubject } from "@resit/ui/patterns/navigation/subject-tree";
import type { SidebarProject } from "@resit/ui/patterns/navigation/workspace-sidebar";

import {
  foldersForSubject,
  projects,
  resourceById,
  resourcesForSubject,
  subjectById,
  subjects,
  type TabFixture,
} from "./workspace";

/** Fixture subjects and resources shaped for the sidebar tree. */
export function toTreeSubjects(
  options: { includeArchived?: boolean } = {},
): TreeSubject[] {
  return subjects
    .filter((subject) => options.includeArchived || !subject.archived)
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      color: subject.color,
      ...(subject.archived ? { archived: true } : {}),
      ...(subject.linked ? { linked: subject.linked } : {}),
      folders: foldersForSubject(subject.id).map((folder) => ({
        path: folder.path,
        ...(folder.linked ? { linked: folder.linked } : {}),
      })),
      resources: resourcesForSubject(subject.id).map((resource) => ({
        id: resource.id,
        kind: resource.kind,
        title: resource.title,
        ...(resource.folder ? { folder: resource.folder } : {}),
        ...(resource.id === "res_ws3_note" ? { dirty: true } : {}),
        ...(resource.missing ? { missing: true } : {}),
      })),
    }));
}

export function toSidebarProjects(): SidebarProject[] {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    resourceCount: project.resourceIds.length,
    subjects: project.subjectIds.flatMap((id) => {
      const subject = subjectById(id);
      return subject ? [{ name: subject.name, color: subject.color }] : [];
    }),
  }));
}

export function toTabItem(tab: TabFixture): DocumentTabItem {
  const resource = resourceById(tab.resourceId);
  const subject = subjectById(resource.subjectId);
  return {
    id: tab.id,
    title: resource.title,
    kind: resource.kind,
    ...(subject
      ? { subject: { name: subject.name, color: subject.color } }
      : {}),
    ...(tab.pinned ? { pinned: true } : {}),
    ...(tab.dirty ? { dirty: true } : {}),
    ...(resource.missing ? { missing: true } : {}),
  };
}
