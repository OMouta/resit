import {
  BookOpenIcon,
  CalendarIcon,
  FolderKanbanIcon,
  LibraryIcon,
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
  UserRoundIcon,
  WaypointsIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { cn } from "@resit/ui/lib/utils";
import {
  ProjectRow,
  type ProjectRowSubject,
} from "@resit/ui/patterns/navigation/project-row";
import {
  SidebarNavItem,
  SidebarSection,
} from "@resit/ui/patterns/navigation/sidebar-sections";
import {
  SubjectTree,
  type SubjectTreeProps,
} from "@resit/ui/patterns/navigation/subject-tree";

export type SidebarDestination =
  | "graph"
  | "library"
  | "study"
  | "calendar"
  | "profile"
  | "conversations"
  | "trash";

export interface SidebarProject {
  id: string;
  name: string;
  subjects: ProjectRowSubject[];
  resourceCount: number;
}

export interface WorkspaceSidebarProps {
  tree: SubjectTreeProps;
  /** Omit to hide the Projects section. */
  projects?: SidebarProject[];
  activeProjectId?: string | undefined;
  onOpenProject: (id: string) => void;
  activeDestination?: SidebarDestination | undefined;
  onNavigate: (destination: SidebarDestination) => void;
  counts?: Partial<Record<SidebarDestination, number>>;
  onAddSubject?: () => void;
  onAddProject?: () => void;
  /** Section open/closed state. */
  sections: { subjects: boolean; projects: boolean };
  /** Destinations to list below the sections. Defaults to all of them. */
  destinations?: readonly SidebarDestination[];
  onSectionToggle: (
    section: "subjects" | "projects",
    expanded: boolean,
  ) => void;
  footer?: ReactNode;
  className?: string;
}

const allDestinations: {
  id: SidebarDestination;
  label: string;
  icon: typeof LibraryIcon;
}[] = [
  { id: "graph", label: "Graph", icon: WaypointsIcon },
  { id: "library", label: "Library", icon: LibraryIcon },
  { id: "study", label: "Study", icon: BookOpenIcon },
  { id: "calendar", label: "Schedule", icon: CalendarIcon },
  { id: "profile", label: "Learner profile", icon: UserRoundIcon },
  { id: "conversations", label: "Conversations", icon: MessageSquareIcon },
  { id: "trash", label: "Trash", icon: Trash2Icon },
];

/** The whole left sidebar: subjects tree, projects, destinations. */
export function WorkspaceSidebar({
  tree,
  projects,
  activeProjectId,
  onOpenProject,
  activeDestination,
  onNavigate,
  counts,
  onAddSubject,
  onAddProject,
  sections,
  onSectionToggle,
  destinations,
  footer,
  className,
}: WorkspaceSidebarProps) {
  return (
    <div
      data-slot="workspace-sidebar"
      className={cn(
        "flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-2">
        <SidebarSection
          title="Subjects"
          count={tree.subjects.filter((subject) => !subject.archived).length}
          expanded={sections.subjects}
          onToggle={(expanded) => onSectionToggle("subjects", expanded)}
          action={
            onAddSubject ? (
              <Button
                variant="subtle"
                size="icon-sm"
                aria-label="Add subject"
                onClick={onAddSubject}
              >
                <PlusIcon />
              </Button>
            ) : undefined
          }
        >
          <SubjectTree {...tree} />
        </SidebarSection>
        {projects ? (
          <SidebarSection
            title="Projects"
            count={projects.length}
            expanded={sections.projects}
            onToggle={(expanded) => onSectionToggle("projects", expanded)}
            action={
              onAddProject ? (
                <Button
                  variant="subtle"
                  size="icon-sm"
                  aria-label="Add project"
                  onClick={onAddProject}
                >
                  <PlusIcon />
                </Button>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-px px-2">
              {projects.length === 0 ? (
                <p className="flex h-row items-center pl-6 text-xs text-subtle-foreground">
                  No projects yet
                </p>
              ) : null}
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  name={project.name}
                  subjects={project.subjects}
                  resourceCount={project.resourceCount}
                  active={project.id === activeProjectId}
                  onClick={() => onOpenProject(project.id)}
                />
              ))}
            </div>
          </SidebarSection>
        ) : null}
        <div className="mt-3 flex flex-col gap-px px-2">
          {allDestinations
            .filter(({ id }) => !destinations || destinations.includes(id))
            .map(({ id, label, icon: Icon }) => (
              <SidebarNavItem
                key={id}
                icon={<Icon />}
                label={label}
                active={activeDestination === id}
                onClick={() => onNavigate(id)}
                {...(counts?.[id] !== undefined ? { count: counts[id] } : {})}
              />
            ))}
        </div>
      </div>
      {footer ? <div className="border-t px-3 py-3">{footer}</div> : null}
      <FolderKanbanIcon className="hidden" aria-hidden />
    </div>
  );
}
