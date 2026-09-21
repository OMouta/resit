import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type { ConversationScope } from "../../shared/conversations";
import {
  learnerFileSchema,
  topicKey,
  type LearnerFile,
  type LearnerProfile,
  type Preferences,
  type PreferencesPatch,
  type Topic,
  type TopicEvidence,
  type TopicInput,
  type TopicLevel,
  type TopicProposal,
} from "../../shared/learner";
import { cardReviews, listQuizzes, subjectCards } from "../practice/store";
import { exists, readJson, writeJson } from "../workspace/files";
import {
  withLock,
  WorkspaceError,
  type OpenWorkspace,
} from "../workspace/workspace";
import { t } from "../i18n";

export const LEARNER_FORMAT_VERSION = 1;
const MAX_TOPICS = 1000;
/** Evidence older than this says little about the student now. */
const EVIDENCE_DAYS = 30;
/** The most topics the assistant is told about in one message. */
const MAX_CONTEXT_TOPICS = 40;

const now = () => new Date().toISOString();

export function learnerPath(workspace: OpenWorkspace): string {
  return join(workspace.root, "learner.json");
}

function emptyProfile(): LearnerFile {
  return {
    format: "resit-learner",
    formatVersion: LEARNER_FORMAT_VERSION,
    personalization: true,
    preferences: { detail: "standard", hintsFirst: false },
    topics: [],
    proposals: [],
  };
}

export async function readLearner(
  workspace: OpenWorkspace,
): Promise<LearnerFile> {
  const path = learnerPath(workspace);
  if (!(await exists(path))) return emptyProfile();
  let raw: unknown;
  try {
    raw = await readJson(path);
  } catch {
    throw new WorkspaceError(
      t("learner.json is not valid JSON. It was left unchanged."),
    );
  }
  const parsed = learnerFileSchema.safeParse(raw);
  if (!parsed.success)
    throw new WorkspaceError(
      t("learner.json could not be read. It was left unchanged."),
    );
  if (parsed.data.formatVersion > LEARNER_FORMAT_VERSION)
    throw new WorkspaceError(
      t("This profile was written by a newer version of resit."),
    );
  return parsed.data;
}

function editLearner<T>(
  workspace: OpenWorkspace,
  change: (file: LearnerFile) => T,
): Promise<T> {
  return withLock(workspace, "learner", async () => {
    const file = await readLearner(workspace);
    const result = change(file);
    await writeJson(learnerPath(workspace), {
      ...file,
      formatVersion: LEARNER_FORMAT_VERSION,
    });
    return result;
  });
}

export function setPersonalization(
  workspace: OpenWorkspace,
  on: boolean,
): Promise<void> {
  return editLearner(workspace, (file) => {
    file.personalization = on;
  });
}

export function updatePreferences(
  workspace: OpenWorkspace,
  patch: PreferencesPatch,
): Promise<Preferences> {
  return editLearner(workspace, (file) => {
    const next: Preferences = { ...file.preferences };
    if (patch.detail) next.detail = patch.detail;
    if (patch.hintsFirst !== undefined) next.hintsFirst = patch.hintsFirst;
    for (const key of ["about", "goals"] as const) {
      if (!(key in patch)) continue;
      const value = patch[key]?.trim();
      if (value) next[key] = value;
      else delete next[key];
    }
    file.preferences = next;
    return next;
  });
}

function checkSubject(workspace: OpenWorkspace, subjectId?: string): void {
  if (subjectId && !workspace.subjects.has(subjectId))
    throw new WorkspaceError(t("That subject no longer exists."));
}

/** Adds a topic the student names, or changes one already in the profile. */
export async function saveTopic(
  workspace: OpenWorkspace,
  input: TopicInput & { id?: string | undefined },
): Promise<Topic> {
  const name = input.name.trim();
  if (!name) throw new WorkspaceError(t("A topic needs a name."));
  checkSubject(workspace, input.subjectId);
  return editLearner(workspace, (file) => {
    const key = topicKey(name, input.subjectId);
    const clash = file.topics.find(
      (topic) =>
        topic.id !== input.id && topicKey(topic.name, topic.subjectId) === key,
    );
    if (clash)
      throw new WorkspaceError(
        t("“{name}” is already in your profile.", { name: clash.name }),
      );
    const at = now();
    const note = input.note?.trim();
    const fields = {
      name,
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      level: input.level,
      ...(note ? { note } : {}),
    };
    if (input.id) {
      const index = file.topics.findIndex((topic) => topic.id === input.id);
      const current = file.topics[index];
      if (!current)
        throw new WorkspaceError(t("That topic is no longer here."));
      const next: Topic = {
        id: current.id,
        source: current.source,
        createdAt: current.createdAt,
        ...fields,
        updatedAt: at,
      };
      file.topics[index] = next;
      return next;
    }
    if (file.topics.length >= MAX_TOPICS)
      throw new WorkspaceError(t("The profile holds too many topics already."));
    const topic: Topic = {
      id: randomUUID(),
      ...fields,
      source: "student",
      createdAt: at,
      updatedAt: at,
    };
    file.topics.push(topic);
    return topic;
  });
}

export function deleteTopic(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  return editLearner(workspace, (file) => {
    const remaining = file.topics.filter((topic) => topic.id !== id);
    if (remaining.length === file.topics.length)
      throw new WorkspaceError(t("That topic is no longer here."));
    file.topics = remaining;
  });
}

/**
 * The assistant's suggestion for a topic, which waits for the student. It is
 * refused when personalization is off, when the profile already says the
 * same, or when the student rejected the same claim before.
 */
export async function proposeTopic(
  workspace: OpenWorkspace,
  input: {
    name: string;
    subjectId?: string | undefined;
    level: TopicLevel;
    reason: string;
  },
): Promise<TopicProposal> {
  const name = input.name.trim();
  const reason = input.reason.trim();
  if (!name || !reason)
    throw new WorkspaceError("A suggestion needs a topic and a reason.");
  checkSubject(workspace, input.subjectId);
  return editLearner(workspace, (file) => {
    if (!file.personalization)
      throw new WorkspaceError(
        "The student turned personalization off, so the profile cannot be changed.",
      );
    const key = topicKey(name, input.subjectId);
    const topic = file.topics.find(
      (entry) => topicKey(entry.name, entry.subjectId) === key,
    );
    if (topic?.level === input.level)
      throw new WorkspaceError(
        `The profile already has “${topic.name}” at that level.`,
      );
    const same = (proposal: TopicProposal) =>
      topicKey(proposal.name, proposal.subjectId) === key;
    if (
      file.proposals.some(
        (proposal) =>
          same(proposal) &&
          proposal.status === "rejected" &&
          proposal.level === input.level,
      )
    )
      throw new WorkspaceError(
        "The student already rejected this. Do not suggest it again unless something new shows it.",
      );
    const at = now();
    const proposal: TopicProposal = {
      id: randomUUID(),
      ...(topic ? { topicId: topic.id } : {}),
      name: topic?.name ?? name,
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      level: input.level,
      reason,
      status: "proposed",
      createdAt: at,
    };
    // A newer suggestion for the same topic replaces one still waiting.
    file.proposals = file.proposals.filter(
      (entry) => !(same(entry) && entry.status === "proposed"),
    );
    file.proposals.push(proposal);
    return proposal;
  });
}

/** Accepts a suggestion, at the level the student chose, or rejects it. */
export function resolveTopicProposal(
  workspace: OpenWorkspace,
  input: { id: string; accept: boolean; level?: TopicLevel | undefined },
): Promise<void> {
  return editLearner(workspace, (file) => {
    const proposal = file.proposals.find((entry) => entry.id === input.id);
    if (!proposal || proposal.status !== "proposed")
      throw new WorkspaceError(t("That suggestion is no longer waiting."));
    const at = now();
    proposal.status = input.accept ? "accepted" : "rejected";
    proposal.decidedAt = at;
    if (!input.accept) return;
    const level = input.level ?? proposal.level;
    // The student may have added the topic themselves while it waited.
    const key = topicKey(proposal.name, proposal.subjectId);
    const topic =
      file.topics.find((entry) => entry.id === proposal.topicId) ??
      file.topics.find(
        (entry) => topicKey(entry.name, entry.subjectId) === key,
      );
    if (topic) {
      topic.level = level;
      topic.updatedAt = at;
      return;
    }
    file.topics.push({
      id: randomUUID(),
      name: proposal.name,
      ...(proposal.subjectId ? { subjectId: proposal.subjectId } : {}),
      level,
      note: proposal.reason,
      source: "assistant",
      createdAt: at,
      updatedAt: at,
    });
  });
}

/**
 * Counts from practice, by subject and topic: cards, recent reviews and how
 * many were forgotten, recent quiz answers and how many were right.
 */
export async function topicEvidence(
  workspace: OpenWorkspace,
  subjectIds: readonly string[] = [...workspace.subjects.keys()],
): Promise<TopicEvidence[]> {
  const since = Date.now() - EVIDENCE_DAYS * 86_400_000;
  const entries = new Map<string, TopicEvidence>();
  const entry = (subjectId: string, topic: string) => {
    const key = topicKey(topic, subjectId);
    let found = entries.get(key);
    if (!found) {
      found = {
        subjectId,
        topic,
        cards: 0,
        reviews: 0,
        forgotten: 0,
        answered: 0,
        right: 0,
      };
      entries.set(key, found);
    }
    return found;
  };
  const seen = (found: TopicEvidence, at: string) => {
    if (!found.lastAt || at > found.lastAt) found.lastAt = at;
  };
  for (const subjectId of subjectIds) {
    if (!workspace.subjects.has(subjectId)) continue;
    const cards = await subjectCards(workspace, subjectId);
    const topicOf = new Map<string, string>();
    for (const card of cards) {
      if (!card.topic || card.status === "suggested") continue;
      topicOf.set(card.id, card.topic);
      entry(subjectId, card.topic).cards += 1;
    }
    for (const review of await cardReviews(workspace, subjectId)) {
      const topic = topicOf.get(review.cardId);
      if (!topic || Date.parse(review.at) < since) continue;
      const found = entry(subjectId, topic);
      found.reviews += 1;
      if (review.rating === "again") found.forgotten += 1;
      seen(found, review.at);
    }
    for (const quiz of await listQuizzes(workspace, subjectId))
      for (const attempt of quiz.attempts) {
        if (!attempt.submittedAt || Date.parse(attempt.submittedAt) < since)
          continue;
        for (const question of attempt.questions) {
          const topic = question.topic ?? quiz.topic;
          const outcome = attempt.responses[question.id]?.mark?.outcome;
          if (!topic || !outcome) continue;
          const found = entry(subjectId, topic);
          found.answered += 1;
          if (outcome === "correct") found.right += 1;
          seen(found, attempt.submittedAt);
        }
      }
  }
  return [...entries.values()].sort(
    (a, b) =>
      a.subjectId.localeCompare(b.subjectId) || a.topic.localeCompare(b.topic),
  );
}

export async function learnerProfile(
  workspace: OpenWorkspace,
): Promise<LearnerProfile> {
  const [file, evidence] = await Promise.all([
    readLearner(workspace),
    topicEvidence(workspace),
  ]);
  return { file, evidence };
}

const DETAIL_TEXT: Record<Preferences["detail"], string> = {
  brief: "short answers that get to the point",
  standard: "the usual amount of explanation",
  thorough: "thorough explanations with every step spelled out",
};

/**
 * What the student accepted about how they learn, for the start of each
 * message. Nothing when personalization is off or there is nothing to say.
 */
export async function learnerContext(
  workspace: OpenWorkspace,
  scope: ConversationScope,
): Promise<string | null> {
  const file = await readLearner(workspace);
  if (!file.personalization) return null;
  const { preferences } = file;
  const lines = [`Explanations: ${DETAIL_TEXT[preferences.detail]}.`];
  if (preferences.hintsFirst)
    lines.push(
      "Hints first: give a hint before a full solution, unless they ask for the solution.",
    );
  if (preferences.about) lines.push(`About them: ${preferences.about}`);
  if (preferences.goals) lines.push(`Their goals: ${preferences.goals}`);
  const subjectName = (id: string | undefined) =>
    id ? workspace.subjects.get(id)?.info.name : undefined;
  const topics = file.topics
    .filter(
      (topic) => !topic.subjectId || scope.subjectIds.includes(topic.subjectId),
    )
    .slice(0, MAX_CONTEXT_TOPICS);
  if (topics.length > 0) {
    lines.push("Topics, as the student accepted them:");
    for (const topic of topics) {
      const subject = subjectName(topic.subjectId);
      lines.push(
        `- ${topic.name}${subject ? ` (${subject})` : ""}: ${topic.level}${topic.note ? `. ${topic.note}` : ""}`,
      );
    }
  }
  if (
    lines.length === 1 &&
    preferences.detail === "standard" &&
    topics.length === 0
  )
    return null;
  return `<learner-profile>\n${lines.join("\n")}\n</learner-profile>`;
}
