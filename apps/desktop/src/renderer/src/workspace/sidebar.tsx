import {
  FileDownIcon,
  FilePlusIcon,
  FolderPlusIcon,
  GraduationCapIcon,
  HistoryIcon,
  LayoutListIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SettingsIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import type {
  TreeRow,
  TreeSubject,
} from "@resit/ui/patterns/navigation/subject-tree";
import {
  WorkspaceSidebar,
  type SidebarProject,
} from "@resit/ui/patterns/navigation/workspace-sidebar";
import { useLocale } from "@resit/ui/hooks/use-locale";

import type { FolderInfo, WorkspaceSnapshot } from "../../../shared/workspace";

export interface SidebarActions {
  openResource: (resourceId: string) => void;
  addProject: () => void;
  openProject: (projectId: string) => void;
  addSubject: () => void;
  editSubject: (subjectId: string) => void;
  deleteSubject: (subjectId: string) => void;
  moveSubject: (subjectId: string, direction: -1 | 1) => void;
  newNote: (subjectId: string, folder?: string) => void;
  importFiles: (subjectId: string, folder?: string) => void;
  openMoodle: (subjectId: string) => void;
  /** The course page of a subject that follows Moodle. */
  openCourse: (subjectId: string) => void;
  newFolder: (subjectId: string, parent?: string) => void;
  renameFolder: (subjectId: string, folder: string) => void;
  /** Without a parent the folder goes to the top of its subject. */
  moveFolder: (subjectId: string, folder: string, parent?: string) => void;
  deleteFolder: (subjectId: string, folder: string) => void;
  renameResource: (resourceId: string) => void;
  moveResource: (
    resourceId: string,
    subjectId: string,
    folder?: string,
  ) => void;
  deleteResource: (resourceId: string) => void;
  /** Writes a subject's notes, or one note, as ordinary Markdown files. */
  exportMarkdown: (input: { subjectId: string } | { noteId: string }) => void;
  /** Kept copies of an imported file. Notes show theirs in the editor. */
  showFileHistory: (resourceId: string) => void;
  openGraph: () => void;
  openSchedule: () => void;
  openPractice: () => void;
  openProfile: () => void;
  openTrash: () => void;
  openSettings: () => void;
}

function RowMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The folder a path sits in, or nothing when it is already at the top. */
function parentOf(path: string): string | undefined {
  const at = path.lastIndexOf("/");
  return at === -1 ? undefined : path.slice(0, at);
}

/** Folders Moodle fills, including everything below them. */
function moodleFolders(folders: FolderInfo[]): (folder: FolderInfo) => boolean {
  const filled = new Set(
    folders
      .filter((folder) => folder.moodle)
      .map((folder) => `${folder.subjectId}/${folder.path}`),
  );
  return (folder) => {
    const segments = folder.path.split("/");
    return segments.some((_, index) =>
      filled.has(
        `${folder.subjectId}/${segments.slice(0, index + 1).join("/")}`,
      ),
    );
  };
}

export function Sidebar({
  snapshot,
  expanded,
  onExpandedChange,
  activeResourceId,
  activeProjectId,
  practiceDue,
  waitingSuggestions,
  actions,
}: {
  snapshot: WorkspaceSnapshot;
  expanded: readonly string[];
  onExpandedChange: (id: string, expanded: boolean) => void;
  activeResourceId: string | undefined;
  activeProjectId: string | undefined;
  /** Cards to review now, shown beside Practice. */
  practiceDue: number;
  /** The assistant's profile suggestions, shown beside Learner profile. */
  waitingSuggestions: number;
  actions: SidebarActions;
}) {
  const { t } = useLocale();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [subjectsOpen, setSubjectsOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);

  const subjects = useMemo<TreeSubject[]>(() => {
    const fromMoodle = moodleFolders(snapshot.folders);
    return snapshot.subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      color: subject.color,
      archived: subject.archived,
      ...(subject.moodle
        ? { linked: `following ${subject.moodle.shortname} in Moodle` }
        : {}),
      folders: snapshot.folders
        .filter((folder) => folder.subjectId === subject.id)
        .map((folder) => ({
          path: folder.path,
          ...(fromMoodle(folder) ? { linked: "filled from Moodle" } : {}),
        })),
      resources: snapshot.resources
        .filter((resource) => resource.subjectId === subject.id)
        .map((resource) => ({
          id: resource.id,
          kind: resource.kind,
          title: resource.title,
          ...(resource.folder ? { folder: resource.folder } : {}),
        })),
    }));
  }, [snapshot]);
  const projects = useMemo<SidebarProject[]>(() => {
    const colours = new Map(
      snapshot.subjects.map((subject) => [subject.id, subject]),
    );
    return snapshot.projects.map((project) => ({
      id: project.id,
      name: project.title,
      subjects: project.subjectIds.flatMap((id) => {
        const subject = colours.get(id);
        return subject ? [{ name: subject.name, color: subject.color }] : [];
      }),
      resourceCount: snapshot.resources.filter(
        (resource) =>
          project.subjectIds.includes(resource.subjectId) ||
          project.resourceIds.includes(resource.id),
      ).length,
    }));
  }, [snapshot]);
  const expandedIds = useMemo(() => new Set(expanded), [expanded]);
  const following = useMemo(
    () =>
      new Set(
        snapshot.subjects
          .filter((subject) => subject.moodle)
          .map((subject) => subject.id),
      ),
    [snapshot.subjects],
  );
  const resources = useMemo(
    () =>
      new Map(snapshot.resources.map((resource) => [resource.id, resource])),
    [snapshot.resources],
  );

  /** Where a dragged row would land: a subject, and a folder inside it. */
  const destination = (target: TreeRow) =>
    target.kind === "subject"
      ? { subjectId: target.id, folder: undefined }
      : target.kind === "folder"
        ? { subjectId: target.subjectId, folder: target.folder.path }
        : null;

  return (
    <WorkspaceSidebar
      tree={{
        subjects,
        expandedIds,
        onExpandedChange,
        activeResourceId,
        selectedId,
        onSelect: setSelectedId,
        onOpenResource: actions.openResource,
        onMoveSubject: actions.moveSubject,
        move: {
          canDrop: (dragged, target) => {
            const to = destination(target);
            if (!to) return false;
            if (target.kind === "folder" && target.folder.linked) return false;
            if (dragged.kind === "resource") {
              const resource = resources.get(dragged.id);
              if (!resource) return false;
              return !(
                resource.subjectId === to.subjectId &&
                (resource.folder ?? undefined) === to.folder
              );
            }
            if (dragged.kind !== "folder") return false;
            // Folders stay in their subject: their files would all move with
            // them, which is a different job from filing one away.
            if (dragged.subjectId !== to.subjectId) return false;
            if (dragged.folder.linked) return false;
            const path = dragged.folder.path;
            if (to.folder === path || to.folder?.startsWith(`${path}/`))
              return false;
            return to.folder !== parentOf(path);
          },
          onMove: (dragged, target) => {
            const to = destination(target);
            if (!to) return;
            if (dragged.kind === "resource")
              actions.moveResource(dragged.id, to.subjectId, to.folder);
            else if (dragged.kind === "folder")
              actions.moveFolder(
                dragged.subjectId,
                dragged.folder.path,
                to.folder,
              );
          },
        },
        renderActions: (row) => {
          if (row.kind === "subject")
            return (
              <>
                <Button
                  variant="subtle"
                  size="icon-sm"
                  aria-label={t("New note")}
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.newNote(row.id);
                  }}
                >
                  <FilePlusIcon />
                </Button>
                <RowMenu label={t("Subject actions")}>
                  <DropdownMenuItem onSelect={() => actions.newNote(row.id)}>
                    <FilePlusIcon /> {t("New note")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => actions.newFolder(row.id)}>
                    <FolderPlusIcon /> {t("New folder…")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => actions.importFiles(row.id)}
                  >
                    <UploadIcon /> {t("Import files…")}
                  </DropdownMenuItem>
                  {following.has(row.id) ? (
                    <DropdownMenuItem
                      onSelect={() => actions.openCourse(row.id)}
                    >
                      <LayoutListIcon /> {t("Course page")}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={() => actions.openMoodle(row.id)}>
                    <GraduationCapIcon /> {t("Moodle…")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      actions.exportMarkdown({ subjectId: row.id })
                    }
                  >
                    <FileDownIcon /> {t("Export as Markdown…")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => actions.editSubject(row.id)}
                  >
                    <PencilIcon /> {t("Rename or recolour…")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => actions.deleteSubject(row.id)}
                  >
                    <Trash2Icon /> {t("Move to trash…")}
                  </DropdownMenuItem>
                </RowMenu>
              </>
            );
          if (row.kind === "folder")
            return (
              <RowMenu label={t("Folder actions")}>
                {row.folder.linked ? null : (
                  <>
                    <DropdownMenuItem
                      onSelect={() =>
                        actions.newNote(row.subjectId, row.folder.path)
                      }
                    >
                      <FilePlusIcon /> {t("New note")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        actions.newFolder(row.subjectId, row.folder.path)
                      }
                    >
                      <FolderPlusIcon /> {t("New folder…")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        actions.importFiles(row.subjectId, row.folder.path)
                      }
                    >
                      <UploadIcon /> {t("Import files…")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() =>
                        actions.renameFolder(row.subjectId, row.folder.path)
                      }
                    >
                      <PencilIcon /> {t("Rename…")}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() =>
                    actions.deleteFolder(row.subjectId, row.folder.path)
                  }
                >
                  <Trash2Icon /> {t("Move to trash…")}
                </DropdownMenuItem>
              </RowMenu>
            );
          return (
            <RowMenu label={t("File actions")}>
              <DropdownMenuItem onSelect={() => actions.renameResource(row.id)}>
                <PencilIcon /> {t("Rename…")}
              </DropdownMenuItem>
              {resources.get(row.id)?.kind === "note" ? (
                <DropdownMenuItem
                  onSelect={() => actions.exportMarkdown({ noteId: row.id })}
                >
                  <FileDownIcon /> {t("Export as Markdown…")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => actions.showFileHistory(row.id)}
                >
                  <HistoryIcon /> {t("Version history…")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => actions.deleteResource(row.id)}
              >
                <Trash2Icon /> {t("Move to trash…")}
              </DropdownMenuItem>
            </RowMenu>
          );
        },
      }}
      projects={projects}
      activeProjectId={activeProjectId}
      onOpenProject={actions.openProject}
      onAddProject={actions.addProject}
      onNavigate={(destination) => {
        if (destination === "graph") actions.openGraph();
        if (destination === "study") actions.openPractice();
        if (destination === "calendar") actions.openSchedule();
        if (destination === "profile") actions.openProfile();
      }}
      destinations={["study", "calendar", "profile", "graph"]}
      counts={{
        ...(practiceDue > 0 ? { study: practiceDue } : {}),
        ...(waitingSuggestions > 0 ? { profile: waitingSuggestions } : {}),
      }}
      onAddSubject={actions.addSubject}
      sections={{ subjects: subjectsOpen, projects: projectsOpen }}
      onSectionToggle={(section, open) => {
        if (section === "subjects") setSubjectsOpen(open);
        else setProjectsOpen(open);
      }}
      footer={
        <div className="flex flex-col">
          <Button
            variant="subtle"
            className="w-full justify-start"
            onClick={actions.openTrash}
          >
            <Trash2Icon /> {t("Trash")}
          </Button>
          <Button
            variant="subtle"
            className="w-full justify-start"
            onClick={actions.openSettings}
          >
            <SettingsIcon /> {t("Settings")}
          </Button>
        </div>
      }
    />
  );
}
