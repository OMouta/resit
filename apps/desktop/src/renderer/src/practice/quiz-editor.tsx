import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

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
import { RadioGroup, RadioGroupItem } from "@resit/ui/components/radio-group";
import { ScrollArea } from "@resit/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@resit/ui/components/select";
import { Textarea } from "@resit/ui/components/textarea";
import { cn } from "@resit/ui/lib/utils";

import type {
  Question,
  QuestionInput,
  QuestionKind,
  QuizFile,
} from "../../../shared/practice";
import type { SubjectInfo } from "../../../shared/workspace";
import { api } from "../lib/api";
import { useNotices } from "../lib/notices";

export interface QuizEditorRequest {
  /** The quiz to edit. Without one, the editor makes a new quiz. */
  quiz?: QuizFile;
  subjectId?: string;
}

const KIND_LABELS: Record<QuestionKind, string> = {
  choice: "Multiple choice",
  short: "Short answer",
  worked: "Worked answer",
};

interface Draft {
  key: string;
  /** Kept for questions that already exist. */
  id?: string;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  /** Index of the right option. */
  right: number;
  answer: string;
  /** Other accepted answers, one per line. */
  accept: string;
  hint: string;
  solution: string;
  /** Carried through untouched: set by the assistant, not edited here. */
  topic?: string;
  source?: Question["source"];
}

function emptyDraft(kind: QuestionKind = "short"): Draft {
  return {
    key: crypto.randomUUID(),
    kind,
    prompt: "",
    options: ["", ""],
    right: 0,
    answer: "",
    accept: "",
    hint: "",
    solution: "",
  };
}

function toDraft(question: Question): Draft {
  const options = question.options ?? ["", ""];
  return {
    key: question.id,
    id: question.id,
    kind: question.kind,
    prompt: question.prompt,
    options,
    right: Math.max(0, options.indexOf(question.answer ?? "")),
    answer: question.kind === "choice" ? "" : (question.answer ?? ""),
    accept: (question.accept ?? []).join("\n"),
    hint: question.hint ?? "",
    solution: question.solution ?? "",
    ...(question.topic ? { topic: question.topic } : {}),
    ...(question.source ? { source: question.source } : {}),
  };
}

function toInput(draft: Draft): QuestionInput {
  const options = draft.options.map((option) => option.trim());
  const accept = draft.accept
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    ...(draft.id ? { id: draft.id } : {}),
    kind: draft.kind,
    prompt: draft.prompt,
    ...(draft.kind === "choice"
      ? { options: options.filter(Boolean), answer: options[draft.right] ?? "" }
      : draft.answer.trim()
        ? { answer: draft.answer.trim() }
        : {}),
    ...(draft.kind === "short" && accept.length ? { accept } : {}),
    ...(draft.hint.trim() ? { hint: draft.hint } : {}),
    ...(draft.solution.trim() ? { solution: draft.solution } : {}),
    ...(draft.topic ? { topic: draft.topic } : {}),
    ...(draft.source ? { source: draft.source } : {}),
  };
}

/** Why a question cannot be saved yet, or nothing when it can. */
function problem(draft: Draft): string | null {
  if (!draft.prompt.trim()) return "Write the question.";
  if (draft.kind === "choice") {
    const filled = draft.options.filter((option) => option.trim());
    if (filled.length < 2) return "Give at least two options.";
    if (!draft.options[draft.right]?.trim()) return "Mark the right option.";
  }
  if (draft.kind === "short" && !draft.answer.trim())
    return "Give the answer to compare against.";
  return null;
}

/** Writes a quiz's questions: multiple choice, short answers, and worked problems. */
export function QuizEditor({
  request,
  subjects,
  onClose,
  onSaved,
}: {
  request: QuizEditorRequest | null;
  subjects: SubjectInfo[];
  onClose: () => void;
  onSaved: (subjectId: string, quiz: QuizFile) => void;
}) {
  const notices = useNotices();
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!request) return;
    setSubjectId(request.subjectId ?? subjects[0]?.id ?? "");
    setTitle(request.quiz?.title ?? "");
    setTopic(request.quiz?.topic ?? "");
    setDrafts(
      request.quiz ? request.quiz.questions.map(toDraft) : [emptyDraft()],
    );
    setTried(false);
  }, [request, subjects]);

  const update = (key: string, change: Partial<Draft>) =>
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...change } : draft,
      ),
    );
  const move = (index: number, by: -1 | 1) =>
    setDrafts((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(index + by, 0, moved);
      return next;
    });

  const problems = drafts.map(problem);
  const ready =
    Boolean(subjectId) &&
    title.trim().length > 0 &&
    drafts.length > 0 &&
    problems.every((entry) => entry === null);

  const save = async () => {
    setTried(true);
    if (!request || !ready) return;
    setBusy(true);
    try {
      const quiz = await api.saveQuiz({
        subjectId,
        ...(request.quiz ? { id: request.quiz.id } : {}),
        title: title.trim(),
        ...(topic.trim() ? { topic: topic.trim() } : {}),
        questions: drafts.map(toInput),
      });
      onSaved(subjectId, quiz);
      onClose();
    } catch (error) {
      notices.fail("The quiz was not saved", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(52rem,calc(100vh-4rem))] flex-col gap-0 p-0 sm:max-w-2xl">
        {request ? (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <DialogHeader className="px-5 pt-5 pb-4">
              <DialogTitle>
                {request.quiz ? "Edit quiz" : "New quiz"}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="min-h-0 flex-1 border-y">
              <div className="flex flex-col gap-5 px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {request.quiz ? null : (
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label htmlFor="quiz-subject">Subject</Label>
                      <Select value={subjectId} onValueChange={setSubjectId}>
                        <SelectTrigger id="quiz-subject" className="w-full">
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
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="quiz-title">Title</Label>
                    <Input
                      id="quiz-title"
                      autoFocus
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Limits, week 1"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="quiz-topic">Topic</Label>
                    <Input
                      id="quiz-topic"
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder="Limits"
                    />
                  </div>
                </div>
                {drafts.map((draft, index) => (
                  <QuestionFields
                    key={draft.key}
                    draft={draft}
                    number={index + 1}
                    problem={tried ? (problems[index] ?? null) : null}
                    onChange={(change) => update(draft.key, change)}
                    onMoveUp={index > 0 ? () => move(index, -1) : undefined}
                    onMoveDown={
                      index < drafts.length - 1
                        ? () => move(index, 1)
                        : undefined
                    }
                    onRemove={
                      drafts.length > 1
                        ? () =>
                            setDrafts((current) =>
                              current.filter(
                                (entry) => entry.key !== draft.key,
                              ),
                            )
                        : undefined
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start"
                  onClick={() =>
                    setDrafts((current) => [
                      ...current,
                      emptyDraft(current.at(-1)?.kind),
                    ])
                  }
                >
                  <PlusIcon /> Add question
                </Button>
              </div>
            </ScrollArea>
            <DialogFooter className="px-5 py-4">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || (tried && !ready)}>
                {request.quiz ? "Save" : "Create quiz"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function QuestionFields({
  draft,
  number,
  problem,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  draft: Draft;
  number: number;
  problem: string | null;
  onChange: (change: Partial<Draft>) => void;
  onMoveUp: (() => void) | undefined;
  onMoveDown: (() => void) | undefined;
  onRemove: (() => void) | undefined;
}) {
  const field = (name: string) => `question-${draft.key}-${name}`;
  return (
    <section
      aria-label={`Question ${number}`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background p-3",
        problem && "border-destructive/50",
      )}
    >
      <header className="flex items-center gap-2">
        <span className="text-sm font-semibold">Question {number}</span>
        <Select
          value={draft.kind}
          onValueChange={(value) => onChange({ kind: value as QuestionKind })}
        >
          <SelectTrigger
            size="sm"
            aria-label={`Question ${number} type`}
            className="w-40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABELS) as QuestionKind[]).map((kind) => (
              <SelectItem key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="subtle"
            size="icon-sm"
            aria-label="Move up"
            disabled={!onMoveUp}
            onClick={onMoveUp}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="subtle"
            size="icon-sm"
            aria-label="Move down"
            disabled={!onMoveDown}
            onClick={onMoveDown}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            type="button"
            variant="subtle"
            size="icon-sm"
            aria-label={`Remove question ${number}`}
            disabled={!onRemove}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </span>
      </header>
      <Textarea
        aria-label={`Question ${number}`}
        value={draft.prompt}
        onChange={(event) => onChange({ prompt: event.target.value })}
        placeholder="Compute $\lim_{x \to 0} \frac{\sin 3x}{x}$."
        className="min-h-16"
      />
      {draft.kind === "choice" ? (
        <div className="flex flex-col gap-1.5">
          <p id={field("options")} className="text-xs text-muted-foreground">
            Options. Pick the right one.
          </p>
          <RadioGroup
            aria-labelledby={field("options")}
            value={String(draft.right)}
            onValueChange={(value) => onChange({ right: Number(value) })}
            className="gap-1.5"
          >
            {draft.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <RadioGroupItem
                  value={String(index)}
                  aria-label={`Option ${index + 1} is right`}
                />
                <Input
                  aria-label={`Option ${index + 1}`}
                  value={option}
                  onChange={(event) =>
                    onChange({
                      options: draft.options.map((entry, at) =>
                        at === index ? event.target.value : entry,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="subtle"
                  size="icon-sm"
                  aria-label={`Remove option ${index + 1}`}
                  disabled={draft.options.length <= 2}
                  onClick={() =>
                    onChange({
                      options: draft.options.filter((_, at) => at !== index),
                      right:
                        draft.right > index
                          ? draft.right - 1
                          : draft.right === index
                            ? 0
                            : draft.right,
                    })
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </RadioGroup>
          {draft.options.length < 12 ? (
            <Button
              type="button"
              variant="subtle"
              size="sm"
              className="self-start"
              onClick={() => onChange({ options: [...draft.options, ""] })}
            >
              <PlusIcon /> Add option
            </Button>
          ) : null}
        </div>
      ) : null}
      {draft.kind === "short" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={field("answer")}>Answer</Label>
            <Input
              id={field("answer")}
              value={draft.answer}
              onChange={(event) => onChange({ answer: event.target.value })}
              placeholder="3"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={field("accept")}>Also accept, one per line</Label>
            <Textarea
              id={field("accept")}
              value={draft.accept}
              onChange={(event) => onChange({ accept: event.target.value })}
              className="min-h-control"
            />
          </div>
        </div>
      ) : null}
      {draft.kind === "worked" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={field("answer")}>Final answer (optional)</Label>
          <Input
            id={field("answer")}
            value={draft.answer}
            onChange={(event) => onChange({ answer: event.target.value })}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={field("solution")}>
          {draft.kind === "worked"
            ? "Worked solution"
            : "Explanation (optional)"}
        </Label>
        <Textarea
          id={field("solution")}
          value={draft.solution}
          onChange={(event) => onChange({ solution: event.target.value })}
          className="min-h-16"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={field("hint")}>Hint (optional)</Label>
        <Input
          id={field("hint")}
          value={draft.hint}
          onChange={(event) => onChange({ hint: event.target.value })}
        />
      </div>
      {problem ? (
        <p className="text-xs text-destructive" role="alert">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
