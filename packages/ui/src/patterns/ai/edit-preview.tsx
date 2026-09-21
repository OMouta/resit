import { CheckIcon, ExternalLinkIcon, FileTextIcon, XIcon } from "lucide-react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { cn } from "@resit/ui/lib/utils";
import type { EditProposal } from "@resit/ui/patterns/ai/types";

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

/** Line diff by longest common subsequence. Fine for note-sized edits. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        a[i] === b[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      out.push({ kind: "removed", text: a[i]! });
      i += 1;
    } else {
      out.push({ kind: "added", text: b[j]! });
      j += 1;
    }
  }
  while (i < a.length) out.push({ kind: "removed", text: a[i++]! });
  while (j < b.length) out.push({ kind: "added", text: b[j++]! });
  return out;
}

export function DiffView({
  before,
  after,
  className,
}: {
  before: string;
  after: string;
  className?: string;
}) {
  const lines = diffLines(before, after);
  return (
    <pre
      className={cn(
        "scrollbar-thin overflow-x-auto rounded-md border bg-background font-mono text-xs leading-5",
        className,
      )}
    >
      {lines.map((line, index) => (
        <div
          key={index}
          className={cn(
            "flex min-w-max gap-2 px-2",
            line.kind === "added" && "bg-success-soft text-success",
            line.kind === "removed" && "bg-danger-soft text-destructive",
            line.kind === "same" && "text-muted-foreground",
          )}
        >
          <span className="w-3 shrink-0 select-none">
            {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}
          </span>
          <span className="whitespace-pre">{line.text || " "}</span>
        </div>
      ))}
    </pre>
  );
}

export interface EditPreviewProps {
  edit: EditProposal;
  subjectName?: string;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onOpen?: (resourceId: string) => void;
  className?: string;
}

/** A proposed note edit awaiting review, with a line diff and decision buttons. */
export function EditPreview({
  edit,
  subjectName,
  onAccept,
  onReject,
  onOpen,
  className,
}: EditPreviewProps) {
  const { t } = useLocale();
  return (
    <section
      data-slot="edit-preview"
      aria-label={t("Proposed edit to {title}", { title: edit.resourceTitle })}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-2.5",
        edit.status === "pending" && "border-primary/40 bg-info-soft/40",
        edit.status === "accepted" && "border-success/30",
        edit.status === "rejected" && "opacity-70",
        className,
      )}
    >
      <header className="flex items-center gap-2 text-sm">
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {edit.resourceTitle}
        </span>
        {subjectName ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {subjectName}
          </span>
        ) : null}
        {edit.status === "pending" ? (
          <Badge variant="info">{t("Awaiting review")}</Badge>
        ) : null}
        {edit.status === "accepted" ? (
          <Badge variant="success">{t("Accepted")}</Badge>
        ) : null}
        {edit.status === "rejected" ? (
          <Badge variant="muted">{t("Rejected")}</Badge>
        ) : null}
      </header>
      <DiffView before={edit.before} after={edit.after} className="max-h-64" />
      <footer className="flex flex-wrap items-center gap-2">
        {edit.status === "pending" ? (
          <>
            <Button size="sm" onClick={() => onAccept?.(edit.id)}>
              <CheckIcon /> {t("Accept")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject?.(edit.id)}
            >
              <XIcon /> {t("Reject")}
            </Button>
          </>
        ) : null}
        {onOpen ? (
          <Button
            size="sm"
            variant="subtle"
            className="ml-auto"
            onClick={() => onOpen(edit.resourceId)}
          >
            {t("Open in note")} <ExternalLinkIcon />
          </Button>
        ) : null}
      </footer>
    </section>
  );
}
