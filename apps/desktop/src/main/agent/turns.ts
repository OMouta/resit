import {
  query,
  type Options,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "node:crypto";

import type {
  AssistantStatus,
  ProviderId,
  ChatMessage,
  ConversationScope,
  ToolSummary,
  TurnContext,
} from "../../shared/conversations";
import type { DesktopEvent } from "../../shared/ipc";
import type { ProjectInfo } from "../../shared/workspace";
import {
  appendMessage,
  bindClaudeSession,
  claudeSessionFor,
  readConversation,
} from "../conversations/store";
import { liveContext } from "../context";
import { learnerContext } from "../learner/store";
import { claudeStatus } from "../providers/claude";
import { codexStatus } from "../providers/codex";
import { loadSettings } from "../settings";
import { resolveScope } from "../workspace/projects";
import { snapshot, type OpenWorkspace } from "../workspace/workspace";
import { runCodexTurn } from "./codex-turn";
import { INSTRUCTIONS } from "./instructions";
import { renderPdfPage } from "./render";
import {
  STUDY_SERVER,
  STUDY_TOOLS,
  createStudyServer,
  describeToolCall,
  type StudyChange,
  type TurnGrant,
} from "./study-tools";
import { t } from "../i18n";

const MAX_HANDOFF_CHARS = 12_000;
const PROGRESS_INTERVAL_MS = 60;
/** Wide enough to read a dense worksheet without sending a huge image. */
const PAGE_IMAGE_WIDTH = 1400;

interface ActiveTurn {
  turnId: string;
  controller: AbortController;
  query: Query | null;
  /** How the provider running this turn stops it, when it is not Claude. */
  stop: (() => Promise<void>) | null;
  cancelled: boolean;
}

const active = new Map<string, ActiveTurn>();
const now = () => new Date().toISOString();

export function activeTurns(): string[] {
  return [...active.keys()];
}

function providerProblem(
  provider: ProviderId,
  status: Awaited<ReturnType<typeof claudeStatus>>,
) {
  const name = provider === "codex" ? "Codex" : "Claude Code";
  const command = provider === "codex" ? "codex login" : "claude";
  switch (status.status) {
    case "ready":
      return null;
    case "not-installed":
      return `${status.message} ${t("Install {provider}, or set its path in Settings.", { provider: name })}`;
    case "not-authenticated":
      return t(
        "{provider} is not signed in. Run `{command}` in a terminal and sign in, then check again in Settings.",
        { provider: name, command },
      );
    case "failed":
      return status.message;
    case "checking":
      return t("resit is still checking {provider}. Try again in a moment.", {
        provider: name,
      });
  }
}

function composeContext(
  workspace: OpenWorkspace,
  scope: ConversationScope,
  context: TurnContext,
  project: ProjectInfo | undefined,
): string {
  const subjects = scope.subjectIds
    .map((id) => workspace.subjects.get(id)?.info.name)
    .filter(Boolean);
  const lines = [
    `Conversation scope${project ? ` (the project "${project.title}")` : ""}: ${subjects.length > 0 ? subjects.join(", ") : "no subjects"}${
      scope.resourceIds.length > 0
        ? `, plus ${scope.resourceIds.length} added ${scope.resourceIds.length === 1 ? "file" : "files"}`
        : ""
    }. The study tools read and write the files in this scope, and the file open below.`,
  ];
  if (project?.activity)
    lines.push(
      `The project is the work for Moodle activity ${project.activity.moduleId}; study_read_activity reads its brief and dates.`,
    );
  else if (project?.due)
    lines.push(
      `The project is due ${project.due.date}${project.due.time ? ` at ${project.due.time}` : ""}.`,
    );
  const focused = context.focused;
  if (focused) {
    const entry = workspace.resources.get(focused.resourceId);
    const where = focused.page
      ? `, page ${focused.page}${focused.pageCount ? ` of ${focused.pageCount}` : ""}`
      : "";
    lines.push(
      entry
        ? `Open file: "${focused.title}" (${focused.kind}, id ${focused.resourceId}${where}). The student attached it to this message, so you can read it whether or not its subject is in the scope.`
        : `Open file: "${focused.title}", which resit can no longer find.`,
    );
    if (entry && context.annotation) {
      const { id, page, text, comment } = context.annotation;
      lines.push(
        `The student is asking about one of their own highlights in that file (page ${page}, highlight id ${id}). It covers:\n"""\n${text}\n"""`,
      );
      if (comment) lines.push(`Their note on that highlight: "${comment}"`);
    } else if (entry && context.selection)
      lines.push(`Selected text:\n"""\n${context.selection}\n"""`);
  }
  return `<study-context>\n${lines.join("\n")}\n</study-context>`;
}

/** Earlier messages, for a new native session that has no history. */
function composeHandoff(messages: ChatMessage[]): string {
  const parts: string[] = [];
  let size = 0;
  for (const message of [...messages].reverse()) {
    const text = `${message.role === "user" ? "Student" : "Assistant"}: ${message.text}`;
    if (size + text.length > MAX_HANDOFF_CHARS) break;
    parts.unshift(text);
    size += text.length;
  }
  if (parts.length === 0) return "";
  return `<earlier-conversation>\nThis conversation continues from resit's saved transcript. These are earlier messages, not verified facts:\n\n${parts.join("\n\n")}\n</earlier-conversation>\n\n`;
}

/** One user message, kept open until the result arrives so interrupt works. */
function singleMessage(text: string) {
  let finish: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  async function* messages(): AsyncGenerator<SDKUserMessage> {
    yield {
      type: "user",
      parent_tool_use_id: null,
      message: { role: "user", content: text },
    };
    await finished;
  }
  return { messages: messages(), end: () => finish() };
}

function assistantErrorText(code: string): string {
  switch (code) {
    case "authentication_failed":
      return t(
        "Claude Code is not signed in. Run `claude` in a terminal to sign in.",
      );
    case "billing_error":
      return t(
        "Your Claude account cannot make this request. Check your plan or billing.",
      );
    case "rate_limit":
      return t("You have reached your Claude usage limit. Try again later.");
    case "overloaded":
      return t("Claude is overloaded right now. Try again in a moment.");
    case "model_not_found":
      return t("The model set in Settings is not available to your account.");
    default:
      return t("Claude reported an error ({code}).", { code });
  }
}

/** What one turn may read and write, and how its tools reach the window. */
function turnGrant(
  workspace: OpenWorkspace,
  emit: (event: DesktopEvent) => void,
  input: { scope: ConversationScope; context: TurnContext; images: boolean },
): TurnGrant {
  return {
    scope: input.scope,
    context: input.context,
    images: input.images,
    liveContext,
    renderPage: ({ resourceId, page }) =>
      renderPdfPage(emit, {
        resourceId,
        revision: workspace.resources.get(resourceId)?.info.revision ?? "",
        page,
        maxWidth: PAGE_IMAGE_WIDTH,
      }),
    onChange: (change: StudyChange) => {
      if (change.kind === "annotations")
        emit({ type: "annotations-changed", documentId: change.documentId });
      else if (change.kind === "practice")
        emit({ type: "practice-changed", subjectId: change.subjectId });
      else if (change.kind === "plan") emit({ type: "plan-changed" });
      else if (change.kind === "learner") emit({ type: "learner-changed" });
      else emit({ type: "workspace-changed", snapshot: snapshot(workspace) });
    },
  };
}

export async function startTurn(
  workspace: OpenWorkspace,
  emit: (event: DesktopEvent) => void,
  input: { conversationId: string; text: string; context: TurnContext },
): Promise<{ turnId: string }> {
  if (active.has(input.conversationId))
    throw new Error(
      "A reply is still being written. Stop it or wait for it to finish.",
    );
  const history = await readConversation(workspace, input.conversationId);
  const providerId = history.meta.provider;
  const status = await (providerId === "codex"
    ? codexStatus()
    : claudeStatus());
  const problem = providerProblem(providerId, status);
  if (problem || status.status !== "ready")
    throw new Error(problem ?? t("That provider is not ready."));

  const message: ChatMessage = {
    id: randomUUID(),
    role: "user",
    text: input.text,
    context: input.context,
    at: now(),
  };
  const meta = await appendMessage(workspace, input.conversationId, message);
  const turn: ActiveTurn = {
    turnId: randomUUID(),
    controller: new AbortController(),
    query: null,
    stop: null,
    cancelled: false,
  };
  active.set(input.conversationId, turn);
  emit({
    type: "turn-started",
    conversationId: input.conversationId,
    turnId: turn.turnId,
    message,
    meta,
  });
  // The project's subjects and files as they are now.
  const scope = resolveScope(workspace, meta.scope);
  const project = meta.scope.projectId
    ? workspace.projects.get(meta.scope.projectId)?.info
    : undefined;
  // A profile that cannot be read leaves the message without it.
  const profile = await learnerContext(workspace, scope).catch(() => null);
  const prompt = `${composeContext(workspace, scope, input.context, project)}${profile ? `\n${profile}` : ""}\n\n${input.text}`;
  const grant = turnGrant(workspace, emit, {
    // The project stays named, so notes made here can join it.
    scope: {
      ...scope,
      ...(meta.scope.projectId ? { projectId: meta.scope.projectId } : {}),
    },
    context: input.context,
    images: providerId === "claude",
  });
  if (providerId === "codex")
    void runCodexTurn(workspace, emit, turn.turnId, {
      conversationId: input.conversationId,
      grant,
      prompt,
      cancelled: () => turn.cancelled,
      onStoppable: (stop) => {
        turn.stop = stop;
      },
    }).then(
      (reply) => deliver(workspace, emit, input.conversationId, turn, reply),
      (error: unknown) =>
        deliver(workspace, emit, input.conversationId, turn, {
          id: randomUUID(),
          role: "assistant",
          turnId: turn.turnId,
          text: "",
          status: "failed",
          tools: [],
          error: {
            title: t("Codex could not answer"),
            detail: error instanceof Error ? error.message : String(error),
          },
          at: now(),
        }),
    );
  else
    void runTurn(workspace, emit, {
      turn,
      conversationId: input.conversationId,
      executable: status.path,
      grant,
      prompt,
      history: history.messages,
    });
  return { turnId: turn.turnId };
}

/** Saves a finished reply and tells the window the turn is over. */
async function deliver(
  workspace: OpenWorkspace,
  emit: (event: DesktopEvent) => void,
  conversationId: string,
  turn: ActiveTurn,
  message: ChatMessage,
): Promise<void> {
  try {
    const meta = await appendMessage(workspace, conversationId, message);
    emit({
      type: "turn-finished",
      conversationId,
      turnId: turn.turnId,
      message,
      meta,
    });
  } finally {
    active.delete(conversationId);
  }
}

async function runTurn(
  workspace: OpenWorkspace,
  emit: (event: DesktopEvent) => void,
  job: {
    turn: ActiveTurn;
    conversationId: string;
    executable: string;
    grant: TurnGrant;
    prompt: string;
    history: ChatMessage[];
  },
): Promise<void> {
  const { turn, conversationId } = job;
  const committed: string[] = [];
  let live = "";
  const tools = new Map<string, ToolSummary>();
  let phase: "thinking" | "writing" | "tools" = "thinking";
  let status: AssistantStatus = "failed";
  let error: { title: string; detail: string } | undefined;
  let model: string | undefined;
  let stderr = "";
  let lastProgress = 0;
  let progressTimer: NodeJS.Timeout | null = null;

  const text = () => [...committed, live].filter(Boolean).join("\n\n");
  const sendProgress = () => {
    progressTimer = null;
    lastProgress = Date.now();
    emit({
      type: "turn-progress",
      conversationId,
      turnId: turn.turnId,
      text: text(),
      tools: [...tools.values()],
      phase,
    });
  };
  const progress = () => {
    if (progressTimer) return;
    const wait = Math.max(
      0,
      PROGRESS_INTERVAL_MS - (Date.now() - lastProgress),
    );
    progressTimer = setTimeout(sendProgress, wait);
  };
  const titleOf = (id: string) => workspace.resources.get(id)?.info.title;

  const settings = await loadSettings();
  let sessionId = await claudeSessionFor(workspace, conversationId);

  const attempt = async (resume: string | undefined, prompt: string) => {
    const input = singleMessage(prompt);
    const options: Options = {
      pathToClaudeCodeExecutable: job.executable,
      ...(job.executable.endsWith(".js")
        ? { executable: "node" as const }
        : {}),
      cwd: workspace.root,
      ...(resume ? { resume } : {}),
      ...(settings.claude.model ? { model: settings.claude.model } : {}),
      tools: [],
      mcpServers: { [STUDY_SERVER]: createStudyServer(workspace, job.grant) },
      allowedTools: STUDY_TOOLS.map((name) => `mcp__${STUDY_SERVER}__${name}`),
      permissionMode: "dontAsk",
      settingSources: [],
      strictMcpConfig: true,
      includePartialMessages: true,
      systemPrompt: INSTRUCTIONS,
      abortController: turn.controller,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "resit" },
      stderr: (data) => {
        stderr = `${stderr}${data}`.slice(-4000);
      },
    };
    const run = query({ prompt: input.messages, options });
    turn.query = run;
    let gotResult = false;
    try {
      for await (const message of run as AsyncIterable<SDKMessage>) {
        switch (message.type) {
          case "system":
            if (message.subtype === "init") {
              model = message.model;
              if (message.session_id !== sessionId) {
                sessionId = message.session_id;
                await bindClaudeSession(workspace, conversationId, sessionId);
              }
            }
            break;
          case "stream_event": {
            if (message.parent_tool_use_id) break;
            const event = message.event;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              live += event.delta.text;
              phase = "writing";
              progress();
            } else if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              phase = "tools";
              progress();
            }
            break;
          }
          case "assistant":
            if (message.parent_tool_use_id) break;
            for (const block of message.message.content) {
              if (block.type === "text") {
                if (block.text) committed.push(block.text);
                live = "";
              } else if (block.type === "tool_use") {
                tools.set(block.id, {
                  id: block.id,
                  name: block.name,
                  summary: describeToolCall(
                    block.name,
                    (block.input ?? {}) as Record<string, unknown>,
                    titleOf,
                  ),
                  status: "running",
                });
              }
            }
            if (message.error)
              error = {
                title: t("Claude could not answer"),
                detail: assistantErrorText(message.error),
              };
            progress();
            break;
          case "user":
            if (message.parent_tool_use_id) break;
            if (Array.isArray(message.message.content))
              for (const block of message.message.content)
                if (block.type === "tool_result") {
                  const call = tools.get(block.tool_use_id);
                  if (call) call.status = block.is_error ? "failed" : "done";
                }
            phase = "thinking";
            progress();
            break;
          case "result":
            gotResult = true;
            if (message.subtype === "success" && !message.is_error)
              status = "completed";
            else {
              status = "failed";
              error ??= {
                title: t("Claude could not finish this reply"),
                detail:
                  message.subtype === "success"
                    ? message.result || t("The reply ended with an error.")
                    : message.errors.join(" ") || message.subtype,
              };
            }
            input.end();
            break;
          default:
            break;
        }
      }
    } finally {
      input.end();
    }
    return gotResult;
  };

  try {
    try {
      await attempt(
        sessionId,
        sessionId ? job.prompt : composeHandoff(job.history) + job.prompt,
      );
    } catch (reason) {
      // The saved native session is gone; start a new one from the transcript.
      const missingSession =
        sessionId &&
        !turn.cancelled &&
        committed.length === 0 &&
        tools.size === 0 &&
        /session|conversation/i.test(`${String(reason)} ${stderr}`);
      if (!missingSession) throw reason;
      await bindClaudeSession(workspace, conversationId, undefined);
      sessionId = undefined;
      error = undefined;
      await attempt(undefined, composeHandoff(job.history) + job.prompt);
    }
  } catch (reason) {
    if (!turn.cancelled && !turn.controller.signal.aborted) {
      status = "failed";
      error ??= {
        title: t("Claude stopped unexpectedly"),
        detail: `${reason instanceof Error ? reason.message : String(reason)}${
          stderr.trim()
            ? `\n${stderr.trim().split("\n").slice(-3).join("\n")}`
            : ""
        }`,
      };
    }
  }
  if (turn.cancelled) {
    status = "cancelled";
    error = undefined;
  }
  if (progressTimer) clearTimeout(progressTimer);
  for (const call of tools.values())
    if (call.status === "running") call.status = "failed";

  const message: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    turnId: turn.turnId,
    text: text(),
    status,
    tools: [...tools.values()],
    ...(error && status === "failed" ? { error } : {}),
    ...(model ? { model } : {}),
    at: now(),
  };
  await deliver(workspace, emit, conversationId, turn, message);
}

/** Asks the provider to stop, then ends its process if it has not stopped. */
export async function stopTurn(conversationId: string): Promise<void> {
  const turn = active.get(conversationId);
  if (!turn) return;
  turn.cancelled = true;
  if (turn.stop) {
    await turn.stop().catch(() => undefined);
    return;
  }
  const force = setTimeout(() => turn.controller.abort(), 3000);
  try {
    await Promise.race([
      turn.query?.interrupt(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    turn.controller.abort();
  } finally {
    if (!active.has(conversationId)) clearTimeout(force);
  }
}

/** Ends every running turn, for closing the workspace or quitting. */
export function abortAllTurns(): void {
  for (const turn of active.values()) {
    turn.cancelled = true;
    turn.controller.abort();
    void turn.stop?.().catch(() => undefined);
  }
}
