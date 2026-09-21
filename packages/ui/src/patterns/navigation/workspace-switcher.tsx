import {
  ArchiveIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
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
import { useLocale } from "@resit/ui/hooks/use-locale";
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
  /** Opens a workspace exported as a .resit archive. */
  onOpenArchive?: () => void;
  /** Exports this workspace as a .resit archive. */
  onExport?: () => void;
  className?: string;
}

/**
 * Title bar root: current workspace with a menu of recent workspaces plus
 * "Create workspace" and "Open folder".
 */
export function WorkspaceSwitcher({
  workspace,
  recent,
  readOnly = false,
  onSwitch,
  onCreate,
  onOpenFolder,
  onOpenArchive,
  onExport,
  className,
}: WorkspaceSwitcherProps) {
  const { t } = useLocale();
  const others = recent.filter((entry) => entry.id !== workspace.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-slot="workspace-switcher"
        className={cn(
          "flex h-control min-w-0 max-w-56 items-center gap-1.5 rounded-control px-2 text-left text-sm font-medium text-foreground outline-none transition-colors duration-(--duration-fast) hover:bg-accent focus-visible:shadow-focus data-[state=open]:bg-accent",
          className,
        )}
        title={workspace.path}
      >
        <span className="truncate">{workspace.name}</span>
        {readOnly ? <Badge variant="muted">{t("Read-only")}</Badge> : null}
        <ChevronDownIcon
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t("Recent")}</DropdownMenuLabel>
        <DropdownMenuItem disabled className="justify-between">
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{workspace.name}</span>
            <span className="truncate text-2xs text-subtle-foreground">
              {workspace.path}
            </span>
          </span>
          <CheckIcon aria-label={t("Current workspace")} />
        </DropdownMenuItem>
        {others.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-subtle-foreground">
            {t("No other recent workspaces")}
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
          {t("Create workspace")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenFolder}>
          <FolderOpenIcon />
          {t("Open folder")}
        </DropdownMenuItem>
        {onOpenArchive ? (
          <DropdownMenuItem onSelect={onOpenArchive}>
            <ArchiveIcon />
            {t("Open .resit archive")}
          </DropdownMenuItem>
        ) : null}
        {onExport ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onExport}>
              <DownloadIcon />
              {t("Export workspace…")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
