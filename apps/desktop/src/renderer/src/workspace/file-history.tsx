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
import {
  HistoryList,
  type HistoryRevision,
} from "@resit/ui/patterns/files/history-row";

import type { FileRevision, ResourceInfo } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";

const SUMMARIES: Record<FileRevision["cause"], string> = {
  replace: "Before a newer copy replaced it",
  restore: "Before a restore",
};

const CAUSES: Record<FileRevision["cause"], HistoryRevision["cause"]> = {
  replace: "import",
  restore: "restore",
};

/** Earlier copies of an imported file, and a way to put one back. */
export function FileHistory({
  resource,
  onClose,
}: {
  /** The file whose history is open, or null when the dialog is closed. */
  resource: ResourceInfo | null;
  onClose: () => void;
}) {
  const notices = useNotices();
  const [revisions, setRevisions] = useState<FileRevision[] | null>(null);
  const resourceId = resource?.id;

  useEffect(() => {
    if (!resourceId) return;
    let cancelled = false;
    setRevisions(null);
    api.listFileRevisions(resourceId).then(
      (list) => {
        if (!cancelled) setRevisions(list);
      },
      (error: unknown) => {
        if (cancelled) return;
        setRevisions([]);
        notices.fail("The file's history could not be read", error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resourceId, notices]);

  const restore = async (revisionId: string) => {
    if (!resourceId) return;
    try {
      await api.restoreFileRevision({ resourceId, revisionId });
      onClose();
      notices.notify({
        tone: "success",
        title: "The earlier copy is back",
        detail: "The copy it replaced was kept, so you can undo this too.",
      });
    } catch (error) {
      notices.fail("That copy was not restored", error);
    }
  };

  const total = revisions?.length ?? 0;
  const rows: HistoryRevision[] = (revisions ?? []).map((revision, index) => ({
    id: revision.id,
    revision: total - index,
    at: revision.at,
    cause: CAUSES[revision.cause],
    summary: SUMMARIES[revision.cause],
    sizeBytes: revision.size,
  }));

  return (
    <Dialog
      open={resource !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            resit keeps a copy of {resource?.title ?? "this file"} before a
            newer one replaces it. Restoring one keeps the copy it replaces.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="-mx-2 max-h-[50vh] px-2">
          {revisions === null ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : (
            <HistoryList
              revisions={rows}
              onRestore={(id) => void restore(id)}
            />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
