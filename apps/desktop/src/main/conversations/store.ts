import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename } from "node:fs/promises";
import { join } from "node:path";

import {
  conversationFileSchema,
  type ChatMessage,
  type ConversationDetail,
  type ConversationMeta,
  type ConversationScope,
  type ProviderId,
} from "../../shared/conversations";
import { exists, readJson, writeJson } from "../workspace/files";
import type { OpenWorkspace } from "../workspace/workspace";

const FORMAT_VERSION = 1;
const now = () => new Date().toISOString();

function conversationDir(workspace: OpenWorkspace, id: string): string {
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid conversation ID.");
  return join(workspace.root, "conversations", id);
}

async function readMeta(
  workspace: OpenWorkspace,
  id: string,
): Promise<ConversationMeta> {
  const raw = await readJson(
    join(conversationDir(workspace, id), "conversation.json"),
  );
  return conversationFileSchema.parse(raw);
}

async function writeMeta(
  workspace: OpenWorkspace,
  meta: ConversationMeta,
): Promise<void> {
  await writeJson(
    join(conversationDir(workspace, meta.id), "conversation.json"),
    meta,
  );
}

export async function createConversation(
  workspace: OpenWorkspace,
  scope: ConversationScope,
  provider: ProviderId,
): Promise<ConversationMeta> {
  const at = now();
  const meta: ConversationMeta = {
    format: "resit-conversation",
    formatVersion: FORMAT_VERSION,
    id: randomUUID(),
    title: "New conversation",
    scope,
    provider,
    createdAt: at,
    updatedAt: at,
  };
  await mkdir(conversationDir(workspace, meta.id), { recursive: true });
  await writeMeta(workspace, meta);
  return meta;
}

export async function listConversations(
  workspace: OpenWorkspace,
): Promise<ConversationMeta[]> {
  const root = join(workspace.root, "conversations");
  if (!(await exists(root))) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const metas: ConversationMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      metas.push(await readMeta(workspace, entry.name));
    } catch {
      // Not a conversation folder, or one this version cannot read.
    }
  }
  return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Reads the transcript. A final line cut short by a crash is skipped;
 * every complete message before it is kept.
 */
export async function readConversation(
  workspace: OpenWorkspace,
  id: string,
): Promise<ConversationDetail> {
  const meta = await readMeta(workspace, id);
  const path = join(conversationDir(workspace, id), "events.jsonl");
  const messages: ChatMessage[] = [];
  if (await exists(path)) {
    for (const line of (await readFile(path, "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as {
          type?: string;
          message?: ChatMessage;
        };
        if (event.type === "message" && event.message)
          messages.push(event.message);
      } catch {
        // Incomplete trailing write.
      }
    }
  }
  return { meta, messages };
}

function titleFrom(text: string): string {
  const line = text.trim().split("\n")[0] ?? "";
  return line.length > 60
    ? `${line.slice(0, 57).trimEnd()}…`
    : line || "New conversation";
}

/** Appends one message and bumps the conversation's update time. */
export async function appendMessage(
  workspace: OpenWorkspace,
  id: string,
  message: ChatMessage,
): Promise<ConversationMeta> {
  const dir = conversationDir(workspace, id);
  await appendFile(
    join(dir, "events.jsonl"),
    `${JSON.stringify({ type: "message", message })}\n`,
  );
  const meta = await readMeta(workspace, id);
  const next: ConversationMeta = {
    ...meta,
    updatedAt: message.at,
    title:
      meta.title === "New conversation" && message.role === "user"
        ? titleFrom(message.text)
        : meta.title,
  };
  await writeMeta(workspace, next);
  return next;
}

export async function updateConversation(
  workspace: OpenWorkspace,
  id: string,
  patch: { title?: string | undefined; scope?: ConversationScope | undefined },
): Promise<ConversationMeta> {
  const meta = await readMeta(workspace, id);
  const next: ConversationMeta = {
    ...meta,
    ...(patch.title ? { title: patch.title } : {}),
    ...(patch.scope ? { scope: patch.scope } : {}),
    updatedAt: now(),
  };
  await writeMeta(workspace, next);
  return next;
}

export async function deleteConversation(
  workspace: OpenWorkspace,
  id: string,
): Promise<void> {
  const stamp = now().replace(/[:.]/g, "-");
  const target = join(
    workspace.root,
    ".resit",
    "trash",
    `${stamp}-${randomUUID().slice(0, 8)}`,
  );
  await mkdir(target, { recursive: true });
  await rename(conversationDir(workspace, id), join(target, id));
  await writeJson(join(target, "trash.json"), {
    kind: "conversation",
    id,
    deletedAt: now(),
    files: [{ from: `conversations/${id}`, to: id }],
  });
}

interface Bindings {
  conversations: Record<
    string,
    { claudeSessionId?: string; codexThreadId?: string }
  >;
}

function bindingsPath(workspace: OpenWorkspace): string {
  return join(workspace.root, ".resit", "state", "provider-bindings.json");
}

async function readBindings(workspace: OpenWorkspace): Promise<Bindings> {
  try {
    const raw = (await readJson(bindingsPath(workspace))) as Partial<Bindings>;
    return { conversations: raw.conversations ?? {} };
  } catch {
    return { conversations: {} };
  }
}

/** Native Claude session for a conversation on this machine, if any. */
export async function claudeSessionFor(
  workspace: OpenWorkspace,
  conversationId: string,
): Promise<string | undefined> {
  return (await readBindings(workspace)).conversations[conversationId]
    ?.claudeSessionId;
}

export async function bindClaudeSession(
  workspace: OpenWorkspace,
  conversationId: string,
  sessionId: string | undefined,
): Promise<void> {
  const bindings = await readBindings(workspace);
  const entry = { ...bindings.conversations[conversationId] };
  if (sessionId) entry.claudeSessionId = sessionId;
  else delete entry.claudeSessionId;
  bindings.conversations[conversationId] = entry;
  await writeJson(bindingsPath(workspace), bindings);
}

/** Codex thread for a conversation on this machine, if any. */
export async function codexThreadFor(
  workspace: OpenWorkspace,
  conversationId: string,
): Promise<string | undefined> {
  return (await readBindings(workspace)).conversations[conversationId]
    ?.codexThreadId;
}

export async function bindCodexThread(
  workspace: OpenWorkspace,
  conversationId: string,
  threadId: string | undefined,
): Promise<void> {
  const bindings = await readBindings(workspace);
  const entry = { ...bindings.conversations[conversationId] };
  if (threadId) entry.codexThreadId = threadId;
  else delete entry.codexThreadId;
  bindings.conversations[conversationId] = entry;
  await writeJson(bindingsPath(workspace), bindings);
}
