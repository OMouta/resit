import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { EmptyState } from "@resit/ui/components/empty-state";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import { Skeleton } from "@resit/ui/components/skeleton";
import { DiffView } from "@resit/ui/patterns/ai/edit-preview";
import {
  HistoryList,
  type HistoryRevision,
} from "@resit/ui/patterns/files/history-row";

import type { NoteDocument } from "../../../shared/ipc";
import type { NoteRevision } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";

/** What the kept copy was taken before. */
const SUMMARIES: Record<NoteRevision["cause"], string> = {
  edit: "Before your changes",
  assistant: "Before the assistant's changes",
  restore: "Before a restore",
};

const CAUSES: Record<NoteRevision["cause"], HistoryRevision["cause"]> = {
  edit: "manual save",
  assistant: "ai edit",
  restore: "restore",
};

export interface NoteHistoryProps {
  noteId: string;
  /** The note's text as it stands, to compare a kept copy against. */
  current: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: (document: NoteDocument) => void;
}

/** Earlier versions of one note, and a way to put one back. */
export function NoteHistory({
  noteId,
  current,
  open,
  onOpenChange,
  onRestored,
}: NoteHistoryProps) {
  const notices = useNotices();
  const [revisions, setRevisions] = useState<NoteRevision[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRevisions(null);
    setSelected(null);
    setBody(null);
    api.listNoteRevisions(noteId).then(
      (list) => {
        if (cancelled) return;
        setRevisions(list);
        setSelected(list[0]?.id ?? null);
      },
      (error: unknown) => {
        if (cancelled) return;
        setRevisions([]);
        notices.fail("The note's history could not be read", error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, noteId, notices]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setBody(null);
    api.readNoteRevision({ noteId, revisionId: selected }).then(
      (revision) => {
        if (!cancelled) setBody(revision.body);
      },
      (error: unknown) => {
        if (!cancelled) notices.fail("That version could not be read", error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selected, noteId, notices]);

  const restore = async (revisionId: string) => {
    try {
      const document = await api.restoreNoteRevision({ noteId, revisionId });
      onRestored(document);
      onOpenChange(false);
      notices.notify({
        tone: "success",
        title: "The earlier version is back",
        detail: "The text it replaced was kept, so you can undo this too.",
      });
    } catch (error) {
      notices.fail("That version was not restored", error);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            resit keeps a copy of this note before you or the assistant change
            it. Restoring one keeps the text it replaces.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-3">
          <ScrollArea className="-mx-2 max-h-[32vh] px-2">
            {revisions === null ? (
              <div className="flex flex-col gap-2 p-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            ) : (
              <HistoryList
                revisions={rows}
                onPreview={setSelected}
                onRestore={(id) => void restore(id)}
              />
            )}
          </ScrollArea>
          {selected === null ? (
            <EmptyState
              title="Nothing to compare yet"
              description="Versions appear here as you and the assistant change this note."
            />
          ) : body === null ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="flex min-w-0 flex-col gap-2 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Restoring replaces the lines marked − with the lines marked +.
              </p>
              <DiffView
                before={current}
                after={body}
                className="max-h-[38vh] overflow-y-auto"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
