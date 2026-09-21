import {
  Columns2Icon,
  FileTextIcon,
  Maximize2Icon,
  Minimize2Icon,
  Rows2Icon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";

export interface PaneHeaderProps {
  /** The pane that receives keyboard input. Draws the top accent. */
  focused?: boolean;
  maximised?: boolean;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  onMaximise?: () => void;
  onClose?: () => void;
  /** The tab strip. */
  children?: ReactNode;
  className?: string;
}

function PaneAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Top of a pane: the tab strip plus split, maximise, and close actions. */
export function PaneHeader({
  focused = false,
  maximised = false,
  onSplitHorizontal,
  onSplitVertical,
  onMaximise,
  onClose,
  children,
  className,
}: PaneHeaderProps) {
  const { t } = useLocale();
  return (
    <div
      data-slot="pane-header"
      data-focused={focused || undefined}
      className={cn(
        "flex h-tab min-w-0 shrink-0 items-stretch border-b border-t-2 bg-sidebar",
        focused ? "border-t-ring" : "border-t-transparent",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1">{children}</div>
      <div
        role="toolbar"
        aria-label={t("Pane")}
        className="flex shrink-0 items-center gap-1 border-l px-2"
      >
        {onSplitHorizontal ? (
          <PaneAction label={t("Split right")} onClick={onSplitHorizontal}>
            <Columns2Icon />
          </PaneAction>
        ) : null}
        {onSplitVertical ? (
          <PaneAction label={t("Split down")} onClick={onSplitVertical}>
            <Rows2Icon />
          </PaneAction>
        ) : null}
        {onMaximise ? (
          <PaneAction
            label={maximised ? t("Restore pane") : t("Maximise pane")}
            onClick={onMaximise}
          >
            {maximised ? <Minimize2Icon /> : <Maximize2Icon />}
          </PaneAction>
        ) : null}
        {onClose ? (
          <PaneAction label={t("Close pane")} onClick={onClose}>
            <XIcon />
          </PaneAction>
        ) : null}
      </div>
    </div>
  );
}

export interface PaneEmptyProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Body of a pane with no open tabs. */
export function PaneEmpty({
  title,
  description,
  actions,
  className,
}: PaneEmptyProps) {
  const { t } = useLocale();
  return (
    <div
      data-slot="pane-empty"
      className={cn("flex h-full items-center justify-center", className)}
    >
      <EmptyState
        icon={<FileTextIcon />}
        title={title ?? t("Nothing open")}
        description={
          description ?? t("Pick a note or document from the sidebar.")
        }
        {...(actions ? { actions } : {})}
      />
    </div>
  );
}
