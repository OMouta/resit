import type { ComponentProps } from "react";

import { cn } from "@resit/ui/lib/utils";

/** The resit logo: a lowercase r and a highlighter dot on a jade tile. */
function ResitMark({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      data-slot="resit-mark"
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("size-6 shrink-0", className)}
      {...props}
    >
      <rect width="32" height="32" rx="9" className="fill-brand" />
      <path
        d="M10.8 22V14.75C10.8 11.85 12.9 10 15.9 10H17.3"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20.6" cy="21.35" r="2.4" className="fill-brand-dot" />
    </svg>
  );
}

/** The mark followed by the lowercase name. */
function ResitLogo({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="resit-logo"
      className={cn(
        "inline-flex items-center gap-2 text-base font-semibold tracking-[-0.03em] text-foreground",
        className,
      )}
      {...props}
    >
      <ResitMark className="size-[1.375em]" />
      resit
    </span>
  );
}

export { ResitLogo, ResitMark };
