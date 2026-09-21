import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });

/** How well the student knows a topic, in their own words or as they accepted it. */
export const TOPIC_LEVEL_VALUES = ["gap", "developing", "secure"] as const;
export const topicLevelSchema = z.enum(TOPIC_LEVEL_VALUES);
export type TopicLevel = z.infer<typeof topicLevelSchema>;

export const DETAIL_VALUES = ["brief", "standard", "thorough"] as const;
export const detailSchema = z.enum(DETAIL_VALUES);
export type Detail = z.infer<typeof detailSchema>;

export const preferencesSchema = z.object({
  /** How much the assistant explains by default. */
  detail: detailSchema.catch("standard"),
  /** Hints before a full solution, unless the student asks for the solution. */
  hintsFirst: z.boolean().catch(false),
  /** Course, year, and background, in the student's words. */
  about: z.string().max(2000).optional().catch(undefined),
  goals: z.string().max(2000).optional().catch(undefined),
});
export type Preferences = z.infer<typeof preferencesSchema>;
/** Empty text clears `about` or `goals`. */
export type PreferencesPatch = {
  [Key in keyof Preferences]?: Preferences[Key] | undefined;
};

/** A topic the student accepted into their profile, with how well they know it. */
export const topicSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  subjectId: z.string().optional(),
  level: topicLevelSchema,
  note: z.string().optional(),
  /** Who first wrote it down. The student accepted it either way. */
  source: z.enum(["student", "assistant"]).catch("student"),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Topic = z.infer<typeof topicSchema>;

/**
 * Something the assistant noticed, waiting for the student. Rejected ones are
 * kept so the same claim is not made again from the same evidence.
 */
export const proposalSchema = z.looseObject({
  id: z.string().min(1),
  /** The topic it would change, when the student already has it. */
  topicId: z.string().optional(),
  name: z.string().min(1),
  subjectId: z.string().optional(),
  level: topicLevelSchema,
  /** The evidence, in one line the student reads. */
  reason: z.string(),
  status: z.enum(["proposed", "accepted", "rejected"]),
  createdAt: timestamp,
  decidedAt: timestamp.optional(),
});
export type TopicProposal = z.infer<typeof proposalSchema>;

/** `learner.json` at the workspace root. */
export const learnerFileSchema = z.looseObject({
  format: z.literal("resit-learner"),
  formatVersion: z.number().int().positive(),
  /** Off, the assistant is told nothing from here and cannot suggest changes. */
  personalization: z.boolean().catch(true),
  preferences: preferencesSchema.catch({
    detail: "standard",
    hintsFirst: false,
  }),
  topics: z.array(topicSchema).catch([]),
  proposals: z.array(proposalSchema).catch([]),
});
export type LearnerFile = z.infer<typeof learnerFileSchema>;

/** What practice says about one topic, counted rather than judged. */
export interface TopicEvidence {
  subjectId: string;
  topic: string;
  cards: number;
  /** Card reviews in the last 30 days, and how many were rated Again. */
  reviews: number;
  forgotten: number;
  /** Quiz answers on the topic in the last 30 days, and how many were right. */
  answered: number;
  right: number;
  /** The most recent review or quiz answer on the topic. */
  lastAt?: string;
}

export interface LearnerProfile {
  file: LearnerFile;
  evidence: TopicEvidence[];
}

export interface TopicInput {
  name: string;
  subjectId?: string | undefined;
  level: TopicLevel;
  note?: string | undefined;
}

/** Topic names match whatever their case or accents. */
export function topicKey(name: string, subjectId: string | undefined): string {
  return `${subjectId ?? ""}/${name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()}`;
}
