import { Children, Fragment, type ComponentProps, type ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@resit/ui/components/resizable";
import { cn } from "@resit/ui/lib/utils";

export type SplitHandleProps = ComponentProps<typeof ResizableHandle>;

/**
 * Divider between panes. Hover, drag, and focus states come from the base
 * handle; `withHandle` adds a grip so the divider is discoverable.
 */
export function SplitHandle({ className, ...props }: SplitHandleProps) {
  return (
    <ResizableHandle
      data-slot="split-handle"
      className={cn("shrink-0", className)}
      {...props}
    />
  );
}

export interface SplitLayoutProps {
  direction: "horizontal" | "vertical";
  /** Minimum pane size in pixels. */
  minSize?: number;
  withHandle?: boolean;
  /** One pane per child; handles go between them. */
  children: ReactNode;
  className?: string;
  onLayoutChange?: (layout: Record<string, number>) => void;
}

/** Splits its children into resizable panes. */
export function SplitLayout({
  direction,
  minSize = 160,
  withHandle = false,
  children,
  className,
  onLayoutChange,
}: SplitLayoutProps) {
  const panes = Children.toArray(children);
  return (
    <ResizablePanelGroup
      orientation={direction}
      className={cn("min-h-0 min-w-0", className)}
      {...(onLayoutChange ? { onLayoutChanged: onLayoutChange } : {})}
    >
      {panes.map((pane, index) => (
        <Fragment key={index}>
          {index > 0 ? <SplitHandle withHandle={withHandle} /> : null}
          <ResizablePanel
            minSize={minSize}
            className="flex min-h-0 min-w-0 flex-col"
          >
            {pane}
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}
