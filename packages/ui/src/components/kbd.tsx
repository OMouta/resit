import type { ComponentProps } from "react";

import { cn } from "@resit/ui/lib/utils";

/** Keyboard shortcut label. Pass the already-platform-specific keys. */
function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-xs bg-muted px-1 font-sans text-2xs font-medium text-muted-foreground shadow-hairline select-none",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
