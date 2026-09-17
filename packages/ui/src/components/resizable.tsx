import { GripVerticalIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@resit/ui/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

/**
 * Split handle. The hit area is wider than the visible hairline so it is easy
 * to grab, and the line highlights on hover, focus, and drag.
 */
function ResizableHandle({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "group/handle relative flex w-px items-center justify-center bg-border outline-none transition-colors duration-(--duration-fast) after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 hover:bg-ring/60 data-[resize-handle-active]:bg-ring data-[resize-handle-state=hover]:bg-ring/60 focus-visible:bg-ring focus-visible:ring-2 focus-visible:ring-ring/30 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2 data-[orientation=horizontal]:after:left-0 data-[orientation=horizontal]:after:h-2 data-[orientation=horizontal]:after:w-full data-[orientation=horizontal]:after:-translate-y-1/2 data-[orientation=horizontal]:after:translate-x-0",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-pane flex h-5 w-3 items-center justify-center rounded-xs border bg-surface-raised text-muted-foreground shadow-hairline group-data-[orientation=horizontal]/handle:h-3 group-data-[orientation=horizontal]/handle:w-5 group-data-[orientation=horizontal]/handle:rotate-90">
          <GripVerticalIcon className="size-2.5" />
        </div>
      ) : null}
    </Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
