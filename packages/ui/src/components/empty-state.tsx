import type { ComponentProps, ReactNode } from "react";

import { cn } from "@resit/ui/lib/utils";

/**
 * Empty collection or empty view. Keeps copy short: a title, one sentence,
 * and at most two actions.
 */
function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
  size = "default",
  ...props
}: ComponentProps<"div"> & {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  size?: "default" | "compact";
}) {
  return (
    <div
      data-slot="empty-state"
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "default" ? "gap-3 px-6 py-12" : "gap-2 px-4 py-6",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden
          className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4"
        >
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p
          className={cn(
            "font-medium text-foreground",
            size === "default" ? "text-base" : "text-sm",
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="max-w-xs text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export { EmptyState };
