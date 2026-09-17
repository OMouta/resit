import type { ReactNode } from "react";

import { cn } from "@resit/ui/lib/utils";

/** Small stat tile: a number and what it means. */
export function StudySummaryTile({
  label,
  value,
  detail,
  icon,
  tone = "default",
  onClick,
  className,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: ReactNode;
  tone?: "default" | "warning" | "success";
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border bg-background px-3.5 py-3 text-left shadow-sm",
        onClick &&
          "hover:bg-accent focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums tracking-tight",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </span>
      {detail ? (
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      ) : null}
    </Comp>
  );
}
