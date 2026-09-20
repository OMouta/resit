import {
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  MessageSquareIcon,
  PaperclipIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@resit/ui/components/alert-dialog";
import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";

export interface TrashItem {
  id: string;
  title: string;
  kind: "note" | "pdf" | "image" | "attachment" | "subject" | "conversation";
  subjectName: string | null;
  deletedAt: string | Date;
  originalPath: string;
  /** For subjects: how many resources it still owns. */
  ownedCount?: number;
}

const icons = {
  note: FileTextIcon,
  pdf: FileTextIcon,
  image: ImageIcon,
  attachment: PaperclipIcon,
  subject: FolderIcon,
  conversation: MessageSquareIcon,
};

export interface TrashRowProps {
  item: TrashItem;
  now?: Date | undefined;
  onRestore: (id: string) => void;
  /** Omit to offer restoring only. */
  onDeletePermanently?: ((id: string) => void) | undefined;
  className?: string;
}

/** A trashed item. Permanent deletion asks first and names the item. */
export function TrashRow({
  item,
  now,
  onRestore,
  onDeletePermanently,
  className,
}: TrashRowProps) {
  const { relative } = useLocale();
  const [confirm, setConfirm] = useState(false);
  const Icon = icons[item.kind];
  return (
    <div
      className={cn(
        "group/trash flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-accent",
        className,
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.kind === "subject"
            ? `Subject · ${item.ownedCount ?? 0} resources inside`
            : (item.subjectName ?? "Library")}{" "}
          · deleted {relative(item.deletedAt, now)} ·{" "}
          <code className="font-mono">{item.originalPath}</code>
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 opacity-0 group-hover/trash:opacity-100 group-focus-within/trash:opacity-100">
        <Button variant="outline" size="sm" onClick={() => onRestore(item.id)}>
          <RotateCcwIcon /> Restore
        </Button>
        {onDeletePermanently ? (
          <Button
            variant="destructive-outline"
            size="sm"
            onClick={() => setConfirm(true)}
          >
            <Trash2Icon /> Delete permanently
          </Button>
        ) : null}
      </span>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{item.title}” permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {item.kind === "subject"
                ? `The subject and its ${item.ownedCount ?? 0} resources will be removed from disk. History for these files is kept.`
                : "The file will be removed from disk. Its history revisions are kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirm(false);
                onDeletePermanently?.(item.id);
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TrashList({
  items,
  now,
  onRestore,
  onDeletePermanently,
  onEmpty,
  className,
}: {
  items: TrashItem[];
  now?: Date | undefined;
  onRestore: (id: string) => void;
  onDeletePermanently?: ((id: string) => void) | undefined;
  onEmpty?: () => void;
  className?: string;
}) {
  if (items.length === 0)
    return (
      <EmptyState
        icon={<Trash2Icon />}
        title="Trash is empty"
        description="Deleted notes, documents, and subjects wait here until you delete them permanently."
        size="compact"
      />
    );
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between px-2.5 pb-1">
        <p className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </p>
        {onEmpty ? (
          <Button variant="subtle" size="sm" onClick={onEmpty}>
            Empty trash
          </Button>
        ) : null}
      </div>
      {items.map((item) => (
        <TrashRow
          key={item.id}
          item={item}
          now={now}
          onRestore={onRestore}
          onDeletePermanently={onDeletePermanently}
        />
      ))}
    </div>
  );
}
