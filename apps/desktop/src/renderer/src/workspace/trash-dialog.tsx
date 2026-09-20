import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { TrashList } from "@resit/ui/patterns/files/trash-row";

import type { TrashEntry, WorkspaceSnapshot } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";

export interface TrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: (snapshot: WorkspaceSnapshot) => void;
}

/** What is in `.resit/trash`, and a way to put it back. */
export function TrashDialog({
  open,
  onOpenChange,
  onRestored,
}: TrashDialogProps) {
  const notices = useNotices();
  const [entries, setEntries] = useState<TrashEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEntries(null);
    api.listTrash().then(
      (list) => {
        if (!cancelled) setEntries(list);
      },
      (error: unknown) => {
        if (cancelled) return;
        setEntries([]);
        notices.fail("The trash could not be read", error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, notices]);

  const restore = async (id: string) => {
    const entry = entries?.find((item) => item.id === id);
    try {
      onRestored(await api.restoreFromTrash(id));
      setEntries((list) => (list ?? []).filter((item) => item.id !== id));
      notices.notify({
        tone: "success",
        title: `${entry?.title ?? "The item"} is back in your workspace`,
      });
    } catch (error) {
      notices.fail("It was not restored", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trash</DialogTitle>
          <DialogDescription>
            Deleted notes, documents, subjects, and conversations stay in the
            workspace folder until you remove them yourself.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="-mx-2 max-h-[60vh] px-2">
          {entries === null ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : (
            <TrashList
              items={entries.map((entry) => ({
                id: entry.id,
                title: entry.title,
                kind: entry.kind,
                subjectName: entry.subjectName,
                deletedAt: entry.deletedAt,
                originalPath: entry.originalPath,
              }))}
              onRestore={(id) => void restore(id)}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
