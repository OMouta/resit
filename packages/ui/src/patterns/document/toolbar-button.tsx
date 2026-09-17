import type { ComponentProps, ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { Kbd } from "@resit/ui/components/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@resit/ui/components/tooltip";
import { shortcutLabel } from "@resit/ui/lib/keys";
import { cn } from "@resit/ui/lib/utils";

/** Tooltip body shared by toolbar buttons and toggles: label plus optional shortcut. */
export function ToolbarTooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="flex items-center gap-1.5">
        {label}
        {shortcut ? (
          <span className="flex gap-0.5">
            {shortcutLabel(shortcut).map((key, index) => (
              <Kbd
                key={index}
                className="h-4 min-w-4 bg-background/15 px-1 text-background shadow-none dark:bg-muted dark:text-muted-foreground"
              >
                {key}
              </Kbd>
            ))}
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Icon button for toolbars. `label` is the accessible name and tooltip. */
export function ToolbarButton({
  label,
  shortcut,
  active,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label"> & {
  label: string;
  shortcut?: string;
  active?: boolean | undefined;
}) {
  return (
    <ToolbarTooltip label={label} {...(shortcut ? { shortcut } : {})}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-pressed={active}
        data-state={active ? "on" : undefined}
        className={cn(
          "text-muted-foreground hover:text-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </Button>
    </ToolbarTooltip>
  );
}

export function ToolbarSeparator({ className }: { className?: string }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      className={cn("mx-1 h-4 w-px shrink-0 bg-border", className)}
    />
  );
}
