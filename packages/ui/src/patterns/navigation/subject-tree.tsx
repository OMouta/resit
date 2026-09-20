import {
  AlertTriangleIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  GraduationCapIcon,
  ImageIcon,
  LinkIcon,
  PaperclipIcon,
} from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type ComponentProps,
  type DragEvent,
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

export interface TreeFolder {
  /** Folder path inside the subject. Also its label. */
  path: string;
  /** Filled from a course elsewhere, such as Moodle: nothing is added by hand. */
  linked?: string;
}

export interface TreeSubject {
  id: string;
  name: string;
  color: SubjectColor;
  archived?: boolean;
  /** Shows the subject follows a course somewhere else, such as Moodle. */
  linked?: string;
  /** Folders to show, including empty ones. Folders holding resources are
   * listed whether or not they appear here. */
  folders?: TreeFolder[];
  resources: TreeResource[];
}

/** A row the caller can act on: what it is, and what it belongs to. */
export type TreeRow =
  | { kind: "subject"; id: string }
  | { kind: "resource"; id: string }
  | { kind: "folder"; id: string; subjectId: string; folder: TreeFolder };

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
  renderActions?: (row: TreeRow) => ReactNode;
  /**
   * Dragging files and folders onto subjects and folders. Without it, rows
   * do not pick up.
   */
  move?: {
    canDrop: (dragged: TreeRow, target: TreeRow) => boolean;
    onMove: (dragged: TreeRow, target: TreeRow) => void;
  };
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

interface FolderNode {
  folder: TreeFolder;
  items: TreeResource[];
  children: FolderNode[];
  /** Everything inside, counting what the folders below it hold. */
  total: number;
}

/** The folder's own name, without the folders it sits in. */
function folderLabel(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Folders as a tree, with the loose resources of the subject beside it. */
function groupByFolder(subject: TreeSubject) {
  const nodes = new Map<string, FolderNode>();
  const tree: FolderNode[] = [];

  const ensure = (path: string): FolderNode => {
    const existing = nodes.get(path);
    if (existing) return existing;
    const node: FolderNode = {
      folder: { path },
      items: [],
      children: [],
      total: 0,
    };
    nodes.set(path, node);
    const at = path.lastIndexOf("/");
    if (at === -1) tree.push(node);
    else ensure(path.slice(0, at)).children.push(node);
    return node;
  };

  for (const folder of subject.folders ?? [])
    ensure(folder.path).folder = folder;
  const roots: TreeResource[] = [];
  for (const resource of subject.resources) {
    if (resource.folder) ensure(resource.folder).items.push(resource);
    else roots.push(resource);
  }

  const order = (nodes: FolderNode[]) =>
    nodes.sort((a, b) =>
      folderLabel(a.folder.path).localeCompare(folderLabel(b.folder.path)),
    );
  const count = (node: FolderNode): number => {
    order(node.children);
    node.total =
      node.items.length +
      node.children.reduce((total, child) => total + count(child), 0);
    return node.total;
  };
  order(tree).forEach(count);
  return { roots, tree };
}

/** What the tree puts on a row to make it draggable and droppable. */
type DragHandlers = Pick<
  ComponentProps<"div">,
  | "draggable"
  | "onDragStart"
  | "onDragOver"
  | "onDragLeave"
  | "onDrop"
  | "onDragEnd"
>;

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
  drag?: DragHandlers | undefined;
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
  drag,
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
      {...drag}
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
        "group/row relative flex h-row w-full cursor-pointer items-center gap-1.5 rounded-md pr-1 text-sm outline-none select-none",
        "hover:bg-accent focus-visible:shadow-focus",
        selected && "group-focus-within/tree:bg-accent",
        active && "bg-accent font-medium text-foreground",
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

/** Says a subject or folder has nothing in it, lined up with its rows. */
function EmptyRow({ level, children }: { level: number; children: ReactNode }) {
  return (
    <div
      role="none"
      className="flex h-row items-center text-xs text-subtle-foreground"
      style={{ paddingLeft: `${(level - 1) * 14 + 26}px` }}
    >
      {children}
    </div>
  );
}

/**
 * Sidebar tree of subjects, folders, and resources. One tab stop; arrows
 * move, Left/Right collapse/expand, Enter opens, typing jumps by title.
 * Alt+Up/Down reorders subjects when `onMoveSubject` is given. With `move`,
 * files and folders drag onto subjects and folders.
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
  move,
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

  const [picked, setPicked] = useState<TreeRow | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const dragged = draggingId ?? picked?.id;
  const target = dropTargetId ?? over;

  /** Drag handlers for one row, or nothing when the tree cannot move rows. */
  const dragging = (row: TreeRow): DragHandlers | undefined => {
    if (!move) return undefined;
    const allowed = (event: DragEvent<HTMLDivElement>) => {
      if (!picked || picked.id === row.id) return false;
      // A drop target needs the row it started on, which only React state
      // carries: the drag data is not readable until the drop itself.
      event.dataTransfer.dropEffect = "move";
      return move.canDrop(picked, row);
    };
    return {
      draggable: row.kind !== "subject",
      onDragStart: (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.id);
        setPicked(row);
      },
      onDragOver: (event) => {
        if (!allowed(event)) return;
        event.preventDefault();
        setOver(row.id);
      },
      onDragLeave: () =>
        setOver((current) => (current === row.id ? null : current)),
      onDrop: (event) => {
        event.preventDefault();
        if (picked && allowed(event)) move.onMove(picked, row);
        setPicked(null);
        setOver(null);
      },
      onDragEnd: () => {
        setPicked(null);
        setOver(null);
      },
    };
  };

  return (
    <div
      ref={ref}
      role="tree"
      aria-label="Subjects"
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      className={cn("group/tree flex flex-col gap-px px-2", className)}
    >
      {subjects.map((subject) => {
        const expanded = expandedIds.has(subject.id);
        const colors = subjectColorClasses[subject.color];
        const { roots, tree } = groupByFolder(subject);
        const count = subject.resources.length;
        const renderResource = (resource: TreeResource, level: number) => {
          const Icon = kindIcons[resource.kind];
          const row: TreeRow = { kind: "resource", id: resource.id };
          return (
            <TreeRow
              key={resource.id}
              id={resource.id}
              level={level}
              selected={current === resource.id}
              active={activeResourceId === resource.id}
              dragging={dragged === resource.id}
              onSelect={() => select(resource.id)}
              onActivate={() => onOpenResource(resource.id)}
              typeahead={resource.title}
              label={`${resource.title}${resource.missing ? ", missing" : ""}${resource.dirty ? ", unsaved changes" : ""}`}
              actions={renderActions?.(row)}
              drag={dragging(row)}
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

        const renderFolder = (node: FolderNode, level: number) => {
          const id = `${subject.id}/folder/${node.folder.path}`;
          const open = expandedIds.has(id);
          const row: TreeRow = {
            kind: "folder",
            id,
            subjectId: subject.id,
            folder: node.folder,
          };
          const name = folderLabel(node.folder.path);
          return (
            <div key={id} role="group" className="flex flex-col gap-px">
              <TreeRow
                id={id}
                level={level}
                selected={current === id}
                expanded={open}
                dropTarget={target === id}
                dragging={dragged === id}
                onSelect={() => select(id)}
                onToggle={() => onExpandedChange(id, !open)}
                typeahead={name}
                label={`${name} folder${node.folder.linked ? `, ${node.folder.linked}` : ""}, ${node.total} items`}
                actions={renderActions?.(row)}
                drag={dragging(row)}
              >
                <FolderIcon className="size-4 shrink-0 text-subtle-foreground" />
                <span className="min-w-0 truncate" title={name}>
                  {name}
                </span>
                {node.folder.linked ? (
                  <GraduationCapIcon
                    className="size-3.5 shrink-0 text-subtle-foreground"
                    aria-hidden
                  />
                ) : null}
                <span className="flex-1" />
                <span className="shrink-0 text-2xs tabular-nums text-subtle-foreground group-hover/row:hidden group-has-[[data-state=open]]/row:hidden">
                  {node.total}
                </span>
              </TreeRow>
              {open ? (
                node.children.length === 0 && node.items.length === 0 ? (
                  <EmptyRow level={level + 1}>Nothing in here yet</EmptyRow>
                ) : (
                  <>
                    {node.children.map((child) =>
                      renderFolder(child, level + 1),
                    )}
                    {node.items.map((item) => renderResource(item, level + 1))}
                  </>
                )
              ) : null}
            </div>
          );
        };

        return (
          <div key={subject.id} role="group" className="flex flex-col gap-px">
            <TreeRow
              id={subject.id}
              level={1}
              selected={current === subject.id}
              expanded={expanded}
              dropTarget={target === subject.id}
              dragging={dragged === subject.id}
              onSelect={() => select(subject.id)}
              onToggle={() => onExpandedChange(subject.id, !expanded)}
              typeahead={subject.name}
              label={`${subject.name}${subject.archived ? ", archived" : ""}${subject.linked ? `, ${subject.linked}` : ""}, ${count} resources`}
              actions={renderActions?.({ kind: "subject", id: subject.id })}
              drag={dragging({ kind: "subject", id: subject.id })}
              className={cn(
                "font-medium",
                subject.archived && "text-muted-foreground",
              )}
            >
              <span
                className={cn("size-2 shrink-0 rounded-full", colors.dot)}
                aria-hidden
              />
              <span className="min-w-0 truncate" title={subject.name}>
                {subject.name}
              </span>
              {subject.linked ? (
                <LinkIcon
                  className="size-3 shrink-0 text-subtle-foreground"
                  aria-hidden
                />
              ) : null}
              <span className="flex-1" />
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
                {count === 0 && tree.length === 0 ? (
                  <EmptyRow level={2}>No resources yet</EmptyRow>
                ) : null}
                {tree.map((node) => renderFolder(node, 2))}
                {roots.map((item) => renderResource(item, 2))}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
