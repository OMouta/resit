import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { InlineMessage } from "@resit/ui/components/inline-message";
import { Kbd } from "@resit/ui/components/kbd";
import { Progress } from "@resit/ui/components/progress";
import { Skeleton } from "@resit/ui/components/skeleton";
import {
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
} from "@resit/ui/components/toggle-group";
import { shortcutLabel } from "@resit/ui/lib/keys";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  FolderPlusIcon,
  ItalicIcon,
  SearchXIcon,
} from "lucide-react";

import type { ExamplePage } from "../../viewer/types";

export const page: ExamplePage = {
  section: "components",
  slug: "status",
  title: "Badges, progress, messages",
  description:
    "Small status primitives: badges, keyboard hints, skeletons, progress bars, inline messages, empty states, and toggles.",
  source: "packages/ui/src/components/inline-message.tsx",
  keywords: [
    "badge",
    "kbd",
    "skeleton",
    "progress",
    "empty",
    "message",
    "toggle",
    "alert",
  ],
  examples: [
    {
      id: "badges",
      title: "Badges",
      width: "auto",
      render: () => (
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Draft</Badge>
          <Badge variant="muted">Archived</Badge>
          <Badge variant="outline">Read-only</Badge>
          <Badge variant="success">Correct</Badge>
          <Badge variant="warning">Overdue</Badge>
          <Badge variant="destructive">Failed</Badge>
          <Badge variant="info">Awaiting review</Badge>
        </div>
      ),
    },
    {
      id: "kbd",
      title: "Keyboard hints",
      description: "Mod becomes ⌘ on macOS and Ctrl elsewhere.",
      width: "auto",
      render: () => (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {["Mod+K", "Mod+Shift+P", "Mod+S", "Escape", "ArrowUp"].map(
            (combo) => (
              <span key={combo} className="flex items-center gap-1">
                {shortcutLabel(combo).map((key, index) => (
                  <Kbd key={index}>{key}</Kbd>
                ))}
              </span>
            ),
          )}
        </div>
      ),
    },
    {
      id: "progress",
      title: "Progress",
      width: 360,
      render: () => (
        <div className="flex flex-col gap-4">
          <Progress value={62} aria-label="Extracting text" />
          <Progress value={100} tone="success" aria-label="Done" />
          <Progress value={30} tone="destructive" aria-label="Failed" />
          <Progress indeterminate aria-label="Hashing" />
        </div>
      ),
    },
    {
      id: "skeleton",
      title: "Skeleton",
      width: 360,
      render: () => (
        <div className="flex gap-3">
          <Skeleton className="size-9 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ),
    },
    {
      id: "messages",
      title: "Inline messages",
      description:
        "Errors say what failed and what to do next; the action lives in the message.",
      width: 480,
      render: (ctx) => (
        <div className="flex flex-col gap-3">
          <InlineMessage tone="info" title="Provider sessions are not exported">
            Reconnect Claude Code on the other computer to continue.
          </InlineMessage>
          <InlineMessage tone="success">
            Worksheet 4 imported into Mathematics.
          </InlineMessage>
          <InlineMessage
            tone="warning"
            title="4 annotations point at a previous revision"
          >
            The PDF changed on disk. Keep them where they are or re-anchor.
          </InlineMessage>
          <InlineMessage
            tone="error"
            title="Could not save Resolution — Worksheet 3"
            actions={
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => ctx.log("retry")}
                >
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => ctx.log("recovery")}
                >
                  Show recovery folder
                </Button>
              </>
            }
          >
            The disk is full. The previous saved version is untouched.
          </InlineMessage>
        </div>
      ),
    },
    {
      id: "empty",
      title: "Empty states",
      width: "full",
      render: (ctx) => (
        <div className="grid gap-4 @md:grid-cols-2">
          <div className="rounded-lg border">
            <EmptyState
              icon={<FolderPlusIcon />}
              title="No subjects yet"
              description="Add a subject to start collecting notes and documents."
              actions={
                <Button size="sm" onClick={() => ctx.log("addSubject")}>
                  Add subject
                </Button>
              }
            />
          </div>
          <div className="rounded-lg border">
            <EmptyState
              icon={<SearchXIcon />}
              title="No results for “ε-δ”"
              description="Try the Portuguese spelling or search inside PDFs."
              size="compact"
            />
          </div>
        </div>
      ),
    },
    {
      id: "toggles",
      title: "Toggles",
      width: "auto",
      render: (ctx) => (
        <div className="flex flex-wrap items-center gap-4">
          <Toggle
            aria-label="Bold"
            onPressedChange={(pressed) => ctx.log("bold", pressed)}
          >
            <BoldIcon />
          </Toggle>
          <Toggle aria-label="Italic" variant="outline" defaultPressed>
            <ItalicIcon />
          </Toggle>
          <ToggleGroup
            type="single"
            defaultValue="left"
            variant="outline"
            aria-label="Alignment"
            onValueChange={(value) => ctx.log("align", value)}
          >
            <ToggleGroupItem value="left" aria-label="Align left">
              <AlignLeftIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align centre">
              <AlignCenterIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right">
              <AlignRightIcon />
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="multiple"
            defaultValue={["notes"]}
            aria-label="Filter kinds"
            size="sm"
          >
            <ToggleGroupItem value="notes">Notes</ToggleGroupItem>
            <ToggleGroupItem value="pdfs">PDFs</ToggleGroupItem>
            <ToggleGroupItem value="images">Images</ToggleGroupItem>
          </ToggleGroup>
        </div>
      ),
    },
  ],
};
