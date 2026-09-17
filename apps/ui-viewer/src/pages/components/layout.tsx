import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@resit/ui/components/resizable";
import { ScrollArea, ScrollBar } from "@resit/ui/components/scroll-area";
import { Separator } from "@resit/ui/components/separator";

import { resources } from "../../fixtures/workspace";
import type { ExamplePage } from "../../viewer/types";

export const page: ExamplePage = {
  section: "components",
  slug: "layout",
  title: "Scroll, resize, separate",
  description:
    "Scroll areas with thin overlay scrollbars, resizable panel groups with keyboard-operable handles, and separators.",
  source: "packages/ui/src/components/resizable.tsx",
  keywords: ["scroll", "resizable", "panels", "separator", "split"],
  examples: [
    {
      id: "scroll",
      title: "Scroll area",
      description: "The viewport is focusable so keyboard users can scroll it.",
      width: "auto",
      render: () => (
        <div className="flex gap-6">
          <ScrollArea className="h-56 w-64 rounded-lg border">
            <div className="p-2">
              {[...resources, ...resources].map((resource, index) => (
                <p
                  key={`${resource.id}-${index}`}
                  className="truncate rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  title={resource.title}
                >
                  {resource.title}
                </p>
              ))}
            </div>
          </ScrollArea>
          <ScrollArea className="w-64 rounded-lg border whitespace-nowrap">
            <div className="flex w-max gap-2 p-3">
              {resources.slice(0, 8).map((resource) => (
                <div
                  key={resource.id}
                  className="flex h-24 w-40 shrink-0 items-end rounded-md bg-muted p-2 text-xs"
                >
                  <span className="line-clamp-2">{resource.title}</span>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      ),
    },
    {
      id: "resizable",
      title: "Resizable panels",
      description:
        "Drag the handle, or focus it and press the arrow keys. Panels have minimum sizes.",
      width: "full",
      height: 320,
      render: (ctx) => (
        <ResizablePanelGroup
          orientation="horizontal"
          onLayoutChanged={(layout) => ctx.log("onLayoutChanged", layout)}
        >
          <ResizablePanel
            minSize={160}
            className="flex items-center justify-center text-sm text-muted-foreground"
          >
            Sidebar
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel minSize={240}>
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel
                minSize={80}
                className="flex items-center justify-center text-sm text-muted-foreground"
              >
                PDF
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel
                minSize={80}
                className="flex items-center justify-center text-sm text-muted-foreground"
              >
                Note
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      ),
    },
    {
      id: "separator",
      title: "Separator",
      width: "auto",
      render: () => (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Worksheet 3</p>
            <p className="text-xs text-muted-foreground">
              14 pages · Mathematics
            </p>
          </div>
          <Separator />
          <div className="flex h-5 items-center gap-3 text-sm">
            <span>Notes</span>
            <Separator orientation="vertical" />
            <span>PDFs</span>
            <Separator orientation="vertical" />
            <span>Flashcards</span>
          </div>
        </div>
      ),
    },
  ],
};
