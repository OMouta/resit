import { CheckIcon, PlayIcon, SkipForwardIcon, Trash2Icon } from "lucide-react";
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
import { InlineMessage } from "@resit/ui/components/inline-message";
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

import {
  busySessions,
  isOverdue,
  localInstant,
  minutesOf,
  overlaps,
  SESSION_KIND_LABELS,
  SESSION_KIND_VALUES,
  withinAvailability,
  type PlanFile,
  type SessionKind,
  type SessionStatus,
  type SessionTarget,
  type StudySession,
} from "../../../shared/planning";
import type { PracticeOverview } from "../../../shared/practice";
import type { WorkspaceSnapshot } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";
import { nextHour } from "../lib/plan";

export interface SessionRequest {
  /** The session to change. Without one, the dialog adds a session. */
  session?: StudySession;
  initial?: { date?: string; subjectId?: string };
}

const NO_SUBJECT = "none";
const NO_TARGET = "none";

function targetValue(target: SessionTarget | undefined): string {
  if (!target) return NO_TARGET;
  if (target.type === "resource") return `resource:${target.resourceId}`;
  if (target.type === "quiz")
    return `quiz:${target.subjectId}:${target.quizId}`;
  return `cards:${target.subjectId}`;
}

function parseTarget(value: string): SessionTarget | undefined {
  const [type, first, second] = value.split(":");
  if (type === "resource" && first) return { type, resourceId: first };
  if (type === "quiz" && first && second)
    return { type, subjectId: first, quizId: second };
  if (type === "cards" && first) return { type, subjectId: first };
  return undefined;
}

/** Adds a study session, or changes, completes, skips, or deletes one. */
export function SessionDialog({
  request,
  snapshot,
  plan,
  practice,
  onClose,
  onStart,
}: {
  request: SessionRequest | null;
  snapshot: WorkspaceSnapshot;
  plan: PlanFile | null;
  practice: PracticeOverview | null;
  onClose: () => void;
  onStart: (session: StudySession) => void;
}) {
  const notices = useNotices();
  const { date: formatDate } = useLocale();
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(NO_SUBJECT);
  const [kind, setKind] = useState<SessionKind>("reading");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [target, setTarget] = useState(NO_TARGET);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const existing = request?.session;
  const subjects = snapshot.subjects.filter((subject) => !subject.archived);

  useEffect(() => {
    if (!request) return;
    const session = request.session;
    const slot = nextHour();
    setTitle(session?.title ?? "");
    setSubjectId(
      session?.subjectId ??
        request.initial?.subjectId ??
        subjects[0]?.id ??
        NO_SUBJECT,
    );
    setKind(session?.kind ?? "reading");
    setDate(session?.date ?? request.initial?.date ?? slot.date);
    setStart(session?.start ?? slot.start);
    setEnd(session?.end ?? slot.end);
    setTarget(targetValue(session?.target));
    setNotes(session?.notes ?? "");
    // Only when the dialog opens: the subject list changing keeps the form.
  }, [request]);

  const resources = snapshot.resources
    .filter(
      (resource) =>
        resource.subjectId === subjectId &&
        (resource.kind === "note" || resource.kind === "pdf"),
    )
    .sort((a, b) => a.title.localeCompare(b.title));
  const quizzes =
    practice?.subjects.find((entry) => entry.subjectId === subjectId)
      ?.quizzes ?? [];

  const validTimes =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    /^\d{2}:\d{2}$/.test(start) &&
    /^\d{2}:\d{2}$/.test(end);
  const backwards = validTimes && minutesOf(end) <= minutesOf(start);
  const slot = { date, start, end };
  const clashes =
    plan && validTimes && !backwards
      ? busySessions(plan).filter(
          (session) => session.id !== existing?.id && overlaps(session, slot),
        )
      : [];
  const outside =
    plan &&
    validTimes &&
    !backwards &&
    plan.availability.length > 0 &&
    !withinAvailability(slot, plan.availability);
  const ready = title.trim().length > 0 && validTimes && !backwards;

  const chooseTarget = (value: string) => {
    setTarget(value);
    const parsed = parseTarget(value);
    if (parsed?.type === "quiz") setKind("quiz");
    else if (parsed?.type === "cards") setKind("flashcards");
    if (!title.trim() && parsed) {
      if (parsed.type === "resource")
        setTitle(
          snapshot.resources.find((entry) => entry.id === parsed.resourceId)
            ?.title ?? "",
        );
      else if (parsed.type === "quiz")
        setTitle(
          quizzes.find((quiz) => quiz.id === parsed.quizId)?.title ?? "",
        );
      else setTitle("Flashcards");
    }
  };

  const save = async () => {
    if (!ready) return;
    setBusy(true);
    const parsed = parseTarget(target);
    try {
      await api.saveSession({
        ...(existing ? { id: existing.id } : {}),
        title: title.trim(),
        ...(subjectId !== NO_SUBJECT ? { subjectId } : {}),
        kind,
        date,
        start,
        end,
        ...(parsed ? { target: parsed } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (error) {
      notices.fail("The session was not saved", error);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: SessionStatus) => {
    if (!existing) return;
    try {
      await api.setSessionStatus({ id: existing.id, status });
      onClose();
    } catch (error) {
      notices.fail("The session was not changed", error);
    }
  };

  const remove = async () => {
    if (!existing) return;
    try {
      await api.deleteSession(existing.id);
      onClose();
    } catch (error) {
      notices.fail("The session was not deleted", error);
    }
  };

  const status = existing
    ? existing.proposal
      ? "Suggested by the assistant"
      : isOverdue(existing)
        ? "Missed"
        : existing.status === "done"
          ? "Done"
          : existing.status === "skipped"
            ? "Skipped"
            : "Planned"
    : null;

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
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
                {existing ? existing.title : "New session"}
              </DialogTitle>
              {existing ? (
                <DialogDescription>
                  {status} ·{" "}
                  {formatDate(localInstant(existing.date, "12:00"), {
                    weekday: "long",
                    year: undefined,
                  })}
                  , {existing.start}–{existing.end}
                </DialogDescription>
              ) : null}
            </DialogHeader>
            {existing && !existing.proposal ? (
              <div className="flex flex-wrap gap-2">
                {existing.target ? (
                  <Button
                    type="button"
                    onClick={() => {
                      onStart(existing);
                      onClose();
                    }}
                  >
                    <PlayIcon /> Start
                  </Button>
                ) : null}
                {existing.status === "planned" ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void setStatus("done")}
                    >
                      <CheckIcon /> Mark done
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void setStatus("skipped")}
                    >
                      <SkipForwardIcon /> Skip
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void setStatus("planned")}
                  >
                    Mark as planned
                  </Button>
                )}
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                autoFocus={!existing}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Worksheet 2, questions 1–5"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="session-subject">Subject</Label>
                <Select
                  value={subjectId}
                  onValueChange={(value) => {
                    setSubjectId(value);
                    setTarget(NO_TARGET);
                  }}
                >
                  <SelectTrigger id="session-subject" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NO_SUBJECT}>No subject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="session-kind">Kind</Label>
                <Select
                  value={kind}
                  onValueChange={(value) => setKind(value as SessionKind)}
                >
                  <SelectTrigger id="session-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_KIND_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SESSION_KIND_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="session-date">Day</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="session-start">From</Label>
                <Input
                  id="session-start"
                  type="time"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="session-end">To</Label>
                <Input
                  id="session-end"
                  type="time"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  aria-invalid={backwards || undefined}
                />
              </div>
            </div>
            {subjectId !== NO_SUBJECT ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="session-target">Opens</Label>
                <Select value={target} onValueChange={chooseTarget}>
                  <SelectTrigger id="session-target" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TARGET}>Nothing</SelectItem>
                    <SelectItem value={`cards:${subjectId}`}>
                      Flashcards due in this subject
                    </SelectItem>
                    {quizzes.map((quiz) => (
                      <SelectItem
                        key={quiz.id}
                        value={`quiz:${subjectId}:${quiz.id}`}
                      >
                        Quiz: {quiz.title}
                      </SelectItem>
                    ))}
                    {resources.map((resource) => (
                      <SelectItem
                        key={resource.id}
                        value={`resource:${resource.id}`}
                      >
                        {resource.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-notes">Notes</Label>
              <Textarea
                id="session-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-14"
              />
            </div>
            {backwards ? (
              <InlineMessage tone="error">
                <p>The session has to end after it starts.</p>
              </InlineMessage>
            ) : clashes.length > 0 || outside ? (
              <InlineMessage tone="warning">
                {clashes.map((clash) => (
                  <p key={clash.id}>
                    Overlaps “{clash.title}”, {clash.start}–{clash.end}.
                  </p>
                ))}
                {outside ? <p>This is outside your study times.</p> : null}
              </InlineMessage>
            ) : null}
            <DialogFooter className="sm:justify-between">
              {existing ? (
                <Button
                  type="button"
                  variant="destructive-outline"
                  onClick={() => void remove()}
                >
                  <Trash2Icon /> Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !ready}>
                  {existing ? "Save" : "Add session"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
