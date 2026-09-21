import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@resit/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@resit/ui/components/textarea";
import { useLocale } from "@resit/ui/hooks/use-locale";
import { msg } from "@resit/ui/lib/i18n";

import {
  minutesOf,
  type Assessment,
  type Availability,
} from "../../../shared/planning";
import type { SubjectInfo } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";
import { today } from "../lib/plan";

const NO_SUBJECT = "none";

export interface AssessmentRequest {
  assessment?: Assessment;
}

/** An exam, test, or deadline the student is working towards. */
export function AssessmentDialog({
  request,
  subjects,
  onClose,
}: {
  request: AssessmentRequest | null;
  subjects: SubjectInfo[];
  onClose: () => void;
}) {
  const { t } = useLocale();
  const notices = useNotices();
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(NO_SUBJECT);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const existing = request?.assessment;

  useEffect(() => {
    if (!request) return;
    setTitle(request.assessment?.title ?? "");
    setSubjectId(
      request.assessment?.subjectId ?? subjects[0]?.id ?? NO_SUBJECT,
    );
    setDate(request.assessment?.date ?? today());
    setTime(request.assessment?.time ?? "");
    setNotes(request.assessment?.notes ?? "");
    // Only when the dialog opens.
  }, [request]);

  const ready = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await api.saveAssessment({
        ...(existing ? { id: existing.id } : {}),
        title: title.trim(),
        ...(subjectId !== NO_SUBJECT ? { subjectId } : {}),
        date,
        ...(time ? { time } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (error) {
      notices.fail(t("The assessment was not saved"), error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    try {
      await api.deleteAssessment(existing.id);
      onClose();
    } catch (error) {
      notices.fail(t("The assessment was not deleted"), error);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {request ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {existing ? t("Edit assessment") : t("New assessment")}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assessment-title">{t("Title")}</Label>
              <Input
                id="assessment-title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("Mathematics resit")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assessment-subject">{t("Subject")}</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger id="assessment-subject" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_SUBJECT}>{t("No subject")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assessment-date">{t("Day")}</Label>
                <Input
                  id="assessment-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assessment-time">{t("Time (optional)")}</Label>
                <Input
                  id="assessment-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assessment-notes">{t("Notes")}</Label>
              <Textarea
                id="assessment-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t("Room B204. Chapters 1–4.")}
                className="min-h-14"
              />
            </div>
            <DialogFooter className="sm:justify-between">
              {existing ? (
                <Button
                  type="button"
                  variant="destructive-outline"
                  onClick={() => void remove()}
                >
                  <Trash2Icon /> {t("Delete")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  {t("Cancel")}
                </Button>
                <Button type="submit" disabled={busy || !ready}>
                  {existing ? t("Save") : t("Add assessment")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const WEEKDAYS = [
  msg("Monday"),
  msg("Tuesday"),
  msg("Wednesday"),
  msg("Thursday"),
  msg("Friday"),
  msg("Saturday"),
  msg("Sunday"),
];

/** The times each week the student keeps for study. */
export function AvailabilityDialog({
  open,
  availability,
  onClose,
}: {
  open: boolean;
  availability: Availability[];
  onClose: () => void;
}) {
  const { t } = useLocale();
  const notices = useNotices();
  const [slots, setSlots] = useState<(Availability & { key: string })[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      setSlots(
        availability.map((slot) => ({ ...slot, key: crypto.randomUUID() })),
      );
    // Only when the dialog opens.
  }, [open]);

  const update = (key: string, change: Partial<Availability>) =>
    setSlots((current) =>
      current.map((slot) => (slot.key === key ? { ...slot, ...change } : slot)),
    );
  const invalid = slots.some(
    (slot) => minutesOf(slot.end) <= minutesOf(slot.start),
  );

  const save = async () => {
    setBusy(true);
    try {
      await api.setAvailability(
        slots.map(({ weekday, start, end }) => ({ weekday, start, end })),
      );
      onClose();
    } catch (error) {
      notices.fail(t("The study times were not saved"), error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("Study times")}</DialogTitle>
            <DialogDescription>
              {t(
                "When you can study each week. The assistant only suggests sessions inside these times.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col divide-y rounded-lg border">
            {WEEKDAYS.map((name, index) => {
              const weekday = index + 1;
              const day = slots.filter((slot) => slot.weekday === weekday);
              return (
                <div key={name} className="flex items-start gap-3 px-3 py-2">
                  <span className="flex h-control w-24 shrink-0 items-center text-sm font-medium">
                    {t(name)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {day.map((slot) => (
                      <div key={slot.key} className="flex items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${name} from`}
                          value={slot.start}
                          onChange={(event) =>
                            update(slot.key, { start: event.target.value })
                          }
                          className="w-28"
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="time"
                          aria-label={`${name} to`}
                          value={slot.end}
                          onChange={(event) =>
                            update(slot.key, { end: event.target.value })
                          }
                          aria-invalid={
                            minutesOf(slot.end) <= minutesOf(slot.start) ||
                            undefined
                          }
                          className="w-28"
                        />
                        <Button
                          type="button"
                          variant="subtle"
                          size="icon"
                          aria-label={`Remove ${name} ${slot.start}–${slot.end}`}
                          onClick={() =>
                            setSlots((current) =>
                              current.filter((entry) => entry.key !== slot.key),
                            )
                          }
                        >
                          <XIcon />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="subtle"
                      className="self-start"
                      onClick={() =>
                        setSlots((current) => [
                          ...current,
                          {
                            key: crypto.randomUUID(),
                            weekday,
                            start: "18:00",
                            end: "20:00",
                          },
                        ])
                      }
                    >
                      <PlusIcon />{" "}
                      {day.length === 0 ? t("Add a time") : t("Add")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={busy || invalid}>
              {t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
