import {
  FilePlusIcon,
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
import type { TreeSubject } from "@resit/ui/patterns/navigation/subject-tree";
import { WorkspaceSidebar } from "@resit/ui/patterns/navigation/workspace-sidebar";

import type {
  RecentWorkspace,
  WorkspaceSnapshot,
} from "../../../shared/workspace";

export interface SidebarActions {
  openResource: (resourceId: string) => void;
  switchWorkspace: (path: string) => void;
  createWorkspace: () => void;
  openFolder: () => void;
  addSubject: () => void;
  editSubject: (subjectId: string) => void;
  deleteSubject: (subjectId: string) => void;
  moveSubject: (subjectId: string, direction: -1 | 1) => void;
  newNote: (subjectId: string) => void;
  importFiles: (subjectId: string) => void;
  renameResource: (resourceId: string) => void;
  deleteResource: (resourceId: string) => void;
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

export function Sidebar({
  snapshot,
  recent,
  expanded,
  onExpandedChange,
  activeResourceId,
  actions,
}: {
  snapshot: WorkspaceSnapshot;
  recent: RecentWorkspace[];
  expanded: readonly string[];
  onExpandedChange: (id: string, expanded: boolean) => void;
  activeResourceId: string | undefined;
  actions: SidebarActions;
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [subjectsOpen, setSubjectsOpen] = useState(true);

  const subjects = useMemo<TreeSubject[]>(
    () =>
      snapshot.subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        color: subject.color,
        archived: subject.archived,
        resources: snapshot.resources
          .filter((resource) => resource.subjectId === subject.id)
          .map((resource) => ({
            id: resource.id,
            kind: resource.kind,
            title: resource.title,
            ...(resource.folder ? { folder: resource.folder } : {}),
          })),
      })),
    [snapshot],
  );
  const expandedIds = useMemo(() => new Set(expanded), [expanded]);
  const current = {
    id: snapshot.workspace.id,
    name: snapshot.workspace.name,
    path: snapshot.workspace.root,
  };

  return (
    <WorkspaceSidebar
      switcher={{
        workspace: current,
        recent,
        onSwitch: (id) => {
          const target = recent.find((entry) => entry.id === id);
          if (target) actions.switchWorkspace(target.path);
        },
        onCreate: actions.createWorkspace,
        onOpenFolder: actions.openFolder,
      }}
      tree={{
        subjects,
        expandedIds,
        onExpandedChange,
        activeResourceId,
        selectedId,
        onSelect: setSelectedId,
        onOpenResource: actions.openResource,
        onMoveSubject: actions.moveSubject,
        renderActions: ({ kind, id }) =>
          kind === "subject" ? (
            <>
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label="New note"
                onClick={(event) => {
                  event.stopPropagation();
                  actions.newNote(id);
                }}
              >
                <FilePlusIcon />
              </Button>
              <RowMenu label="Subject actions">
                <DropdownMenuItem onSelect={() => actions.newNote(id)}>
                  <FilePlusIcon /> New note
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => actions.importFiles(id)}>
                  <UploadIcon /> Import files…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => actions.editSubject(id)}>
                  <PencilIcon /> Rename or recolour…
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => actions.deleteSubject(id)}
                >
                  <Trash2Icon /> Move to trash…
                </DropdownMenuItem>
              </RowMenu>
            </>
          ) : (
            <RowMenu label="File actions">
              <DropdownMenuItem onSelect={() => actions.renameResource(id)}>
                <PencilIcon /> Rename…
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => actions.deleteResource(id)}
              >
                <Trash2Icon /> Move to trash…
              </DropdownMenuItem>
            </RowMenu>
          ),
      }}
      onOpenProject={() => undefined}
      onNavigate={() => undefined}
      destinations={[]}
      onAddSubject={actions.addSubject}
      sections={{ subjects: subjectsOpen, projects: false }}
      onSectionToggle={(section, open) => {
        if (section === "subjects") setSubjectsOpen(open);
      }}
      footer={
        <Button
          variant="subtle"
          className="w-full justify-start"
          onClick={actions.openSettings}
        >
          <SettingsIcon /> Settings
        </Button>
      }
    />
  );
}
