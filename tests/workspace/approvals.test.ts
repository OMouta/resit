import { describe, expect, it } from "vitest";

import {
  answerApproval,
  askStudent,
  declineApprovals,
  openApprovals,
} from "../../apps/desktop/src/main/agent/approvals";
import type { DesktopEvent } from "../../apps/desktop/src/shared/ipc";

describe("asking the student", () => {
  const question = {
    conversationId: "c1",
    kind: "import-url",
    title: "Download a file from the web?",
    detail: "example.org/paper.pdf, into Physics",
  };

  it("waits for the answer, and says when it is settled", async () => {
    const events: DesktopEvent[] = [];
    const answer = askStudent((event) => events.push(event), question);
    const [open] = openApprovals("c1");
    expect(open).toMatchObject(question);
    answerApproval(open?.id ?? "", false);
    expect(await answer).toBe(false);
    expect(events.map((event) => event.type)).toEqual([
      "approval-requested",
      "approval-settled",
    ]);
    expect(openApprovals("c1")).toEqual([]);
  });

  it("takes a stopped turn as a no", async () => {
    const answer = askStudent(() => undefined, question);
    declineApprovals("c1");
    expect(await answer).toBe(false);
  });

  it("stops asking about that kind once always allowed", async () => {
    const first = askStudent(() => undefined, {
      ...question,
      conversationId: "c2",
    });
    answerApproval(openApprovals("c2")[0]?.id ?? "", true, true);
    expect(await first).toBe(true);
    // Asked again in the same conversation, it is allowed without a card.
    expect(
      await askStudent(() => undefined, { ...question, conversationId: "c2" }),
    ).toBe(true);
    expect(openApprovals("c2")).toEqual([]);
    // Another conversation still asks.
    const other = askStudent(() => undefined, {
      ...question,
      conversationId: "c3",
    });
    expect(openApprovals("c3")).toHaveLength(1);
    declineApprovals("c3");
    expect(await other).toBe(false);
  });
});
