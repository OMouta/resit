import {
  AlertTriangleIcon,
  ArrowUpRightIcon,
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
} from "lucide-react";

import { Button } from "@resit/ui/components/button";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";

export interface RelatedResourceRowProps {
  resourceId: string;
  kind?: "note" | "pdf" | "image" | "attachment";
  title: string;
  subjectName?: string;
  /** Why it is related: "Linked from Exercise 2 (b)", "Same concept: limits". */
  reason: string;
  missing?: boolean;
  onOpen?: (resourceId: string) => void;
  className?: string;
}

const icons = {
  note: FileTextIcon,
  pdf: FileTextIcon,
  image: ImageIcon,
  attachment: PaperclipIcon,
};

/** Row in a "Related" list beside a note or PDF. */
export function RelatedResourceRow({
  resourceId,
  kind = "note",
  title,
  subjectName,
  reason,
  missing = false,
  onOpen,
  className,
}: RelatedResourceRowProps) {
  const { t } = useLocale();
  const Icon = icons[kind];
  return (
    <div
      className={cn(
        "group/related flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-accent",
        missing && "opacity-80",
        className,
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        {missing ? (
          <AlertTriangleIcon className="size-4 text-warning" />
        ) : (
          <Icon
            className={cn(
              "size-4",
              kind === "pdf" ? "text-destructive/70" : "text-muted-foreground",
            )}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium",
            missing && "text-muted-foreground",
          )}
          title={title}
        >
          {title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {subjectName ? `${subjectName} · ` : ""}
          {missing ? `${t("File missing")} · ` : ""}
          {reason}
        </p>
      </div>
      {onOpen ? (
        <Button
          variant="subtle"
          size="icon-sm"
          aria-label={
            missing
              ? t("Locate {title}", { title })
              : t("Open {title}", { title })
          }
          className="opacity-0 group-hover/related:opacity-100 group-focus-within/related:opacity-100"
          onClick={() => onOpen(resourceId)}
        >
          <ArrowUpRightIcon />
        </Button>
      ) : null}
    </div>
  );
}
