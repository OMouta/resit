import { Button } from "@resit/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@resit/ui/components/dropdown-menu";
import { shortcutLabel } from "@resit/ui/lib/keys";
import {
  CopyIcon,
  FolderInputIcon,
  MoreHorizontalIcon,
  PencilIcon,
  StarIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";

import type { ExamplePage } from "../../viewer/types";

const keys = (combo: string) => shortcutLabel(combo).join("");

function ViewMenu({ log }: { log: (e: string, p?: unknown) => void }) {
  const [thumbnails, setThumbnails] = useState(true);
  const [outline, setOutline] = useState(false);
  const [sort, setSort] = useState("modified");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">View</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={thumbnails}
          onCheckedChange={(next) => {
            setThumbnails(next);
            log("thumbnails", next);
          }}
        >
          Page thumbnails
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={outline}
          onCheckedChange={(next) => {
            setOutline(next);
            log("outline", next);
          }}
        >
          Outline
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort}
          onValueChange={(next) => {
            setSort(next);
            log("sort", next);
          }}
        >
          <DropdownMenuRadioItem value="modified">
            Last modified
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="created">
            Date added
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const page: ExamplePage = {
  section: "components",
  slug: "dropdown-menu",
  title: "Dropdown menu",
  description:
    "Actions behind a button. Destructive items go last, after a separator.",
  source: "packages/ui/src/components/dropdown-menu.tsx",
  keywords: ["menu", "actions", "overflow", "more"],
  examples: [
    {
      id: "actions",
      title: "Row actions",
      width: "auto",
      render: ({ log }) => (
        <DropdownMenu onOpenChange={(open) => log("onOpenChange", open)}>
          <DropdownMenuTrigger asChild>
            <Button variant="subtle" size="icon" aria-label="More actions">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => log("rename")}>
                <PencilIcon />
                Rename
                <DropdownMenuShortcut>{keys("Enter")}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => log("duplicate")}>
                <CopyIcon />
                Duplicate
                <DropdownMenuShortcut>{keys("Mod+D")}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => log("star")}>
                <StarIcon />
                Add to favourites
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInputIcon />
                Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {["Mathematics", "Programming", "Physics"].map((subject) => (
                  <DropdownMenuItem
                    key={subject}
                    onSelect={() => log("move", subject)}
                  >
                    {subject}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => log("move", null)}>
                  Unsorted
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem disabled>
              Export as PDF
              <DropdownMenuShortcut>Soon</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => log("trash")}
            >
              <TrashIcon />
              Move to trash
              <DropdownMenuShortcut>
                {keys("Mod+Backspace")}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
    {
      id: "checkbox-radio",
      title: "Checkbox and radio items",
      width: "auto",
      render: ({ log, resetKey }) => <ViewMenu key={resetKey} log={log} />,
    },
    {
      id: "long",
      title: "Long menu",
      description: "Scrolls when taller than the available space.",
      width: "auto",
      render: ({ log }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Open recent</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 w-72">
            {Array.from({ length: 24 }, (_, i) => (
              <DropdownMenuItem key={i} onSelect={() => log("open", i)}>
                <span className="truncate">
                  {i % 3 === 0
                    ? `Lecture ${i + 1} — Limits and continuity of piecewise functions.pdf`
                    : `Worksheet ${i + 1}.pdf`}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
    {
      id: "playground",
      title: "Playground",
      width: "auto",
      controls: {
        align: {
          type: "select",
          options: ["start", "center", "end"],
          default: "start",
        },
        side: {
          type: "select",
          options: ["bottom", "top", "right", "left"],
          default: "bottom",
        },
      },
      render: ({ controls, log }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Options</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={controls.align as "start" | "center" | "end"}
            side={controls.side as "bottom" | "top" | "right" | "left"}
          >
            <DropdownMenuItem onSelect={() => log("rename")}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => log("duplicate")}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem inset onSelect={() => log("inset")}>
              Inset item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ],
};
