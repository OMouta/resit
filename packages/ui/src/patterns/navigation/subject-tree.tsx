import {
  AlertTriangleIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  PaperclipIcon,
} from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { useRovingFocus } from "@resit/ui/hooks/use-roving-focus";
import {
  subjectColorClasses,
  type SubjectColor,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

export type TreeResourceKind = "note" | "pdf" | "image" | "attachment";

export interface TreeResource {
  id: string;
  kind: TreeResourceKind;
  title: string;
  /** Folder path segments inside the subject, for nesting. */
  folder?: string;
  dirty?: boolean;
  missing?: boolean;
}

export interface TreeSubject {
  id: string;
  name: string;
  color: SubjectColor;
  archived?: boolean;
  resources: TreeResource[];
}

export interface SubjectTreeProps {
  subjects: TreeSubject[];
  expandedIds: ReadonlySet<string>;
  onExpandedChange: (id: string, expanded: boolean) => void;
  /** Resource open in the focused pane. */
  activeResourceId?: string | undefined;
  /** Row with keyboard/mouse selection. */
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
  onOpenResource: (resourceId: string) => void;
  onMoveSubject?: (subjectId: string, direction: -1 | 1) => void;
  /** Row actions shown on hover and focus. */
  renderActions?: (row: {
    kind: "subject" | "resource";
    id: string;
  }) => ReactNode;
  /** Drop target id while dragging. Caller owns the drag state. */
  dropTargetId?: string | undefined;
  draggingId?: string | undefined;
  className?: string;
}

const kindIcons: Record<TreeResourceKind, typeof FileTextIcon> = {
  note: FileTextIcon,
  pdf: FileTextIcon,
  image: ImageIcon,
  attachment: PaperclipIcon,
};

function groupByFolder(resources: TreeResource[]) {
  const roots: TreeResource[] = [];
  const folders = new Map<string, TreeResource[]>();
  for (const resource of resources) {
    if (!resource.folder) roots.push(resource);
    else
      folders.set(resource.folder, [
        ...(folders.get(resource.folder) ?? []),
        resource,
      ]);
  }
  return { roots, folders };
}

interface RowProps {
  id: string;
  level: number;
  selected: boolean;
  active?: boolean;
  expanded?: boolean;
  dropTarget?: boolean;
  dragging?: boolean;
  onSelect: () => void;
  onActivate?: () => void;
  onToggle?: () => void;
  actions?: ReactNode;
  typeahead: string;
  children: ReactNode;
  className?: string;
  label?: string;
}

function TreeRow({
  id,
  level,
  selected,
  active,
  expanded,
  dropTarget,
  dragging,
  onSelect,
  onActivate,
  onToggle,
  actions,
  typeahead,
  children,
  className,
  label,
}: RowProps) {
  return (
    <div
      role="treeitem"
      data-tree-item
      data-id={id}
      data-typeahead={typeahead}
      aria-level={level}
      aria-selected={selected}
      aria-expanded={expanded}
      aria-label={label}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onDoubleClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (onActivate) onActivate();
          else onToggle?.();
        }
      }}
      className={cn(
        "group/row relative flex h-row w-full cursor-default items-center gap-1.5 rounded-md pr-1 text-sm outline-none select-none",
        "hover:bg-accent focus-visible:shadow-focus",
        selected && "bg-accent",
        active && "font-medium text-foreground",
        !active && "text-foreground/85",
        dragging && "opacity-40",
        dropTarget && "bg-selection ring-1 ring-ring/50 ring-inset",
        className,
      )}
      style={{ paddingLeft: `${(level - 1) * 14 + 6}px` }}
    >
      {onToggle ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-subtle-foreground hover:bg-control-active hover:text-foreground"
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 transition-transform duration-(--duration-fast)",
              expanded && "rotate-90",
            )}
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}
      {children}
      {actions ? (
        <span className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover/row:flex group-focus-within/row:flex has-[[data-state=open]]:flex">
          {actions}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Sidebar tree of subjects, folders, and resources. One tab stop; arrows
 * move, Left/Right collapse/expand, Enter opens, typing jumps by title.
 * Alt+Up/Down reorders subjects when `onMoveSubject` is given.
 */
export function SubjectTree({
  subjects,
  expandedIds,
  onExpandedChange,
  activeResourceId,
  selectedId,
  onSelect,
  onOpenResource,
  onMoveSubject,
  renderActions,
  dropTargetId,
  draggingId,
  className,
}: SubjectTreeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [internalSelected, setInternalSelected] = useState<string | undefined>(
    () => selectedId ?? subjects[0]?.id,
  );
  const current = selectedId ?? internalSelected;

  const select = useCallback(
    (id: string) => {
      setInternalSelected(id);
      onSelect(id);
    },
    [onSelect],
  );

  const isExpandable = (id: string) =>
    subjects.some((subject) => subject.id === id) || id.includes("/folder/");

  const { onKeyDown } = useRovingFocus(ref, {
    itemSelector: "[data-tree-item]",
    onExpand: (item) => {
      const id = item.dataset.id;
      if (id && isExpandable(id)) {
        if (!expandedIds.has(id)) onExpandedChange(id, true);
        else {
          const next = item.nextElementSibling as HTMLElement | null;
          if (next?.dataset.treeItem !== undefined) next.focus();
        }
      }
    },
    onCollapse: (item) => {
      const id = item.dataset.id;
      if (!id) return;
      if (isExpandable(id) && expandedIds.has(id)) onExpandedChange(id, false);
      else {
        const level = Number(item.getAttribute("aria-level"));
        let previous = item.previousElementSibling as HTMLElement | null;
        while (previous && Number(previous.getAttribute("aria-level")) >= level)
          previous = previous.previousElementSibling as HTMLElement | null;
        previous?.focus();
      }
    },
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.altKey &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      const item = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-tree-item]",
      );
      const id = item?.dataset.id;
      if (
        id &&
        onMoveSubject &&
        subjects.some((subject) => subject.id === id)
      ) {
        event.preventDefault();
        onMoveSubject(id, event.key === "ArrowUp" ? -1 : 1);
        return;
      }
    }
    onKeyDown(event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-tree-item]",
    );
    const id = item?.dataset.id;
    if (id && id !== current) {
      setInternalSelected(id);
    }
  };

  return (
    <div
      ref={ref}
      role="tree"
      aria-label="Subjects"
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      className={cn("flex flex-col gap-px px-2", className)}
    >
      {subjects.map((subject) => {
        const expanded = expandedIds.has(subject.id);
        const colors = subjectColorClasses[subject.color];
        const { roots, folders } = groupByFolder(subject.resources);
        const count = subject.resources.length;
        const renderResource = (resource: TreeResource, level: number) => {
          const Icon = kindIcons[resource.kind];
          return (
            <TreeRow
              key={resource.id}
              id={resource.id}
              level={level}
              selected={current === resource.id}
              active={activeResourceId === resource.id}
              dragging={draggingId === resource.id}
              onSelect={() => select(resource.id)}
              onActivate={() => onOpenResource(resource.id)}
              typeahead={resource.title}
              label={`${resource.title}${resource.missing ? ", missing" : ""}${resource.dirty ? ", unsaved changes" : ""}`}
              actions={renderActions?.({ kind: "resource", id: resource.id })}
              className={cn(resource.missing && "text-muted-foreground")}
            >
              {resource.missing ? (
                <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
              ) : (
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    resource.kind === "pdf"
                      ? "text-destructive/70"
                      : "text-subtle-foreground",
                  )}
                />
              )}
              <span className="min-w-0 flex-1 truncate" title={resource.title}>
                {resource.title}
              </span>
              {resource.dirty ? (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-foreground/70"
                  title="Unsaved changes"
                />
              ) : null}
              {resource.missing ? (
                <span className="shrink-0 text-2xs text-warning">Missing</span>
              ) : null}
            </TreeRow>
          );
        };

        return (
          <div key={subject.id} role="group" className="flex flex-col gap-px">
            <TreeRow
              id={subject.id}
              level={1}
              selected={current === subject.id}
              expanded={expanded}
              dropTarget={dropTargetId === subject.id}
              dragging={draggingId === subject.id}
              onSelect={() => select(subject.id)}
              onToggle={() => onExpandedChange(subject.id, !expanded)}
              typeahead={subject.name}
              label={`${subject.name}${subject.archived ? ", archived" : ""}, ${count} resources`}
              actions={renderActions?.({ kind: "subject", id: subject.id })}
              className={cn(
                "font-medium",
                subject.archived && "text-muted-foreground",
              )}
            >
              <span
                className={cn("size-2 shrink-0 rounded-full", colors.dot)}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate" title={subject.name}>
                {subject.name}
              </span>
              {subject.archived ? (
                <span className="shrink-0 text-2xs font-normal text-subtle-foreground">
                  Archived
                </span>
              ) : null}
              <span className="shrink-0 text-2xs font-normal tabular-nums text-subtle-foreground group-hover/row:hidden group-has-[[data-state=open]]/row:hidden">
                {count}
              </span>
            </TreeRow>
            {expanded ? (
              <>
                {count === 0 ? (
                  <div
                    role="none"
                    className="flex h-row items-center pl-[34px] text-xs text-subtle-foreground"
                  >
                    No resources yet
                  </div>
                ) : null}
                {Array.from(folders.entries()).map(([folder, items]) => {
                  const folderId = `${subject.id}/folder/${folder}`;
                  const folderOpen = expandedIds.has(folderId);
                  return (
                    <div
                      key={folderId}
                      role="group"
                      className="flex flex-col gap-px"
                    >
                      <TreeRow
                        id={folderId}
                        level={2}
                        selected={current === folderId}
                        expanded={folderOpen}
                        onSelect={() => select(folderId)}
                        onToggle={() => onExpandedChange(folderId, !folderOpen)}
                        typeahead={folder}
                        label={`${folder} folder, ${items.length} items`}
                      >
                        <FolderIcon className="size-4 shrink-0 text-subtle-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {folder}
                        </span>
                        <span className="shrink-0 text-2xs tabular-nums text-subtle-foreground">
                          {items.length}
                        </span>
                      </TreeRow>
                      {folderOpen
                        ? items.map((item) => renderResource(item, 3))
                        : null}
                    </div>
                  );
                })}
                {roots.map((item) => renderResource(item, 2))}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
