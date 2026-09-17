import { Progress as ProgressPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@resit/ui/lib/utils";

function Progress({
  className,
  value,
  indeterminate = false,
  tone = "default",
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root> & {
  indeterminate?: boolean;
  tone?: "default" | "success" | "destructive";
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      value={indeterminate ? null : value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 rounded-full transition-transform duration-(--duration-slow) ease-(--ease-out)",
          tone === "default" && "bg-primary",
          tone === "success" && "bg-success",
          tone === "destructive" && "bg-destructive",
          indeterminate &&
            "w-1/3 animate-[progress-slide_1.2s_ease-in-out_infinite]",
        )}
        style={
          indeterminate
            ? undefined
            : { transform: `translateX(-${100 - (value ?? 0)}%)` }
        }
      />
      {indeterminate ? (
        <style>{`@keyframes progress-slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
      ) : null}
    </ProgressPrimitive.Root>
  );
}

export { Progress };
