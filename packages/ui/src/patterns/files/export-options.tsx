import { CheckCircle2Icon, FolderOpenIcon, XCircleIcon } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@resit/ui/components/badge";
import { Button } from "@resit/ui/components/button";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import { Progress } from "@resit/ui/components/progress";
import { RadioGroup, RadioGroupItem } from "@resit/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";
import { cn } from "@resit/ui/lib/utils";

export interface ExportFormat {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}

export interface ExportScope {
  id: string;
  label: string;
  count: string;
}

export type ExportStatus =
  | { kind: "idle" }
  | { kind: "exporting"; progress: number }
  | { kind: "done"; path: string }
  | { kind: "failed"; message: string };

export interface ExportOptionsProps {
  formats: ExportFormat[];
  scopes: ExportScope[];
  estimateBytes: number;
  status: ExportStatus;
  defaultFormatId?: string;
  defaultScopeId?: string;
  defaultDestination?: string;
  onChooseDestination?: () => void;
  onExport: (options: {
    formatId: string;
    scopeId: string;
    destination: string;
  }) => void;
  onCancel?: () => void;
  onShowInFolder?: (path: string) => void;
  className?: string;
}

/** Export form: format, scope, destination, and the run states. */
export function ExportOptions({
  formats,
  scopes,
  estimateBytes,
  status,
  defaultFormatId,
  defaultScopeId,
  defaultDestination = "",
  onChooseDestination,
  onExport,
  onCancel,
  onShowInFolder,
  className,
}: ExportOptionsProps) {
  const [formatId, setFormatId] = useState(
    defaultFormatId ?? formats[0]?.id ?? "",
  );
  const [scopeId, setScopeId] = useState(defaultScopeId ?? scopes[0]?.id ?? "");
  const [destination, setDestination] = useState(defaultDestination);
  const id = useId();
  const { number, t, tx } = useLocale();
  const busy = status.kind === "exporting";
  return (
    <form
      data-slot="export-options"
      className={cn("flex flex-col gap-5", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onExport({ formatId, scopeId, destination });
      }}
    >
      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className="mb-1 text-sm font-medium">{t("Format")}</legend>
        <RadioGroup
          value={formatId}
          onValueChange={setFormatId}
          className="gap-1.5"
        >
          {formats.map((format) => (
            <Label
              key={format.id}
              htmlFor={`${id}-${format.id}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 font-normal hover:bg-accent",
                formatId === format.id && "border-primary/50 bg-selection",
              )}
            >
              <RadioGroupItem
                id={`${id}-${format.id}`}
                value={format.id}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {format.label}
                  {format.recommended ? (
                    <Badge variant="info">{t("Recommended")}</Badge>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format.description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
      <div className="grid gap-4 @md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-scope`}>{t("What to include")}</Label>
          <Select value={scopeId} onValueChange={setScopeId} disabled={busy}>
            <SelectTrigger id={`${id}-scope`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((scope) => (
                <SelectItem key={scope.id} value={scope.id}>
                  {scope.label}{" "}
                  <span className="text-muted-foreground">· {scope.count}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t(
              "About {size}. Machine settings and provider logins are never included.",
              { size: formatBytes(estimateBytes, number) },
            )}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-dest`}>{t("Save to")}</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-dest`}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder={t("Choose a folder")}
              className="font-mono text-xs"
              disabled={busy}
            />
            <Button
              type="button"
              variant="outline"
              onClick={onChooseDestination}
              disabled={busy}
            >
              <FolderOpenIcon /> {t("Choose…")}
            </Button>
          </div>
        </div>
      </div>
      {status.kind === "exporting" ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"
        >
          <div className="flex items-center justify-between text-sm">
            <span>{t("Exporting…")}</span>
            <span className="tabular-nums text-muted-foreground">
              {Math.round(status.progress * 100)}%
            </span>
          </div>
          <Progress
            value={status.progress * 100}
            aria-label={t("Export progress")}
          />
        </div>
      ) : null}
      {status.kind === "done" ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft p-3 text-sm"
        >
          <CheckCircle2Icon className="size-4 text-success" />
          <span className="min-w-0 flex-1 truncate">
            {tx("Exported to {path}", {
              path: <code className="font-mono text-xs">{status.path}</code>,
            })}
          </span>
          {onShowInFolder ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onShowInFolder(status.path)}
            >
              {t("Show in folder")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {status.kind === "failed" ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-danger-soft p-3 text-sm"
        >
          <XCircleIcon className="size-4 text-destructive" />
          <span className="min-w-0 flex-1">{status.message}</span>
        </div>
      ) : null}
      <footer className="flex justify-end gap-2">
        {busy ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("Cancel")}
          </Button>
        ) : (
          <Button type="submit" disabled={!destination.trim()}>
            {status.kind === "failed" ? t("Try again") : t("Export")}
          </Button>
        )}
      </footer>
    </form>
  );
}
