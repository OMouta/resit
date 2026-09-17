import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@resit/ui/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-transparent text-sm font-medium transition-[background-color,color,box-shadow,border-color,filter] duration-(--duration-fast) ease-(--ease-out) select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:shadow-focus aria-invalid:ring-2 aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b from-primary-top to-primary-bottom border-primary-border text-primary-foreground shadow-primary hover:brightness-[1.05] active:brightness-[0.95] active:shadow-none",
        secondary:
          "bg-control border-control-border text-foreground shadow-control hover:bg-control-hover active:bg-control-active active:shadow-control-active",
        outline:
          "bg-control border-control-border text-foreground shadow-control hover:bg-control-hover active:bg-control-active active:shadow-control-active",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground active:bg-control-active",
        subtle:
          "text-muted-foreground hover:bg-accent hover:text-foreground active:bg-control-active",
        destructive:
          "bg-destructive border-destructive text-destructive-foreground shadow-control hover:brightness-[1.05] active:brightness-[0.95]",
        "destructive-outline":
          "bg-control border-destructive/40 text-destructive shadow-control hover:bg-danger-soft active:bg-danger-soft",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-control px-3",
        sm: "h-6 rounded-sm px-2 text-xs gap-1 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-control-lg rounded-md px-4 text-base",
        icon: "size-control",
        "icon-sm": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-control-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner and disables the control. Keeps the label for width stability. */
  loading?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-loading={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
