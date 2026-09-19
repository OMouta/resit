import {
  CheckIcon,
  ChevronsUpDownIcon,
  FolderOpenIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@resit/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { cn } from "@resit/ui/lib/utils";

export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
}

export interface WorkspaceSwitcherProps {
  workspace: WorkspaceSummary;
  /** Recently opened workspaces. The current one is filtered out. */
  recent: WorkspaceSummary[];
  /** The workspace folder cannot be written to. */
  readOnly?: boolean;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onOpenFolder: () => void;
  className?: string;
}

/**
 * Sidebar header: current workspace with a menu of recent workspaces plus
 * "Create workspace" and "Open folder".
 */
export function WorkspaceSwitcher({
  workspace,
  recent,
  readOnly = false,
  onSwitch,
  onCreate,
  onOpenFolder,
  className,
}: WorkspaceSwitcherProps) {
  const others = recent.filter((entry) => entry.id !== workspace.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-slot="workspace-switcher"
        className={cn(
          "flex h-control-lg w-full min-w-0 items-center gap-2.5 rounded-control px-2 text-left text-sm outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:shadow-focus data-[state=open]:bg-accent",
          className,
        )}
        title={workspace.path}
      >
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/[0.07] text-xs font-semibold text-foreground/80"
        >
          {Array.from(workspace.name.trim())[0]?.toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate font-semibold">{workspace.name}</span>
          {readOnly ? <Badge variant="muted">Read-only</Badge> : null}
        </span>
        <ChevronsUpDownIcon
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Recent</DropdownMenuLabel>
        <DropdownMenuItem disabled className="justify-between">
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{workspace.name}</span>
            <span className="truncate text-2xs text-subtle-foreground">
              {workspace.path}
            </span>
          </span>
          <CheckIcon aria-label="Current workspace" />
        </DropdownMenuItem>
        {others.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-subtle-foreground">
            No other recent workspaces
          </div>
        ) : (
          others.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              onSelect={() => onSwitch(entry.id)}
              title={entry.path}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{entry.name}</span>
                <span className="truncate text-2xs text-subtle-foreground">
                  {entry.path}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCreate}>
          <PlusIcon />
          Create workspace
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenFolder}>
          <FolderOpenIcon />
          Open folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
