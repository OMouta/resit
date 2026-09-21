import { useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { formatBytes } from "@resit/ui/lib/format-bytes";

import type { AppState } from "../../../shared/ipc";
import type { PackageSummary } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";
import { PackageProgress, usePackageProgress } from "./export-dialog";

export interface ChosenArchive {
  path: string;
  summary: PackageSummary;
}

/**
 * What a .resit archive holds, before it is copied into a new folder and
 * opened.
 */
export function ArchiveDialog({
  archive,
  onClose,
  onOpened,
}: {
  archive: ChosenArchive | null;
  onClose: () => void;
  onOpened: (state: AppState) => void;
}) {
  const notices = useNotices();
  const { date, number } = useLocale();
  const [running, setRunning] = useState(false);
  const progress = usePackageProgress(running);

  const open = async () => {
    if (!archive) return;
    setRunning(true);
    try {
      const state = await api.openArchive(archive.path);
      if (state) {
        onClose();
        onOpened(state);
      }
    } catch (error) {
      notices.fail("The archive was not opened", error);
    } finally {
      setRunning(false);
    }
  };

  const summary = archive?.summary;
  return (
    <Dialog
      open={archive !== null}
      onOpenChange={(next) => {
        if (!next && !running) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Open “{summary?.workspaceName ?? "workspace"}”
          </DialogTitle>
          <DialogDescription>
            {summary
              ? `${number(summary.files)} ${summary.files === 1 ? "file" : "files"}, ${formatBytes(summary.bytes, number)}, exported ${date(summary.exportedAt)}. `
              : null}
            resit copies it into a new folder inside the one you choose, then
            opens it.
          </DialogDescription>
        </DialogHeader>
        {progress ? (
          <PackageProgress progress={progress} label="Copying files" />
        ) : null}
        <DialogFooter>
          {progress ? (
            <Button variant="outline" onClick={() => void api.stopPackage()}>
              Stop
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={running} onClick={() => void open()}>
                Choose folder…
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
