import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@resit/ui/lib/utils";

const inlineMessageVariants = cva(
  "flex items-start gap-2 rounded-md border px-3 py-2 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        info: "border-link/20 bg-info-soft text-foreground [&_svg]:text-link",
        success:
          "border-success/20 bg-success-soft text-foreground [&_svg]:text-success",
        warning:
          "border-warning/25 bg-warning-soft text-foreground [&_svg]:text-warning",
        error:
          "border-destructive/25 bg-danger-soft text-foreground [&_svg]:text-destructive",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

const icons = {
  info: InfoIcon,
  success: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  error: XCircleIcon,
};

/**
 * Inline status message for forms, panels, and dialogs. Errors say what
 * failed and what the student can do; put the action in `actions`.
 */
function InlineMessage({
  tone = "info",
  title,
  children,
  actions,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> &
  VariantProps<typeof inlineMessageVariants> & {
    title?: ReactNode;
    actions?: ReactNode;
  }) {
  const Icon = icons[tone ?? "info"];
  return (
    <div
      data-slot="inline-message"
      role={tone === "error" ? "alert" : "status"}
      className={cn(inlineMessageVariants({ tone }), className)}
      {...props}
    >
      <Icon aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? (
          <div className="text-muted-foreground [&>p]:m-0">{children}</div>
        ) : null}
        {actions ? <div className="mt-1 flex gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export { InlineMessage, inlineMessageVariants };
