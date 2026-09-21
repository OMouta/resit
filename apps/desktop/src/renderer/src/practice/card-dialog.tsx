import { EyeOffIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { Input } from "@resit/ui/components/input";
import { Label } from "@resit/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@resit/ui/components/tabs";
import { Textarea } from "@resit/ui/components/textarea";
import { MathText } from "@resit/ui/patterns/document/math";

import {
  CLOZE_PATTERN,
  type CardKind,
  type Flashcard,
  type PracticeOverview,
  type PracticeSource,
} from "../../../shared/practice";
import type { SubjectInfo } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";
import { topicsOf } from "../lib/practice";

export interface CardRequest {
  /** The card to edit. Without one, the dialog adds a card. */
  card?: Flashcard;
  subjectId?: string;
  initial?: {
    kind?: CardKind;
    front?: string;
    back?: string;
    topic?: string;
  };
  source?: PracticeSource;
  /** How to name the source, such as "Worksheet 1, p. 7". */
  sourceLabel?: string;
}

/** The next free cloze number in a card's text. */
function nextCloze(text: string): number {
  let highest = 0;
  for (const match of text.matchAll(/\{\{c(\d+)::/g))
    highest = Math.max(highest, Number(match[1]));
  return highest + 1;
}

function clozePreview(text: string): string {
  return text.replace(new RegExp(CLOZE_PATTERN.source, "g"), "[…]");
}

/** Adds a flashcard to a subject, or edits one. */
export function CardDialog({
  request,
  subjects,
  onClose,
}: {
  request: CardRequest | null;
  subjects: SubjectInfo[];
  onClose: () => void;
}) {
  const notices = useNotices();
  const [practice, setPractice] = useState<PracticeOverview | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [kind, setKind] = useState<CardKind>("basic");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topic, setTopic] = useState("");
  const [restart, setRestart] = useState(false);
  const [busy, setBusy] = useState(false);
  const frontRef = useRef<HTMLTextAreaElement>(null);

  const editing = request?.card;

  useEffect(() => {
    if (!request) return;
    const card = request.card;
    setSubjectId(request.subjectId ?? subjects[0]?.id ?? "");
    setKind(card?.kind ?? request.initial?.kind ?? "basic");
    setFront(card?.front ?? request.initial?.front ?? "");
    setBack(card?.back ?? request.initial?.back ?? "");
    setTopic(card?.topic ?? request.initial?.topic ?? "");
    setRestart(false);
    // Only for topic suggestions, so a failure just leaves none.
    api.listPractice().then(setPractice, () => undefined);
  }, [request, subjects]);

  const topics = subjectId ? topicsOf(practice, subjectId) : [];
  const reviewed = (editing?.schedule.reps ?? 0) > 0;
  const changedQuestion =
    editing !== undefined && front.trim() !== editing.front;
  const ready =
    Boolean(subjectId) &&
    front.trim().length > 0 &&
    (kind === "cloze"
      ? /\{\{c\d+::.+?\}\}/.test(front)
      : back.trim().length > 0);

  const hideSelection = () => {
    const field = frontRef.current;
    if (!field) return;
    const { selectionStart, selectionEnd } = field;
    if (selectionStart === selectionEnd) return;
    const hidden = front.slice(selectionStart, selectionEnd);
    const wrapped = `{{c${nextCloze(front)}::${hidden}}}`;
    setFront(
      front.slice(0, selectionStart) + wrapped + front.slice(selectionEnd),
    );
    window.requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(
        selectionStart + wrapped.length,
        selectionStart + wrapped.length,
      );
    });
  };

  const save = async (another: boolean) => {
    if (!request || !ready) return;
    setBusy(true);
    const source = request.source ?? editing?.source;
    const input = {
      kind,
      front,
      back,
      ...(topic.trim() ? { topic: topic.trim() } : {}),
      ...(source ? { source } : {}),
    };
    try {
      if (editing) {
        await api.updateCard({ subjectId, id: editing.id, ...input });
        if (restart)
          await api.changeCards({
            subjectId,
            ids: [editing.id],
            action: "reset",
          });
      } else await api.createCard({ subjectId, ...input });
      if (another) {
        setFront("");
        setBack("");
        frontRef.current?.focus();
      } else onClose();
    } catch (error) {
      notices.fail(
        editing ? "The card was not saved" : "The card was not added",
        error,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {request ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>{editing ? "Edit card" : "New card"}</DialogTitle>
              {request.sourceLabel ? (
                <DialogDescription>
                  From {request.sourceLabel}
                </DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="flex flex-wrap items-end gap-3">
              {editing ? null : (
                <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                  <Label htmlFor="card-subject">Subject</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger id="card-subject" className="w-full">
                      <SelectValue placeholder="Choose a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Tabs
                value={kind}
                onValueChange={(value) => setKind(value as CardKind)}
              >
                <TabsList aria-label="Card type">
                  <TabsTrigger value="basic">Question and answer</TabsTrigger>
                  <TabsTrigger value="cloze">Fill the gap</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="card-front">
                  {kind === "cloze" ? "Text" : "Question"}
                </Label>
                {kind === "cloze" ? (
                  <Button
                    type="button"
                    variant="subtle"
                    size="sm"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={hideSelection}
                  >
                    <EyeOffIcon /> Hide selected text
                  </Button>
                ) : null}
              </div>
              <Textarea
                id="card-front"
                ref={frontRef}
                autoFocus
                value={front}
                onChange={(event) => setFront(event.target.value)}
                placeholder={
                  kind === "cloze"
                    ? "The derivative of $\\sin x$ is {{c1::$\\cos x$}}."
                    : "What is $\\lim_{x \\to 0} \\frac{\\sin x}{x}$?"
                }
                className="min-h-20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-back">
                {kind === "cloze" ? "Extra (optional)" : "Answer"}
              </Label>
              <Textarea
                id="card-back"
                value={back}
                onChange={(event) => setBack(event.target.value)}
                placeholder={
                  kind === "cloze" ? "Shown after the gap is revealed" : "$1$"
                }
                className="min-h-16"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-topic">Topic</Label>
              <Input
                id="card-topic"
                list="card-topics"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Limits"
              />
              <datalist id="card-topics">
                {topics.map((entry) => (
                  <option key={entry} value={entry} />
                ))}
              </datalist>
            </div>
            {front.includes("$") || back.includes("$") ? (
              <div className="document flex max-w-none flex-col gap-1 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <MathText paragraphClassName="my-0">
                  {kind === "cloze" ? clozePreview(front) : front}
                </MathText>
                {back.trim() ? (
                  <MathText
                    className="border-t pt-1 text-muted-foreground"
                    paragraphClassName="my-0"
                  >
                    {back}
                  </MathText>
                ) : null}
              </div>
            ) : null}
            {editing && reviewed && changedQuestion ? (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={restart}
                  onCheckedChange={(value) => setRestart(value === true)}
                  className="mt-0.5"
                />
                <span>
                  Start its schedule again
                  <span className="block text-xs text-muted-foreground">
                    The question changed, so what you remembered may no longer
                    apply.
                  </span>
                </span>
              </label>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              {editing ? null : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !ready}
                  onClick={() => void save(true)}
                >
                  Add another
                </Button>
              )}
              <Button type="submit" disabled={busy || !ready}>
                {editing ? "Save" : "Add card"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
