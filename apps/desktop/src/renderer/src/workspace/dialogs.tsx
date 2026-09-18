import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@resit/ui/components/alert-dialog";
import { Button } from "@resit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@resit/ui/components/dialog";
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import {
  SUBJECT_COLORS,
  subjectColorClasses,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";

import type { SubjectColorValue } from "../../../shared/workspace";

export interface SubjectRequest {
  title: string;
  submitLabel: string;
  name?: string;
  color?: SubjectColorValue;
  onSubmit: (values: {
    name: string;
    color: SubjectColorValue;
  }) => Promise<void>;
}

/** Name and colour for a new or existing subject. */
export function SubjectDialog({
  request,
  onClose,
}: {
  request: SubjectRequest | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<SubjectColorValue>("blue");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setName(request.name ?? "");
    setColor(request.color ?? "blue");
  }, [request]);

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {request ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!name.trim()) return;
              setBusy(true);
              try {
                await request.onSubmit({ name: name.trim(), color });
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{request.title}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject-name">Name</Label>
              <Input
                id="subject-name"
                autoFocus
                value={name}
                placeholder="Mathematics"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Colour</span>
              <div
                role="radiogroup"
                aria-label="Subject colour"
                className="flex flex-wrap items-center gap-1.5"
              >
                {SUBJECT_COLORS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    role="radio"
                    aria-checked={color === entry}
                    aria-label={entry}
                    onClick={() => setColor(entry)}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      subjectColorClasses[entry].softBg,
                      color === entry &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-background",
                    )}
                  >
                    <span
                      className={cn(
                        "size-3 rounded-full",
                        subjectColorClasses[entry].dot,
                      )}
                    />
                  </button>
                ))}
                <span className="ml-1 text-xs text-muted-foreground capitalize">
                  {color}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {request.submitLabel}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        {request ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{request.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {request.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void request.onConfirm().finally(onClose)}
              >
                {request.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
