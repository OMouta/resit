import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@resit/ui/components/context-menu";
import { shortcutLabel } from "@resit/ui/lib/keys";
import {
  FileTextIcon,
  FolderInputIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";

import type { ExamplePage } from "../../viewer/types";

const keys = (combo: string) => shortcutLabel(combo).join("");

export const page: ExamplePage = {
  section: "components",
  slug: "context-menu",
  title: "Context menu",
  description:
    "Right-click actions on rows, pages, and selections. Every item here must also be reachable from a visible control.",
  source: "packages/ui/src/components/context-menu.tsx",
  keywords: ["right click", "menu", "actions"],
  examples: [
    {
      id: "row",
      title: "File row",
      description: "Right-click (or Shift+F10) the row.",
      width: 320,
      render: ({ log }) => (
        <ContextMenu onOpenChange={(open) => log("onOpenChange", open)}>
          <ContextMenuTrigger asChild>
            <div
              tabIndex={0}
              className="m-2 flex h-row items-center gap-2 rounded-md px-2 text-sm hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none"
            >
              <FileTextIcon className="size-4 text-muted-foreground" />
              <span className="truncate">Lecture 4 — Limits.pdf</span>
              <span className="ml-auto text-xs text-subtle-foreground">
                214 pages
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            <ContextMenuItem onSelect={() => log("open")}>
              Open
              <ContextMenuShortcut>{keys("Enter")}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => log("open-side")}>
              Open to the side
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => log("rename")}>
              <PencilIcon />
              Rename
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <FolderInputIcon />
                Move to
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {["Mathematics", "Programming", "Physics"].map((subject) => (
                  <ContextMenuItem
                    key={subject}
                    onSelect={() => log("move", subject)}
                  >
                    {subject}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem disabled>Show in Explorer</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onSelect={() => log("trash")}
            >
              <TrashIcon />
              Move to trash
              <ContextMenuShortcut>{keys("Mod+Backspace")}</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ),
    },
    {
      id: "canvas",
      title: "Page area with view options",
      width: "full",
      height: 220,
      render: ({ log }) => (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
              Right-click anywhere on the page
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuLabel>Zoom</ContextMenuLabel>
            <ContextMenuRadioGroup
              defaultValue="fit-width"
              onValueChange={(v) => log("zoom", v)}
            >
              <ContextMenuRadioItem value="fit-width">
                Fit width
              </ContextMenuRadioItem>
              <ContextMenuRadioItem value="fit-page">
                Fit page
              </ContextMenuRadioItem>
              <ContextMenuRadioItem value="100">100%</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem
              defaultChecked
              onCheckedChange={(v) => log("highlights", v)}
            >
              Show highlights
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem onCheckedChange={(v) => log("notes", v)}>
              Show note markers
            </ContextMenuCheckboxItem>
          </ContextMenuContent>
        </ContextMenu>
      ),
    },
  ],
};
