import {
  BookOpenIcon,
  CalendarIcon,
  FolderKanbanIcon,
  LibraryIcon,
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
  UserRoundIcon,
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
import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherProps,
} from "@resit/ui/patterns/navigation/workspace-switcher";

export type SidebarDestination =
  "library" | "study" | "calendar" | "profile" | "conversations" | "trash";

export interface SidebarProject {
  id: string;
  name: string;
  subjects: ProjectRowSubject[];
  resourceCount: number;
}

export interface WorkspaceSidebarProps {
  switcher: WorkspaceSwitcherProps;
  tree: SubjectTreeProps;
  projects: SidebarProject[];
  activeProjectId?: string | undefined;
  onOpenProject: (id: string) => void;
  activeDestination?: SidebarDestination | undefined;
  onNavigate: (destination: SidebarDestination) => void;
  counts?: Partial<Record<SidebarDestination, number>>;
  onAddSubject?: () => void;
  onAddProject?: () => void;
  /** Section open/closed state. */
  sections: { subjects: boolean; projects: boolean };
  onSectionToggle: (
    section: "subjects" | "projects",
    expanded: boolean,
  ) => void;
  footer?: ReactNode;
  className?: string;
}

const destinations: {
  id: SidebarDestination;
  label: string;
  icon: typeof LibraryIcon;
}[] = [
  { id: "library", label: "Library", icon: LibraryIcon },
  { id: "study", label: "Study", icon: BookOpenIcon },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
  { id: "profile", label: "Learner profile", icon: UserRoundIcon },
  { id: "conversations", label: "Conversations", icon: MessageSquareIcon },
  { id: "trash", label: "Trash", icon: Trash2Icon },
];

/** The whole left sidebar: workspace, subjects tree, projects, destinations. */
export function WorkspaceSidebar({
  switcher,
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
      <div className="px-2 pt-2">
        <WorkspaceSwitcher {...switcher} />
      </div>
      <div className="scrollbar-thin mt-2 min-h-0 flex-1 overflow-y-auto pb-4">
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
          <div className="flex flex-col gap-px px-1">
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
        <div className="mt-3 flex flex-col gap-px px-1">
          {destinations.map(({ id, label, icon: Icon }) => (
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
      {footer ? <div className="border-t px-2 py-2">{footer}</div> : null}
      <FolderKanbanIcon className="hidden" aria-hidden />
    </div>
  );
}
