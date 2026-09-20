import { z } from "zod";

import { providerIdSchema, type ProviderId } from "./settings";

export const scopeSchema = z.object({
  subjectIds: z.array(z.string().min(1).max(200)).max(100),
  resourceIds: z.array(z.string().min(1).max(200)).max(200),
});
export type ConversationScope = z.infer<typeof scopeSchema>;

const timestamp = z.iso.datetime({ offset: true });

/** `conversations/<id>/conversation.json`. */
export const conversationFileSchema = z.looseObject({
  format: z.literal("resit-conversation"),
  formatVersion: z.number().int().positive(),
  id: z.string().min(1),
  title: z.string(),
  scope: scopeSchema,
  /** Older conversations have no provider recorded; they were Claude. */
  provider: providerIdSchema.catch("claude").default("claude"),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ConversationMeta = z.infer<typeof conversationFileSchema>;

/** What the student was looking at when they sent a message. */
export const turnContextSchema = z.object({
  focused: z
    .object({
      resourceId: z.string().min(1).max(200),
      title: z.string().max(300),
      kind: z.enum(["note", "pdf", "image", "attachment"]),
      page: z.number().int().positive().optional(),
      pageCount: z.number().int().positive().optional(),
    })
    .optional(),
  selection: z.string().max(20_000).optional(),
  /** A saved highlight the student attached to this message. */
  annotation: z
    .object({
      id: z.string().min(1).max(200),
      page: z.number().int().positive(),
      text: z.string().max(20_000),
      comment: z.string().max(4000).optional(),
    })
    .optional(),
});
export type TurnContext = z.infer<typeof turnContextSchema>;

export interface ToolSummary {
  id: string;
  name: string;
  summary: string;
  status: "running" | "done" | "failed";
}

export type AssistantStatus = "completed" | "cancelled" | "failed";

export type ChatMessage =
  | {
      id: string;
      role: "user";
      text: string;
      context: TurnContext;
      at: string;
    }
  | {
      id: string;
      role: "assistant";
      turnId: string;
      text: string;
      status: AssistantStatus;
      tools: ToolSummary[];
      error?: { title: string; detail: string };
      model?: string;
      at: string;
    };

export interface ConversationDetail {
  meta: ConversationMeta;
  messages: ChatMessage[];
}

/** A model a connected provider offers. */
export interface ModelOption {
  /** Value passed to the provider, such as "sonnet" or "gpt-6-astra". */
  id: string;
  /** The model itself, such as "Sonnet 5". */
  name: string;
  description: string;
  /** The provider uses this model when none is chosen. */
  isDefault: boolean;
}

export type { ProviderId };

export type ProviderState =
  | { status: "checking" }
  | { status: "not-installed"; message: string }
  | { status: "not-authenticated"; version: string; path: string }
  | { status: "failed"; message: string; path?: string }
  | { status: "ready"; version: string; path: string };

export type TurnEvent =
  | {
      type: "turn-started";
      conversationId: string;
      turnId: string;
      message: ChatMessage;
      meta: ConversationMeta;
    }
  | {
      type: "turn-progress";
      conversationId: string;
      turnId: string;
      text: string;
      tools: ToolSummary[];
      phase: "thinking" | "writing" | "tools";
    }
  | {
      type: "turn-finished";
      conversationId: string;
      turnId: string;
      message: ChatMessage;
      meta: ConversationMeta;
    };
