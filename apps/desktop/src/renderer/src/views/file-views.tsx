import { ExternalLinkIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { EmptyState } from "@resit/ui/components/empty-state";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";
import { ToolbarButton } from "@resit/ui/patterns/document/toolbar-button";

import type { ResourceInfo } from "../../../shared/workspace";
import { api, errorMessage } from "../lib/api";

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** An image resource with zoom. Bytes come from the main process, never a path. */
export function ImageView({ resource }: { resource: ResourceInfo }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const extension = resource.path.split(".").at(-1)?.toLowerCase() ?? "";
    api.readResourceBytes(resource.id).then(
      (bytes) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          new Blob([bytes as Uint8Array<ArrayBuffer>], {
            type: IMAGE_TYPES[extension] ?? "application/octet-stream",
          }),
        );
        setUrl(objectUrl);
      },
      (reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      },
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resource.id, resource.path]);

  if (error)
    return (
      <EmptyState
        className="h-full"
        title="This image could not be opened"
        description={error}
      />
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="toolbar"
        aria-label="Image tools"
        className="flex h-toolbar shrink-0 items-center gap-1 border-b bg-background px-2"
      >
        <ToolbarButton
          label="Zoom out"
          disabled={scale <= 0.25}
          onClick={() => setScale((value) => Math.max(0.25, value - 0.25))}
        >
          <ZoomOutIcon />
        </ToolbarButton>
        <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarButton
          label="Zoom in"
          disabled={scale >= 4}
          onClick={() => setScale((value) => Math.min(4, value + 0.25))}
        >
          <ZoomInIcon />
        </ToolbarButton>
        <Button
          size="sm"
          variant="subtle"
          className="ml-auto"
          onClick={() => void api.openResourceExternally(resource.id)}
        >
          <ExternalLinkIcon /> Open in default app
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-canvas p-6">
        {url ? (
          <img
            src={url}
            alt={resource.title}
            style={{ width: `${scale * 100}%` }}
            className="mx-auto max-w-none rounded-md shadow-sm"
          />
        ) : null}
      </div>
    </div>
  );
}

/** Any other file: its details and a deliberate open action. */
export function AttachmentView({ resource }: { resource: ResourceInfo }) {
  const { relative, number } = useLocale();
  return (
    <div className="flex h-full items-center justify-center bg-canvas">
      <EmptyState
        title={resource.title}
        description={`${formatBytes(resource.size, number)} · added ${relative(resource.updatedAt)}. resit does not read this file type, so it is not searchable and the AI cannot see its contents.`}
        actions={
          <Button
            variant="secondary"
            onClick={() => void api.openResourceExternally(resource.id)}
          >
            <ExternalLinkIcon /> Open in default app
          </Button>
        }
      />
    </div>
  );
}
