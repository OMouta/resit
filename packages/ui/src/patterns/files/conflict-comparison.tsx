import { CopyPlusIcon, HardDriveIcon, PencilIcon } from "lucide-react";

import { Button } from "@resit/ui/components/button";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";
import { diffLines } from "@resit/ui/patterns/ai/edit-preview";

export interface ConflictVersion {
  label: string;
  savedAt: string | Date;
  text: string;
}

export interface ConflictComparisonProps {
  resourceTitle: string;
  path: string;
  mine: ConflictVersion;
  theirs: ConflictVersion;
  /** Stack the columns (narrow layouts). */
  stacked?: boolean;
  onKeepMine: () => void;
  onKeepTheirs: () => void;
  onKeepBoth: () => void;
  className?: string;
}

function Column({
  version,
  icon: Icon,
  side,
  lines,
}: {
  version: ConflictVersion;
  icon: typeof PencilIcon;
  side: "mine" | "theirs";
  lines: ReturnType<typeof diffLines>;
}) {
  const { dateTime } = useLocale();
  const kept = side === "mine" ? "removed" : "added";
  return (
    <section
      aria-label={version.label}
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background"
    >
      <header className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2 text-sm">
        <Icon className="size-4 text-muted-foreground" />
        <span className="font-medium">{version.label}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {dateTime(version.savedAt)}
        </span>
      </header>
      <pre className="scrollbar-thin max-h-72 overflow-auto font-mono text-xs leading-5">
        {lines
          .filter((line) => line.kind === "same" || line.kind === kept)
          .map((line, index) => (
            <div
              key={index}
              className={cn(
                "px-3 whitespace-pre-wrap",
                line.kind === "removed" && "bg-info-soft text-foreground",
                line.kind === "added" && "bg-warning-soft text-foreground",
                line.kind === "same" && "text-muted-foreground",
              )}
            >
              {line.text || " "}
            </div>
          ))}
      </pre>
    </section>
  );
}

/** Two versions side by side after a file changed on disk while it was being edited. */
export function ConflictComparison({
  resourceTitle,
  path,
  mine,
  theirs,
  stacked = false,
  onKeepMine,
  onKeepTheirs,
  onKeepBoth,
  className,
}: ConflictComparisonProps) {
  const lines = diffLines(mine.text, theirs.text);
  const changed = lines.filter((line) => line.kind !== "same").length;
  return (
    <div
      data-slot="conflict-comparison"
      className={cn("flex flex-col gap-4 @container", className)}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">
          {resourceTitle} changed on disk
        </h2>
        <p className="text-sm text-muted-foreground">
          <code className="font-mono text-xs">{path}</code> was edited outside
          resit while you had unsaved changes. {changed}{" "}
          {changed === 1 ? "line differs" : "lines differ"}. Whatever you
          choose, both versions stay in history.
        </p>
      </header>
      <div
        className={cn(
          "grid gap-3",
          stacked ? "grid-cols-1" : "grid-cols-1 @2xl:grid-cols-2",
        )}
      >
        <Column version={mine} icon={PencilIcon} side="mine" lines={lines} />
        <Column
          version={theirs}
          icon={HardDriveIcon}
          side="theirs"
          lines={lines}
        />
      </div>
      <footer className="flex flex-wrap gap-2">
        <Button onClick={onKeepMine}>
          <PencilIcon /> Keep my version
        </Button>
        <Button variant="outline" onClick={onKeepTheirs}>
          <HardDriveIcon /> Keep the disk version
        </Button>
        <Button variant="subtle" onClick={onKeepBoth}>
          <CopyPlusIcon /> Keep both as separate notes
        </Button>
      </footer>
    </div>
  );
}
