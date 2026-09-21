import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import { Checkbox } from "@resit/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { Label } from "@resit/ui/components/label";
import { Progress } from "@resit/ui/components/progress";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";
import { msg } from "@resit/ui/lib/i18n";

import type { PackageOptions } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";
import { flushAllViews } from "../views/view-registry";

const CHOICES: { key: keyof PackageOptions; label: string }[] = [
  { key: "conversations", label: msg("Conversations") },
  { key: "learner", label: msg("Learner profile") },
  { key: "history", label: msg("Version history") },
  { key: "trash", label: msg("Trash") },
];

/** Bytes written so far, while a package is being written or opened. */
export function usePackageProgress(
  running: boolean,
): { done: number; total: number } | null {
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  useEffect(() => {
    if (!running) {
      setProgress(null);
      return;
    }
    return api.onEvent((event) => {
      if (event.type === "package-progress")
        setProgress({ done: event.done, total: event.total });
    });
  }, [running]);
  return progress;
}

export function PackageProgress({
  progress,
  label,
}: {
  progress: { done: number; total: number } | null;
  label: string;
}) {
  const { t, number } = useLocale();
  const total = progress?.total ?? 0;
  return (
    <div role="status" className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        {total > 0 ? (
          <span className="tabular-nums text-muted-foreground">
            {t("{done} of {total}", {
              done: formatBytes(progress?.done ?? 0, number),
              total: formatBytes(total, number),
            })}
          </span>
        ) : null}
      </div>
      <Progress
        value={total > 0 ? ((progress?.done ?? 0) / total) * 100 : 0}
        indeterminate={total === 0}
        aria-label={label}
      />
    </div>
  );
}

/** Saves the whole workspace as one .resit archive. */
export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const notices = useNotices();
  const [options, setOptions] = useState<PackageOptions>({
    conversations: true,
    learner: true,
    history: false,
    trash: false,
  });
  const [running, setRunning] = useState(false);
  const progress = usePackageProgress(running);

  const run = async () => {
    setRunning(true);
    try {
      await flushAllViews();
      const path = await api.exportWorkspace(options);
      if (path) {
        onOpenChange(false);
        notices.notify({
          tone: "success",
          title: t("The workspace was exported"),
          detail: path,
        });
      }
    } catch (error) {
      notices.fail(t("The workspace was not exported"), error);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!running) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Export workspace")}</DialogTitle>
          <DialogDescription>
            {t(
              "Saves the workspace as one .resit file. Open it in resit on another computer to carry on there.",
            )}
          </DialogDescription>
        </DialogHeader>
        {progress ? (
          <PackageProgress progress={progress} label={t("Exporting")} />
        ) : (
          <fieldset className="flex flex-col gap-3" disabled={running}>
            <legend className="mb-3 text-sm font-medium">{t("Include")}</legend>
            {CHOICES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2.5">
                <Checkbox
                  id={`export-${key}`}
                  checked={options[key]}
                  onCheckedChange={(checked) =>
                    setOptions((current) => ({
                      ...current,
                      [key]: checked === true,
                    }))
                  }
                />
                <Label htmlFor={`export-${key}`} className="font-normal">
                  {t(label)}
                </Label>
              </div>
            ))}
          </fieldset>
        )}
        <DialogFooter>
          {progress ? (
            <Button variant="outline" onClick={() => void api.stopPackage()}>
              {t("Stop")}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("Cancel")}
              </Button>
              <Button disabled={running} onClick={() => void run()}>
                {t("Export…")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
