import {
  CircleDashedIcon,
  CircleDotIcon,
  CircleIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { cn } from "@resit/ui/lib/utils";

export type ConceptLevel = "unknown" | "gap" | "developing" | "secure";

const meta: Record<
  ConceptLevel,
  { label: string; icon: typeof CircleIcon; className: string }
> = {
  unknown: {
    label: "Unknown",
    icon: CircleDashedIcon,
    className: "bg-muted text-muted-foreground",
  },
  gap: {
    label: "Gap",
    icon: CircleIcon,
    className: "bg-danger-soft text-destructive",
  },
  developing: {
    label: "Developing",
    icon: CircleDotIcon,
    className: "bg-warning-soft text-warning",
  },
  secure: {
    label: "Secure",
    icon: ShieldCheckIcon,
    className: "bg-success-soft text-success",
  },
};

export const conceptLevelLabels: Record<ConceptLevel, string> = {
  unknown: meta.unknown.label,
  gap: meta.gap.label,
  developing: meta.developing.label,
  secure: meta.secure.label,
};

/** Learner-profile level as an icon plus label. */
export function LevelChip({
  level,
  className,
}: {
  level: ConceptLevel;
  className?: string;
}) {
  const { label, icon: Icon, className: tone } = meta[level];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
