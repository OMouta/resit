import { randomUUID } from "node:crypto";

import type {
  AssistantStatus,
  ChatMessage,
  ToolSummary,
  TurnEvent,
} from "../../shared/conversations";

const PROGRESS_INTERVAL_MS = 60;

export type TurnPhase = "thinking" | "writing" | "tools";

/**
 * Collects one assistant reply as it arrives and publishes it at a steady
 * rate. Both providers write into this, so the renderer sees the same
 * stream whichever one answered.
 */
export class TurnStream {
  private readonly committed: string[] = [];
  private live = "";
  private readonly tools = new Map<string, ToolSummary>();
  private phase: TurnPhase = "thinking";
  private timer: NodeJS.Timeout | null = null;
  private lastAt = 0;

  constructor(
    private readonly emit: (event: TurnEvent) => void,
    private readonly conversationId: string,
    readonly turnId: string,
  ) {}

  text(): string {
    return [...this.committed, this.live].filter(Boolean).join("\n\n");
  }

  /** Adds streamed characters to the reply being written. */
  delta(text: string): void {
    if (!text) return;
    this.live += text;
    this.setPhase("writing");
  }

  /** Finishes the block being streamed, or adds one that arrived whole. */
  commit(text: string): void {
    if (text) this.committed.push(text);
    this.live = "";
    this.progress();
  }

  setPhase(phase: TurnPhase): void {
    this.phase = phase;
    this.progress();
  }

  toolStarted(id: string, name: string, summary: string): void {
    this.tools.set(id, { id, name, summary, status: "running" });
    this.setPhase("tools");
  }

  toolFinished(id: string, failed: boolean): void {
    const call = this.tools.get(id);
    if (call) call.status = failed ? "failed" : "done";
    this.setPhase("thinking");
  }

  /** Publishes at most one progress event per interval. */
  progress(): void {
    if (this.timer) return;
    const wait = Math.max(0, PROGRESS_INTERVAL_MS - (Date.now() - this.lastAt));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.lastAt = Date.now();
      this.emit({
        type: "turn-progress",
        conversationId: this.conversationId,
        turnId: this.turnId,
        text: this.text(),
        tools: [...this.tools.values()],
        phase: this.phase,
      });
    }, wait);
  }

  /** The finished message. Tools still running are reported as failed. */
  finish(input: {
    status: AssistantStatus;
    error?: { title: string; detail: string } | undefined;
    model?: string | undefined;
  }): ChatMessage {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const call of this.tools.values())
      if (call.status === "running") call.status = "failed";
    return {
      id: randomUUID(),
      role: "assistant",
      turnId: this.turnId,
      text: this.text(),
      status: input.status,
      tools: [...this.tools.values()],
      ...(input.error && input.status === "failed"
        ? { error: input.error }
        : {}),
      ...(input.model ? { model: input.model } : {}),
      at: new Date().toISOString(),
    };
  }
}
