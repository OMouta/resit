import { useState } from "react";

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
import { useLocale } from "@resit/ui/hooks/use-locale";

export interface UnsavedFile {
  id: string;
  title: string;
  subjectName?: string;
}

export interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: UnsavedFile[];
  /** Save the selected files, then continue. */
  onSave: (ids: string[]) => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/** Asked before closing, switching workspace, or exporting with unsaved notes. */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  files,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(files.map((file) => file.id)),
  );
  const single = files[0];
  const multiple = files.length > 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {multiple
              ? t("Save changes to {count} notes?", { count: files.length })
              : single
                ? t("Save changes to {title}?", { title: single.title })
                : t("Save changes to this note?")}
          </DialogTitle>
          <DialogDescription>
            {multiple
              ? t(
                  "Unsaved notes are listed below. Unchecked notes keep their draft in the recovery folder.",
                )
              : t(
                  "If you don’t save, the draft stays in the recovery folder until you reopen the note.",
                )}
          </DialogDescription>
        </DialogHeader>
        {multiple ? (
          <ul className="flex max-h-56 flex-col gap-1 overflow-auto rounded-lg border p-2">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent"
              >
                <Checkbox
                  id={`unsaved-${file.id}`}
                  checked={selected.has(file.id)}
                  onCheckedChange={(checked) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (checked === true) next.add(file.id);
                      else next.delete(file.id);
                      return next;
                    })
                  }
                />
                <Label
                  htmlFor={`unsaved-${file.id}`}
                  className="min-w-0 flex-1 cursor-pointer font-normal"
                >
                  <span className="truncate">{file.title}</span>
                  {file.subjectName ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {file.subjectName}
                    </span>
                  ) : null}
                </Label>
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter className="sm:justify-between">
          <Button variant="destructive-outline" onClick={onDiscard}>
            {t("Don’t save")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={() => onSave(Array.from(selected))}
              disabled={multiple && selected.size === 0}
            >
              {multiple
                ? t("Save {count}", { count: selected.size })
                : t("Save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
