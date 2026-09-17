import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@resit/ui/lib/utils";

function Tabs({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  variant = "segmented",
  ...props
}: ComponentProps<typeof TabsPrimitive.List> & {
  /** Segmented: Apple-style pill group. Underline: text tabs with an active bar. */
  variant?: "segmented" | "underline";
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        "group/tabs inline-flex w-fit items-center",
        variant === "segmented" &&
          "h-control rounded-control bg-segment-track p-0.5 text-muted-foreground",
        variant === "underline" && "h-9 gap-4 border-b text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-[color,box-shadow,background-color] duration-(--duration-fast) outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=segmented]/tabs:h-full group-data-[variant=segmented]/tabs:flex-1 group-data-[variant=segmented]/tabs:rounded-[calc(var(--radius-control)-2px)] group-data-[variant=segmented]/tabs:px-2.5 group-data-[variant=segmented]/tabs:data-[state=active]:bg-background group-data-[variant=segmented]/tabs:data-[state=active]:text-foreground group-data-[variant=segmented]/tabs:data-[state=active]:shadow-segment dark:group-data-[variant=segmented]/tabs:data-[state=active]:bg-surface-raised",
        "group-data-[variant=underline]/tabs:relative group-data-[variant=underline]/tabs:h-full group-data-[variant=underline]/tabs:px-0.5 group-data-[variant=underline]/tabs:after:absolute group-data-[variant=underline]/tabs:after:inset-x-0 group-data-[variant=underline]/tabs:after:-bottom-px group-data-[variant=underline]/tabs:after:h-0.5 group-data-[variant=underline]/tabs:after:rounded-full group-data-[variant=underline]/tabs:after:bg-transparent group-data-[variant=underline]/tabs:hover:text-foreground group-data-[variant=underline]/tabs:data-[state=active]:text-foreground group-data-[variant=underline]/tabs:data-[state=active]:after:bg-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
