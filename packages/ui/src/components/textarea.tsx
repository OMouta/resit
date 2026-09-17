import type { ComponentProps } from "react";

import { fieldClassName } from "@resit/ui/components/input";
import { cn } from "@resit/ui/lib/utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldClassName,
        "field-sizing-content flex min-h-16 px-2.5 py-1.5 leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
