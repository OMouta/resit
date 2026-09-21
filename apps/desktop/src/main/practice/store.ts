import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  attemptSchema,
  attemptScore,
  cardsFileSchema,
  DEFAULT_NEW_CARDS_PER_DAY,
  hasCloze,
  quizFileSchema,
  reviewEventSchema,
  type Attempt,
  type CardAction,
  type CardInput,
  type CardsFile,
  type Flashcard,
  type Outcome,
  type PracticeOverview,
  type Question,
  type QuestionInput,
  type QuizFile,
  type QuizSummary,
  type Rating,
  type Response,
  type ReviewEvent,
  type ReviewItem,
  type SubjectPractice,
} from "../../shared/practice";
import { exists, readJson, writeJson } from "../workspace/files";
import {
  moveToTrash,
  practiceDir,
  withLock,
  WorkspaceError,
  type OpenWorkspace,
} from "../workspace/workspace";
import {
  newSchedule,
  previewIntervals,
  rate,
  SCHEDULER_INFO,
} from "./scheduler";
import { t } from "../i18n";

export const PRACTICE_FORMAT_VERSION = 1;
const MAX_CARDS_PER_SUBJECT = 20_000;
const MAX_QUEUE = 500;
/** Cards still being learned come back this early within a session. */
const LEARN_AHEAD_MS = 20 * 60_000;

const now = () => new Date().toISOString();

/** Quiz files are named after their ID, so it has to be a safe filename. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;

function cardsPath(workspace: OpenWorkspace, subjectId: string): string {
  return join(practiceDir(workspace, subjectId), "cards.json");
}

function reviewsPath(workspace: OpenWorkspace, subjectId: string): string {
  return join(practiceDir(workspace, subjectId), "reviews.jsonl");
}

function quizzesDir(workspace: OpenWorkspace, subjectId: string): string {
  return join(practiceDir(workspace, subjectId), "quizzes");
}

function quizPath(
  workspace: OpenWorkspace,
  subjectId: string,
  quizId: string,
): string {
  if (!SAFE_ID.test(quizId))
    throw new WorkspaceError(t("That quiz is not in this subject."));
  return join(quizzesDir(workspace, subjectId), `${quizId}.json`);
}

/**
 * Reads one of a subject's practice files. A missing file means nothing yet;
 * one that cannot be parsed is an error, because it holds the student's work.
 */
async function readRecord<T>(
  path: string,
  what: string,
  parse: (raw: unknown) => { success: true; data: T } | { success: false },
): Promise<T | null> {
  if (!(await exists(path))) return null;
  let raw: unknown;
  try {
    raw = await readJson(path);
  } catch {
    throw new WorkspaceError(
      t("The {what} file is not valid JSON. It was left unchanged.", { what }),
    );
  }
  const parsed = parse(raw);
  if (!parsed.success)
    throw new WorkspaceError(
      t("The {what} file could not be read. It was left unchanged.", { what }),
    );
  return parsed.data;
}

async function loadCards(
  workspace: OpenWorkspace,
  subjectId: string,
): Promise<CardsFile> {
  const file = await readRecord(
    cardsPath(workspace, subjectId),
    t("flashcards"),
    (raw) => cardsFileSchema.safeParse(raw),
  );
  if (file && file.formatVersion > PRACTICE_FORMAT_VERSION)
    throw new WorkspaceError(
      t("These flashcards were written by a newer version of resit."),
    );
  return (
    file ?? {
      format: "resit-cards",
      formatVersion: PRACTICE_FORMAT_VERSION,
      scheduler: SCHEDULER_INFO,
      cards: [],
    }
  );
}

/** Reads, changes, and rewrites a subject's cards as a whole. */
function editCards<T>(
  workspace: OpenWorkspace,
  subjectId: string,
  change: (file: CardsFile) => T,
): Promise<T> {
  return withLock(workspace, `practice:cards:${subjectId}`, async () => {
    const file = await loadCards(workspace, subjectId);
    const result = change(file);
    await writeJson(cardsPath(workspace, subjectId), {
      ...file,
      formatVersion: PRACTICE_FORMAT_VERSION,
      scheduler: SCHEDULER_INFO,
    });
    return result;
  });
}

/** Every event in a subject's review log. A torn last line is skipped. */
async function readReviews(
  workspace: OpenWorkspace,
  subjectId: string,
): Promise<ReviewEvent[]> {
  const path = reviewsPath(workspace, subjectId);
  if (!(await exists(path))) return [];
  const events: ReviewEvent[] = [];
  for (const line of (await readFile(path, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = reviewEventSchema.safeParse(JSON.parse(line));
      if (parsed.success) events.push(parsed.data);
    } catch {
      // An interrupted append leaves half a line; the rest still counts.
    }
  }
  return events;
}

async function appendReview(
  workspace: OpenWorkspace,
  subjectId: string,
  event: ReviewEvent,
): Promise<void> {
  const path = reviewsPath(workspace, subjectId);
  await mkdir(practiceDir(workspace, subjectId), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
}

/** Reviews that still count: every review nobody undid. */
function standingReviews(events: ReviewEvent[]) {
  const undone = new Set(
    events.flatMap((event) => (event.type === "undo" ? [event.reviewId] : [])),
  );
  return events.flatMap((event) =>
    event.type === "review" && !undone.has(event.id) ? [event] : [],
  );
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function todayCounts(events: ReviewEvent[], at: Date) {
  let reviewed = 0;
  let introduced = 0;
  for (const review of standingReviews(events)) {
    if (!sameDay(new Date(review.at), at)) continue;
    reviewed += 1;
    if (review.previous.state === "new") introduced += 1;
  }
  return { reviewed, introduced };
}

export function newCardsPerDay(workspace: OpenWorkspace): number {
  const practice = (
    workspace.file as { practice?: { newCardsPerDay?: unknown } }
  ).practice;
  const value = practice?.newCardsPerDay;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? Math.min(value, 1000)
    : DEFAULT_NEW_CARDS_PER_DAY;
}

/** Stored in `workspace.json`, since it is about how the student studies. */
export function setNewCardsPerDay(
  workspace: OpenWorkspace,
  value: number,
): Promise<void> {
  return withLock(workspace, "workspace-file", async () => {
    const next = {
      ...workspace.file,
      practice: {
        ...((workspace.file as { practice?: object }).practice ?? {}),
        newCardsPerDay: value,
      },
      updatedAt: now(),
    };
    await writeJson(join(workspace.root, "workspace.json"), next);
    workspace.file = next;
  });
}

async function quizFiles(
  workspace: OpenWorkspace,
  subjectId: string,
): Promise<QuizFile[]> {
  const dir = quizzesDir(workspace, subjectId);
  if (!(await exists(dir))) return [];
  const quizzes: QuizFile[] = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed = quizFileSchema.safeParse(await readJson(join(dir, name)));
      if (parsed.success) quizzes.push(parsed.data);
    } catch {
      // A broken quiz file stays on disk and out of the list.
    }
  }
  return quizzes;
}

function summarize(subjectId: string, quiz: QuizFile): QuizSummary {
  const submitted = quiz.attempts
    .filter((attempt) => attempt.submittedAt)
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  const last = submitted[0];
  return {
    id: quiz.id,
    subjectId,
    title: quiz.title,
    ...(quiz.topic ? { topic: quiz.topic } : {}),
    ...(quiz.author ? { author: quiz.author } : {}),
    questionCount: quiz.questions.length,
    ...(last
      ? {
          last: {
            ...attemptScore(last),
            at: last.submittedAt ?? last.updatedAt,
          },
        }
      : {}),
    ...(quiz.attempts.some((attempt) => !attempt.submittedAt)
      ? { unfinished: true }
      : {}),
    updatedAt: quiz.updatedAt,
  };
}

/** Everything the Practice tab shows, for every subject. */
export async function listPractice(
  workspace: OpenWorkspace,
): Promise<PracticeOverview> {
  const at = new Date();
  const result: SubjectPractice[] = [];
  for (const subjectId of workspace.subjects.keys()) {
    const [file, events, quizzes] = await Promise.all([
      loadCards(workspace, subjectId),
      readReviews(workspace, subjectId),
      quizFiles(workspace, subjectId),
    ]);
    const today = todayCounts(events, at);
    result.push({
      subjectId,
      cards: file.cards,
      quizzes: quizzes
        .map((quiz) => summarize(subjectId, quiz))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      reviewedToday: today.reviewed,
      newToday: today.introduced,
    });
  }
  return { newCardsPerDay: newCardsPerDay(workspace), subjects: result };
}

function checkCard(input: CardInput): void {
  if (!input.front.trim())
    throw new WorkspaceError(t("A card needs something on its front."));
  if (input.kind === "cloze" && !hasCloze(input.front))
    throw new WorkspaceError(
      t(
        "A cloze card needs at least one hidden part, written {{c1::like this}}.",
      ),
    );
  if (input.kind === "basic" && !input.back.trim())
    throw new WorkspaceError(t("A card needs an answer on its back."));
}

function cleanTopic(topic: string | undefined): string | undefined {
  const trimmed = topic?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Adds cards to a subject. The assistant's cards wait as suggestions until
 * the student keeps them.
 */
export async function createCards(
  workspace: OpenWorkspace,
  subjectId: string,
  inputs: CardInput[],
  options: { author?: "assistant" } = {},
): Promise<Flashcard[]> {
  if (!workspace.subjects.has(subjectId))
    throw new WorkspaceError(t("That subject no longer exists."));
  inputs.forEach(checkCard);
  return editCards(workspace, subjectId, (file) => {
    if (file.cards.length + inputs.length > MAX_CARDS_PER_SUBJECT)
      throw new WorkspaceError(
        t("A subject holds at most {count} cards.", {
          count: MAX_CARDS_PER_SUBJECT,
        }),
      );
    const at = new Date();
    const created = inputs.map((input): Flashcard => {
      const topic = cleanTopic(input.topic);
      return {
        id: randomUUID(),
        kind: input.kind,
        front: input.front.trim(),
        back: input.back.trim(),
        ...(topic ? { topic } : {}),
        ...(input.source ? { source: input.source } : {}),
        ...(options.author ? { author: options.author } : {}),
        status: options.author ? "suggested" : "active",
        schedule: newSchedule(at),
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
      };
    });
    file.cards.push(...created);
    return created;
  });
}

/** Changes a card's text. Its schedule and history stay. */
export async function updateCard(
  workspace: OpenWorkspace,
  subjectId: string,
  id: string,
  input: CardInput,
): Promise<Flashcard> {
  checkCard(input);
  return editCards(workspace, subjectId, (file) => {
    const index = file.cards.findIndex((card) => card.id === id);
    const current = file.cards[index];
    if (!current) throw new WorkspaceError(t("That card is no longer here."));
    const topic = cleanTopic(input.topic);
    const source = input.source ?? current.source;
    const { topic: _topic, source: _source, ...rest } = current;
    const next: Flashcard = {
      ...rest,
      kind: input.kind,
      front: input.front.trim(),
      back: input.back.trim(),
      ...(topic ? { topic } : {}),
      ...(source ? { source } : {}),
      updatedAt: now(),
    };
    file.cards[index] = next;
    return next;
  });
}

/**
 * Keeps suggested cards, suspends or resumes cards, starts their schedule
 * again, or deletes them. A reset is logged so the old schedule can be read.
 */
export async function changeCards(
  workspace: OpenWorkspace,
  subjectId: string,
  ids: string[],
  action: CardAction,
): Promise<void> {
  const wanted = new Set(ids);
  const resets: ReviewEvent[] = [];
  await editCards(workspace, subjectId, (file) => {
    const at = new Date();
    if (action === "delete") {
      file.cards = file.cards.filter((card) => !wanted.has(card.id));
      return;
    }
    file.cards = file.cards.map((card) => {
      if (!wanted.has(card.id)) return card;
      const updatedAt = at.toISOString();
      switch (action) {
        case "keep":
          return card.status === "suggested"
            ? { ...card, status: "active", updatedAt }
            : card;
        case "suspend":
          return { ...card, status: "suspended", updatedAt };
        case "resume":
          return card.status === "suspended"
            ? { ...card, status: "active", updatedAt }
            : card;
        case "reset":
          resets.push({
            type: "reset",
            cardId: card.id,
            at: updatedAt,
            previous: card.schedule,
          });
          return { ...card, schedule: newSchedule(at), updatedAt };
      }
    });
  });
  for (const event of resets) await appendReview(workspace, subjectId, event);
}

/**
 * Cards to review now: those due, and new ones up to the day's allowance.
 * Cards being learned come back a little early, so a session can finish
 * them instead of leaving each one a few minutes short.
 */
export async function reviewQueue(
  workspace: OpenWorkspace,
  filter: { subjectId?: string | undefined; topic?: string | undefined } = {},
): Promise<ReviewItem[]> {
  const at = new Date();
  const subjectIds = filter.subjectId
    ? [filter.subjectId]
    : [...workspace.subjects.keys()];
  const due: ReviewItem[] = [];
  const fresh: ReviewItem[] = [];
  let introducedToday = 0;
  for (const subjectId of subjectIds) {
    if (!workspace.subjects.has(subjectId)) continue;
    const [file, events] = await Promise.all([
      loadCards(workspace, subjectId),
      readReviews(workspace, subjectId),
    ]);
    introducedToday += todayCounts(events, at).introduced;
    for (const card of file.cards) {
      if (card.status !== "active") continue;
      if (filter.topic && card.topic !== filter.topic) continue;
      const item = () => ({
        subjectId,
        card,
        intervals: previewIntervals(card.schedule, at),
      });
      if (card.schedule.state === "new") fresh.push(item());
      else {
        const dueAt = Date.parse(card.schedule.due);
        const learning = card.schedule.state !== "review";
        if (
          dueAt <= at.getTime() ||
          (learning && dueAt - at.getTime() <= LEARN_AHEAD_MS)
        )
          due.push(item());
      }
    }
  }
  due.sort((a, b) => a.card.schedule.due.localeCompare(b.card.schedule.due));
  fresh.sort((a, b) => a.card.createdAt.localeCompare(b.card.createdAt));
  const allowance = Math.max(0, newCardsPerDay(workspace) - introducedToday);
  return [...due, ...fresh.slice(0, allowance)].slice(0, MAX_QUEUE);
}

export async function rateCard(
  workspace: OpenWorkspace,
  input: {
    subjectId: string;
    cardId: string;
    rating: Rating;
    durationMs?: number | undefined;
  },
): Promise<{ reviewId: string; card: Flashcard }> {
  const reviewId = randomUUID();
  const at = new Date();
  let event: ReviewEvent | null = null;
  const card = await editCards(workspace, input.subjectId, (file) => {
    const index = file.cards.findIndex((entry) => entry.id === input.cardId);
    const current = file.cards[index];
    if (!current) throw new WorkspaceError(t("That card is no longer here."));
    const schedule = rate(current.schedule, input.rating, at);
    event = {
      type: "review",
      id: reviewId,
      cardId: current.id,
      rating: input.rating,
      at: at.toISOString(),
      ...(input.durationMs !== undefined
        ? { durationMs: input.durationMs }
        : {}),
      previous: current.schedule,
      next: schedule,
    };
    const next = { ...current, schedule };
    file.cards[index] = next;
    return next;
  });
  if (event) await appendReview(workspace, input.subjectId, event);
  return { reviewId, card };
}

/**
 * Puts a card back the way it was before one review. Only the card's latest
 * review can be undone, so a later rating is never lost.
 */
export async function undoReview(
  workspace: OpenWorkspace,
  subjectId: string,
  reviewId: string,
): Promise<Flashcard> {
  const events = await readReviews(workspace, subjectId);
  const review = standingReviews(events).find((event) => event.id === reviewId);
  if (!review)
    throw new WorkspaceError(t("That review can no longer be undone."));
  const card = await editCards(workspace, subjectId, (file) => {
    const index = file.cards.findIndex((entry) => entry.id === review.cardId);
    const current = file.cards[index];
    if (!current) throw new WorkspaceError(t("That card is no longer here."));
    if (JSON.stringify(current.schedule) !== JSON.stringify(review.next))
      throw new WorkspaceError(
        t(
          "That card has changed since, so the review can no longer be undone.",
        ),
      );
    const next = { ...current, schedule: review.previous };
    file.cards[index] = next;
    return next;
  });
  await appendReview(workspace, subjectId, {
    type: "undo",
    reviewId,
    at: now(),
  });
  return card;
}

/** A subject's standing reviews, newest last, for practice history. */
export async function cardReviews(workspace: OpenWorkspace, subjectId: string) {
  return standingReviews(await readReviews(workspace, subjectId));
}

export async function subjectCards(
  workspace: OpenWorkspace,
  subjectId: string,
): Promise<Flashcard[]> {
  return (await loadCards(workspace, subjectId)).cards;
}

// Quizzes

export async function readQuiz(
  workspace: OpenWorkspace,
  subjectId: string,
  quizId: string,
): Promise<QuizFile> {
  const quiz = await readRecord(
    quizPath(workspace, subjectId, quizId),
    t("quiz"),
    (raw) => quizFileSchema.safeParse(raw),
  );
  if (!quiz) throw new WorkspaceError(t("That quiz is no longer here."));
  if (quiz.formatVersion > PRACTICE_FORMAT_VERSION)
    throw new WorkspaceError(
      t("This quiz was written by a newer version of resit."),
    );
  return quiz;
}

export async function listQuizzes(
  workspace: OpenWorkspace,
  subjectId: string,
): Promise<QuizFile[]> {
  return quizFiles(workspace, subjectId);
}

function editQuiz<T>(
  workspace: OpenWorkspace,
  subjectId: string,
  quizId: string,
  change: (quiz: QuizFile) => T,
): Promise<T> {
  return withLock(workspace, `practice:quiz:${quizId}`, async () => {
    const quiz = await readQuiz(workspace, subjectId, quizId);
    const result = change(quiz);
    await writeJson(quizPath(workspace, subjectId, quizId), quiz);
    return result;
  });
}

function toQuestion(input: QuestionInput, index: number): Question {
  const which = t("Question {number}", { number: index + 1 });
  const prompt = input.prompt.trim();
  if (!prompt)
    throw new WorkspaceError(t("{which} has no question.", { which }));
  const answer = input.answer?.trim();
  const options = input.options?.map((option) => option.trim()).filter(Boolean);
  if (input.kind === "choice") {
    if (!options || options.length < 2)
      throw new WorkspaceError(
        t("{which} needs at least two options.", { which }),
      );
    if (new Set(options).size !== options.length)
      throw new WorkspaceError(
        t("{which} lists the same option twice.", { which }),
      );
    if (!answer || !options.includes(answer))
      throw new WorkspaceError(
        t("{which} needs one of its options marked right.", { which }),
      );
  }
  if (input.kind === "short" && !answer)
    throw new WorkspaceError(
      t("{which} needs the answer to compare against.", { which }),
    );
  const accept = input.accept?.map((entry) => entry.trim()).filter(Boolean);
  const optional = (key: "hint" | "solution" | "topic") => {
    const value = input[key]?.trim();
    return value ? { [key]: value } : {};
  };
  return {
    id: input.id && SAFE_ID.test(input.id) ? input.id : randomUUID(),
    kind: input.kind,
    prompt,
    ...(input.kind === "choice" ? { options } : {}),
    ...(answer ? { answer } : {}),
    ...(input.kind === "short" && accept?.length ? { accept } : {}),
    ...optional("hint"),
    ...optional("solution"),
    ...optional("topic"),
    ...(input.source ? { source: input.source } : {}),
  };
}

/** Creates a quiz, or replaces an existing quiz's title and questions. */
export async function saveQuiz(
  workspace: OpenWorkspace,
  subjectId: string,
  input: {
    id?: string | undefined;
    title: string;
    topic?: string | undefined;
    questions: QuestionInput[];
    author?: "assistant" | undefined;
  },
): Promise<QuizFile> {
  if (!workspace.subjects.has(subjectId))
    throw new WorkspaceError(t("That subject no longer exists."));
  const title = input.title.trim();
  if (!title) throw new WorkspaceError(t("A quiz needs a title."));
  if (input.questions.length === 0)
    throw new WorkspaceError(t("A quiz needs at least one question."));
  const questions = input.questions.map(toQuestion);
  if (
    new Set(questions.map((question) => question.id)).size !== questions.length
  )
    throw new WorkspaceError(t("Two questions share an ID."));
  const topic = cleanTopic(input.topic);
  if (input.id) {
    return editQuiz(workspace, subjectId, input.id, (quiz) => {
      quiz.title = title;
      if (topic) quiz.topic = topic;
      else delete quiz.topic;
      quiz.questions = questions;
      quiz.updatedAt = now();
      return quiz;
    });
  }
  const at = now();
  const quiz: QuizFile = {
    format: "resit-quiz",
    formatVersion: PRACTICE_FORMAT_VERSION,
    id: randomUUID(),
    title,
    ...(topic ? { topic } : {}),
    ...(input.author ? { author: input.author } : {}),
    questions,
    attempts: [],
    createdAt: at,
    updatedAt: at,
  };
  await mkdir(quizzesDir(workspace, subjectId), { recursive: true });
  await writeJson(quizPath(workspace, subjectId, quiz.id), quiz);
  return quiz;
}

export async function deleteQuiz(
  workspace: OpenWorkspace,
  subjectId: string,
  quizId: string,
): Promise<void> {
  const quiz = await readQuiz(workspace, subjectId, quizId);
  await withLock(workspace, `practice:quiz:${quizId}`, () =>
    moveToTrash(workspace, [quizPath(workspace, subjectId, quizId)], {
      kind: "quiz",
      title: quiz.title,
    }),
  );
}

/** Carries on an unfinished attempt, or starts a new one. */
export function startAttempt(
  workspace: OpenWorkspace,
  subjectId: string,
  quizId: string,
): Promise<Attempt> {
  return editQuiz(workspace, subjectId, quizId, (quiz) => {
    const open = quiz.attempts.find((attempt) => !attempt.submittedAt);
    if (open) return open;
    if (quiz.questions.length === 0)
      throw new WorkspaceError(t("This quiz has no questions yet."));
    const at = now();
    const attempt: Attempt = {
      id: randomUUID(),
      questions: quiz.questions,
      responses: {},
      startedAt: at,
      updatedAt: at,
    };
    quiz.attempts.push(attempt);
    return attempt;
  });
}

function findAttempt(quiz: QuizFile, attemptId: string): Attempt {
  const attempt = quiz.attempts.find((entry) => entry.id === attemptId);
  if (!attempt) throw new WorkspaceError(t("That attempt is no longer here."));
  return attempt;
}

/** Keeps answers as they are typed, so an interrupted attempt carries on. */
export function saveResponses(
  workspace: OpenWorkspace,
  subjectId: string,
  quizId: string,
  attemptId: string,
  responses: Record<string, Omit<Response, "mark">>,
): Promise<void> {
  return editQuiz(workspace, subjectId, quizId, (quiz) => {
    const attempt = findAttempt(quiz, attemptId);
    if (attempt.submittedAt)
      throw new WorkspaceError(t("This attempt was already handed in."));
    attempt.responses = pickResponses(attempt, responses);
    attempt.updatedAt = now();
  });
}

function pickResponses(
  attempt: Attempt,
  responses: Record<string, Omit<Response, "mark">>,
): Attempt["responses"] {
  const kept: Attempt["responses"] = {};
  for (const question of attempt.questions) {
    const response = responses[question.id];
    if (response) kept[question.id] = cleanResponse(response);
  }
  return kept;
}

function cleanResponse(response: Omit<Response, "mark">): Response {
  return {
    answer: response.answer,
    ...(response.flagged ? { flagged: true } : {}),
    ...(response.hintShown ? { hintShown: true } : {}),
  };
}

/** Lowercase, no accents, no dollar signs, no spaces around operators. */
function normalizeAnswer(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*([=+\-*/^(),;:<>])\s*/g, "$1")
    .replace(/[.。]$/, "");
}

/** A plain number, a decimal with a comma, or a simple fraction. */
function numberValue(text: string): number | null {
  const value = normalizeAnswer(text).replace(/(\d),(\d)/g, "$1.$2");
  const fraction = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(value);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  return /^-?\d+(?:\.\d+)?(?:e-?\d+)?$/.test(value) ? Number(value) : null;
}

/**
 * Marks an answer that can be marked by comparison. Worked answers return
 * null: the student marks those against the solution.
 */
export function checkAnswer(
  question: Question,
  answer: string,
): Outcome | null {
  if (question.kind === "worked") return null;
  if (!answer.trim()) return "incorrect";
  if (question.kind === "choice")
    return answer === question.answer ? "correct" : "incorrect";
  const expected = [question.answer ?? "", ...(question.accept ?? [])].filter(
    Boolean,
  );
  const given = normalizeAnswer(answer);
  const givenNumber = numberValue(answer);
  for (const entry of expected) {
    if (normalizeAnswer(entry) === given) return "correct";
    const target = numberValue(entry);
    if (
      target !== null &&
      givenNumber !== null &&
      Math.abs(target - givenNumber) <= 1e-9 * Math.max(1, Math.abs(target))
    )
      return "correct";
  }
  return "incorrect";
}

/** Hands an attempt in and marks every answer that can be compared. */
export function submitAttempt(
  workspace: OpenWorkspace,
  subjectId: string,
  quizId: string,
  attemptId: string,
  responses: Record<string, Omit<Response, "mark">>,
): Promise<Attempt> {
  return editQuiz(workspace, subjectId, quizId, (quiz) => {
    const attempt = findAttempt(quiz, attemptId);
    if (attempt.submittedAt)
      throw new WorkspaceError(t("This attempt was already handed in."));
    const kept = pickResponses(attempt, responses);
    for (const question of attempt.questions) {
      const response = kept[question.id] ?? { answer: "" };
      const outcome = checkAnswer(question, response.answer);
      kept[question.id] = {
        ...response,
        ...(outcome ? { mark: { outcome, by: "check" as const } } : {}),
      };
    }
    const at = now();
    attempt.responses = kept;
    attempt.submittedAt = at;
    attempt.updatedAt = at;
    quiz.updatedAt = at;
    return attemptSchema.parse(attempt);
  });
}

/** The student's own mark on one answer, which replaces resit's. */
export function markResponse(
  workspace: OpenWorkspace,
  subjectId: string,
  quizId: string,
  input: { attemptId: string; questionId: string; outcome: Outcome },
): Promise<Attempt> {
  return editQuiz(workspace, subjectId, quizId, (quiz) => {
    const attempt = findAttempt(quiz, input.attemptId);
    if (!attempt.submittedAt)
      throw new WorkspaceError(t("Hand the attempt in before marking it."));
    if (!attempt.questions.some((question) => question.id === input.questionId))
      throw new WorkspaceError(t("That question is not in this attempt."));
    const response = attempt.responses[input.questionId] ?? { answer: "" };
    attempt.responses[input.questionId] = {
      ...response,
      mark: { outcome: input.outcome, by: "student" },
    };
    attempt.updatedAt = now();
    return attempt;
  });
}
