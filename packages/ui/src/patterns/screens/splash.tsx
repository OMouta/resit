import { ResitMark } from "@resit/ui/components/resit-mark";
import { cn } from "@resit/ui/lib/utils";

export interface SplashProps {
  /** What the app is doing, shown under the name. */
  message?: string;
  /** Set while the screen is going away, to fade it out. */
  leaving?: boolean;
  className?: string;
}

/** The window while resit reads its settings and the last workspace. */
export function Splash({ message, leaving = false, className }: SplashProps) {
  return (
    <div
      data-slot="splash"
      role="status"
      aria-live="polite"
      className={cn(
        "canvas-dots flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-6",
        "transition-opacity duration-(--duration-slow) ease-(--ease-out)",
        leaving ? "opacity-0" : "opacity-100",
        className,
      )}
    >
      <div className="animate-in fade-in-0 zoom-in-95 flex flex-col items-center gap-4 duration-(--duration-slow) ease-(--ease-out)">
        <ResitMark className="size-16 rounded-[1.125rem] shadow-md" />
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xl font-semibold tracking-[-0.03em]">
            resit
          </span>
          <span className="text-xs text-muted-foreground">
            {message ?? "Opening your workspace…"}
          </span>
        </div>
      </div>
      <div
        aria-hidden
        className="h-0.5 w-28 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
    </div>
  );
}
