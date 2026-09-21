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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import {
  SUBJECT_COLORS,
  subjectColorClasses,
  subjectColorLabels,
} from "@resit/ui/lib/subject-color";
import { cn } from "@resit/ui/lib/utils";
import { useLocale } from "@resit/ui/hooks/use-locale";

import {
  subjectNameFromCourse,
  type MoodleCourse,
} from "../../../shared/moodle";
import type { SubjectColorValue } from "../../../shared/workspace";

const NO_COURSE = "none";

export interface SubjectRequest {
  title: string;
  submitLabel: string;
  name?: string;
  color?: SubjectColorValue;
  /** Offers the Moodle course picker, when courses are known. */
  linkable?: boolean;
  onSubmit: (values: {
    name: string;
    color: SubjectColorValue;
    moodleCourseId?: number;
  }) => Promise<void>;
}

/** Name and colour for a new or existing subject. */
export function SubjectDialog({
  request,
  courses,
  onClose,
}: {
  request: SubjectRequest | null;
  /** Moodle courses, once they have loaded. */
  courses?: MoodleCourse[] | undefined;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [color, setColor] = useState<SubjectColorValue>("blue");
  const [course, setCourse] = useState(NO_COURSE);
  /** The last name filled in from a course, so a typed name is never replaced. */
  const [suggested, setSuggested] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setName(request.name ?? "");
    setColor(request.color ?? "blue");
    setCourse(NO_COURSE);
    setSuggested("");
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
                await request.onSubmit({
                  name: name.trim(),
                  color,
                  ...(course === NO_COURSE
                    ? {}
                    : { moodleCourseId: Number(course) }),
                });
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
              <Label htmlFor="subject-name">{t("Name")}</Label>
              <Input
                id="subject-name"
                autoFocus
                value={name}
                placeholder={t("Mathematics")}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t("Colour")}</span>
              <div
                role="radiogroup"
                aria-label={t("Subject colour")}
                className="flex flex-wrap items-center gap-1.5"
              >
                {SUBJECT_COLORS.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    role="radio"
                    aria-checked={color === entry}
                    aria-label={t(subjectColorLabels[entry])}
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
                <span className="ml-1 text-xs text-muted-foreground">
                  {t(subjectColorLabels[color])}
                </span>
              </div>
            </div>
            {request.linkable && courses && courses.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject-course">{t("Moodle course")}</Label>
                <Select
                  value={course}
                  onValueChange={(value) => {
                    setCourse(value);
                    const picked = courses.find(
                      (entry) => String(entry.id) === value,
                    );
                    const next = picked ? subjectNameFromCourse(picked) : "";
                    if (!name.trim() || name === suggested) {
                      setName(next);
                      setSuggested(next);
                    }
                  }}
                >
                  <SelectTrigger id="subject-course" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COURSE}>{t("Not linked")}</SelectItem>
                    {courses.map((entry) => (
                      <SelectItem key={entry.id} value={String(entry.id)}>
                        {entry.fullname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                {t("Cancel")}
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
  const { t } = useLocale();
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
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
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
