import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import type {
  AssistantStatus,
  ChatMessage,
  TurnEvent,
} from "../../shared/conversations";
import { bindCodexThread, codexThreadFor } from "../conversations/store";
import { CODEX_CLIENT_INFO, codexLaunch } from "../providers/codex";
import { startCodexAppServer } from "../providers/codex-client";
import { loadSettings } from "../settings";
import type { OpenWorkspace } from "../workspace/workspace";
import { INSTRUCTIONS } from "./instructions";
import { startMcpEndpoint } from "./mcp-endpoint";
import { describeToolCall, studyTools, type TurnGrant } from "./study-tools";
import { TurnStream } from "./turn-stream";

/** Codex names the study server; its tools arrive prefixed with it. */
const MCP_SERVER = "resit";

interface ThreadItem {
  id?: string;
  type?: string;
  text?: string;
  server?: string;
  tool?: string;
  status?: string;
  arguments?: unknown;
}

/**
 * Codex works in a directory. The student's files reach it through the
 * study tools, which check scope, so it gets an empty one of its own
 * rather than the workspace.
 */
async function scratchDirectory(
  workspace: OpenWorkspace,
  conversationId: string,
): Promise<string> {
  const path = join(
    workspace.root,
    ".resit",
    "state",
    "codex",
    conversationId.replace(/[^A-Za-z0-9._-]/g, "_"),
  );
  await mkdir(path, { recursive: true });
  return path;
}

export interface CodexTurnJob {
  conversationId: string;
  grant: TurnGrant;
  prompt: string;
  /** Set when the turn was stopped from the UI. */
  cancelled: () => boolean;
  /** Called with a function that stops the running turn. */
  onStoppable: (stop: () => Promise<void>) => void;
}

/**
 * Runs one turn against `codex app-server`: the study tools are served
 * over a loopback MCP endpoint that only this turn can reach.
 */
export async function runCodexTurn(
  workspace: OpenWorkspace,
  emit: (event: TurnEvent) => void,
  turnId: string,
  job: CodexTurnJob,
): Promise<ChatMessage> {
  const stream = new TurnStream(emit, job.conversationId, turnId);
  const settings = await loadSettings();
  const model = settings.codex.model;
  const endpoint = await startMcpEndpoint(
    studyTools(workspace, job.grant),
    MCP_SERVER,
  );
  const launch = await codexLaunch({
    mcp: { name: MCP_SERVER, url: endpoint.url, token: endpoint.token },
  });
  if (!launch) {
    await endpoint.close();
    return stream.finish({
      status: "failed",
      error: {
        title: "Codex is not available",
        detail: "resit could not find the Codex executable.",
      },
    });
  }

  const titleOf = (id: string) => workspace.resources.get(id)?.info.title;
  type Outcome = {
    status: AssistantStatus;
    error?: { title: string; detail: string };
  };
  let settle: (outcome: Outcome) => void = () => undefined;
  const finished = new Promise<Outcome>((resolve) => {
    settle = resolve;
  });
  let threadId: string | undefined;
  let activeTurnId: string | undefined;

  const client = startCodexAppServer({
    executable: launch.executable,
    args: launch.args,
    cwd: await scratchDirectory(workspace, job.conversationId),
    env: launch.env,
    onRequest: async (method, params) => {
      // The study tools are ours, so they run. Anything that would touch
      // the computer is refused: this agent reads study files, nothing else.
      if (method === "mcpServer/elicitation/request") {
        const server = (params as { serverName?: string } | null)?.serverName;
        return server === MCP_SERVER
          ? { action: "accept", content: {} }
          : { action: "decline" };
      }
      if (
        method === "item/commandExecution/requestApproval" ||
        method === "item/fileChange/requestApproval"
      )
        return { decision: "decline" };
      if (method === "item/permissions/requestApproval")
        return { permissions: {}, scope: "turn" };
      return {};
    },
    onNotification: (method, params) => {
      const payload = (params ?? {}) as {
        delta?: string;
        item?: ThreadItem;
        turn?: { id?: string; status?: string; error?: { message?: string } };
        message?: string;
      };
      switch (method) {
        case "item/agentMessage/delta":
          stream.delta(payload.delta ?? "");
          break;
        case "item/started": {
          const item = payload.item;
          if (item?.type === "mcpToolCall" && item.id)
            stream.toolStarted(
              item.id,
              `mcp__${item.server ?? MCP_SERVER}__${item.tool ?? "tool"}`,
              describeToolCall(
                item.tool ?? "",
                (item.arguments ?? {}) as Record<string, unknown>,
                titleOf,
              ),
            );
          else if (item?.type === "reasoning") stream.setPhase("thinking");
          break;
        }
        case "item/completed": {
          const item = payload.item;
          if (!item) break;
          if (item.type === "mcpToolCall" && item.id)
            stream.toolFinished(item.id, item.status !== "completed");
          // Codex sends the finished text as well as the deltas.
          else if (item.type === "agentMessage") stream.commit(item.text ?? "");
          break;
        }
        case "turn/completed": {
          const status = payload.turn?.status;
          const detail = payload.turn?.error?.message;
          settle(
            status === "completed"
              ? { status: "completed" }
              : status === "interrupted"
                ? { status: "cancelled" }
                : {
                    status: "failed",
                    error: {
                      title: "Codex could not finish this reply",
                      detail: detail ?? "The turn ended without an answer.",
                    },
                  },
          );
          break;
        }
        case "error":
          settle({
            status: "failed",
            error: {
              title: "Codex reported an error",
              detail: payload.message ?? "No detail was given.",
            },
          });
          break;
        default:
          break;
      }
    },
  });

  job.onStoppable(async () => {
    if (threadId && activeTurnId)
      await client
        .request("turn/interrupt", { threadId, turnId: activeTurnId })
        .catch(() => undefined);
    else client.close();
  });

  void client.exited.then(() =>
    settle({
      status: job.cancelled() ? "cancelled" : "failed",
      error: {
        title: "Codex stopped unexpectedly",
        detail:
          client.stderr().trim().split("\n").slice(-2).join(" ") ||
          "The Codex process ended before it answered.",
      },
    }),
  );

  try {
    await client.request("initialize", {
      clientInfo: CODEX_CLIENT_INFO,
      capabilities: {},
    });
    client.notify("initialized");

    const start = {
      cwd: await scratchDirectory(workspace, job.conversationId),
      // Codex asks before an MCP tool runs; the handler above answers.
      approvalPolicy: "on-request",
      sandbox: "read-only",
      approvalsReviewer: "user",
      developerInstructions: INSTRUCTIONS,
      ...(model ? { model } : {}),
    };
    const saved = await codexThreadFor(workspace, job.conversationId);
    const opened = await (saved
      ? client
          .request<{ thread: { id: string } }>("thread/resume", {
            threadId: saved,
            ...start,
          })
          .catch(() =>
            client.request<{ thread: { id: string } }>("thread/start", start),
          )
      : client.request<{ thread: { id: string } }>("thread/start", start));
    threadId = opened.thread.id;
    if (threadId !== saved)
      await bindCodexThread(workspace, job.conversationId, threadId);

    const turn = await client.request<{ turn: { id: string } }>("turn/start", {
      threadId,
      input: [{ type: "text", text: job.prompt }],
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandboxPolicy: { type: "readOnly" },
      ...(model ? { model } : {}),
    });
    activeTurnId = turn.turn.id;

    const result = await finished;
    return stream.finish({
      status: job.cancelled() ? "cancelled" : result.status,
      ...(job.cancelled() ? {} : { error: result.error }),
      ...(model ? { model } : {}),
    });
  } catch (error) {
    if (job.cancelled()) return stream.finish({ status: "cancelled" });
    return stream.finish({
      status: "failed",
      error: {
        title: "Codex could not answer",
        detail: error instanceof Error ? error.message : String(error),
      },
    });
  } finally {
    client.close();
    await endpoint.close();
  }
}
