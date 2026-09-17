import {
  ExternalLinkIcon,
  FolderOpenIcon,
  PaperclipIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@resit/ui/components/button";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";
import { cn } from "@resit/ui/lib/utils";
import { CopyButton } from "@resit/ui/patterns/files/copy-button";

export interface AttachmentReference {
  title: string;
  subjectName: string;
}

export interface AttachmentDetailsProps extends Omit<
  ComponentProps<"section">,
  "title" | "onCopy"
> {
  title: string;
  /** Workspace-relative path. */
  path: string;
  sizeBytes: number;
  mediaType: string;
  sha256: string;
  addedAt: string | Date;
  modifiedAt: string | Date;
  referencedBy: AttachmentReference[];
  /** Path of the `.resit.json` sidecar that carries metadata for this file. */
  sidecar?: string;
  onOpen?: () => void;
  onShowInFolder?: () => void;
  onReplaceSource?: () => void;
  onMoveToTrash?: () => void;
  onOpenReference?: (reference: AttachmentReference) => void;
  onCopy?: (value: string) => void;
}

function truncateMiddle(value: string, keep = 8): string {
  if (value.length <= keep * 2 + 1) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 text-sm">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Mono({
  value,
  full,
  copyLabel,
  onCopy,
}: {
  value: string;
  full?: string;
  copyLabel: string;
  onCopy?: ((value: string) => void) | undefined;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <code
        className="min-w-0 truncate font-mono text-xs"
        title={full ?? value}
      >
        {value}
      </code>
      <CopyButton
        value={full ?? value}
        label={copyLabel}
        {...(onCopy ? { onCopy } : {})}
      />
    </span>
  );
}

export function AttachmentDetails({
  title,
  path,
  sizeBytes,
  mediaType,
  sha256,
  addedAt,
  modifiedAt,
  referencedBy,
  sidecar,
  onOpen,
  onShowInFolder,
  onReplaceSource,
  onMoveToTrash,
  onOpenReference,
  onCopy,
  className,
  ...props
}: AttachmentDetailsProps) {
  const { number, dateTime } = useLocale();
  return (
    <section
      data-slot="attachment-details"
      aria-label={`Details for ${title}`}
      className={cn("flex flex-col gap-4 p-4", className)}
      {...props}
    >
      <header className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <PaperclipIcon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold" title={title}>
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">Attachment</p>
        </div>
      </header>

      <dl className="flex flex-col gap-1.5">
        <Row label="Path">
          <Mono value={path} copyLabel="Copy path" onCopy={onCopy} />
        </Row>
        <Row label="Size">{formatBytes(sizeBytes, number)}</Row>
        <Row label="Type">
          <code className="font-mono text-xs">{mediaType}</code>
        </Row>
        <Row label="SHA-256">
          <Mono
            value={truncateMiddle(sha256)}
            full={sha256}
            copyLabel="Copy hash"
            onCopy={onCopy}
          />
        </Row>
        <Row label="Added">{dateTime(addedAt)}</Row>
        <Row label="Modified">{dateTime(modifiedAt)}</Row>
        {sidecar ? (
          <Row label="Sidecar">
            <Mono
              value={sidecar}
              copyLabel="Copy sidecar path"
              onCopy={onCopy}
            />
          </Row>
        ) : null}
      </dl>

      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">
          Referenced by
          {referencedBy.length > 0 ? ` (${number(referencedBy.length)})` : ""}
        </h3>
        {referencedBy.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes link to this file. Moving it to trash breaks nothing.
          </p>
        ) : (
          <ul className="flex flex-col">
            {referencedBy.map((reference) => (
              <li key={`${reference.subjectName}/${reference.title}`}>
                <button
                  type="button"
                  className="flex h-row w-full items-center gap-2 rounded-control px-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => onOpenReference?.(reference)}
                  title={reference.title}
                >
                  <span className="min-w-0 truncate">{reference.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {reference.subjectName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={() => onOpen?.()}>
          <ExternalLinkIcon />
          Open
        </Button>
        <Button variant="outline" size="sm" onClick={() => onShowInFolder?.()}>
          <FolderOpenIcon />
          Show in folder
        </Button>
        <Button variant="outline" size="sm" onClick={() => onReplaceSource?.()}>
          <RefreshCwIcon />
          Replace source
        </Button>
        <Button
          variant="destructive-outline"
          size="sm"
          onClick={() => onMoveToTrash?.()}
        >
          <Trash2Icon />
          Move to trash
        </Button>
      </div>
    </section>
  );
}
