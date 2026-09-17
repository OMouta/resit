import type { ComponentProps } from "react";

import { cn } from "@resit/ui/lib/utils";

export const fieldClassName =
  "w-full min-w-0 rounded-control border border-control-border bg-control text-sm text-foreground shadow-input transition-[border-color,box-shadow,background-color] duration-(--duration-fast) outline-none placeholder:text-subtle-foreground selection:bg-selection-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClassName,
        "h-control px-2.5 py-1 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
