import { randomUUID } from "node:crypto";

import type { ApprovalRequest, DesktopEvent } from "../../shared/ipc";

/** How long a question waits for the student before it counts as a no. */
const WAIT_MS = 5 * 60_000;

/** Conversation and kind pairs the student allowed for good, until quit. */
const allowed = new Set<string>();

const waiting = new Map<
  string,
  { request: ApprovalRequest; settle: (approved: boolean) => void }
>();

/**
 * Asks the student in the AI panel whether the assistant may do something,
 * and waits for the answer. No answer, a stopped turn, or a closed
 * workspace is a no.
 */
export function askStudent(
  emit: (event: DesktopEvent) => void,
  question: Omit<ApprovalRequest, "id">,
): Promise<boolean> {
  if (allowed.has(`${question.conversationId}:${question.kind}`))
    return Promise.resolve(true);
  const request: ApprovalRequest = { ...question, id: randomUUID() };
  return new Promise((resolve) => {
    const settle = (approved: boolean) => {
      clearTimeout(timer);
      if (!waiting.delete(request.id)) return;
      emit({
        type: "approval-settled",
        id: request.id,
        conversationId: request.conversationId,
      });
      resolve(approved);
    };
    const timer = setTimeout(() => settle(false), WAIT_MS);
    waiting.set(request.id, { request, settle });
    emit({ type: "approval-requested", request });
  });
}

export function answerApproval(
  id: string,
  approved: boolean,
  always = false,
): void {
  const entry = waiting.get(id);
  if (!entry) return;
  if (approved && always)
    allowed.add(`${entry.request.conversationId}:${entry.request.kind}`);
  entry.settle(approved);
}

/** Questions still open in a conversation, for a panel that opens late. */
export function openApprovals(conversationId: string): ApprovalRequest[] {
  return [...waiting.values()]
    .map((entry) => entry.request)
    .filter((request) => request.conversationId === conversationId);
}

/** Answers no to what a conversation still asks, or to everything. */
export function declineApprovals(conversationId?: string): void {
  for (const { request, settle } of [...waiting.values()])
    if (!conversationId || request.conversationId === conversationId)
      settle(false);
}
