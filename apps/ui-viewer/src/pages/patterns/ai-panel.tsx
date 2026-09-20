import { useEffect, useRef, useState } from "react";

import { AiPanel } from "@resit/ui/patterns/ai/ai-panel";
import { ScopeMismatchNotice } from "@resit/ui/patterns/ai/scope-chips";
import type { PanelStatus } from "@resit/ui/patterns/ai/turn-status";
import type { Turn } from "@resit/ui/patterns/ai/types";

import {
  contextInspector,
  failedTurn,
  providers,
  providersMissing,
  scope,
  stoppedTurn,
  streamScript,
  turns,
} from "../../fixtures/chat";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

function useSimulatedStream(active: boolean, onDone: () => void) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(active);
  const timer = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    if (!active) return;
    let index = 0;
    setText("");
    setRunning(true);
    timer.current = window.setInterval(() => {
      index += 1;
      setText(streamScript.slice(0, index).join(""));
      if (index >= streamScript.length) {
        window.clearInterval(timer.current ?? undefined);
        setRunning(false);
        onDoneRef.current();
      }
    }, 140);
    return () => window.clearInterval(timer.current ?? undefined);
  }, [active]);
  const stop = () => {
    window.clearInterval(timer.current ?? undefined);
    setRunning(false);
  };
  return { text, running, stop };
}

function Panel({ ctx, width }: { ctx: ExampleContext; width: number }) {
  const state = ctx.state;
  const [providerId, setProviderId] = useState("claude");
  const [modelId, setModelId] = useState<string | undefined>(
    "claude-fable-5-1",
  );
  const [editStatus, setEditStatus] = useState<
    "pending" | "accepted" | "rejected"
  >("pending");
  const [stopped, setStopped] = useState(false);
  const [done, setDone] = useState(false);
  const stream = useSimulatedStream(state === "streaming", () => setDone(true));

  const baseTurns: Turn[] = turns.slice(0, 3);
  let list: Turn[];
  let status: PanelStatus = { kind: "idle" };
  let notice: React.ReactNode = null;

  switch (state) {
    case "streaming":
      list = [
        ...baseTurns,
        {
          id: "live",
          role: "assistant",
          status: stopped ? "stopped" : done ? "complete" : "streaming",
          text: stream.text,
          tools: [
            {
              id: "t1",
              name: "read_pdf_page",
              summary: "Read page 7 of Worksheet 3",
              status: stream.text ? "done" : "running",
              durationMs: 420,
            },
          ],
          at: "2026-09-16T20:59:00Z",
        },
      ];
      status = stopped
        ? { kind: "stopped" }
        : done
          ? { kind: "idle" }
          : { kind: "streaming", phase: stream.text ? "writing" : "tools" };
      break;
    case "awaiting-review": {
      const review = turns[3]!;
      list = [
        ...baseTurns,
        review.role === "assistant" && review.edit
          ? {
              ...review,
              status: editStatus === "pending" ? "awaiting-review" : "complete",
              edit: { ...review.edit, status: editStatus },
            }
          : review,
      ];
      status =
        editStatus === "pending"
          ? { kind: "awaiting-review", pending: 1 }
          : { kind: "idle" };
      break;
    }
    case "stopped":
      list = [...baseTurns, stoppedTurn];
      status = { kind: "stopped" };
      break;
    case "failed":
      list = [...baseTurns, failedTurn];
      status = {
        kind: "failed",
        message: "Claude Code exited with code 1 before finishing.",
      };
      break;
    case "missing-provider":
      list = turns.slice(0, 2);
      status = { kind: "missing-provider", providerName: "Claude Code" };
      break;
    case "mismatch":
      list = turns.slice(0, 2);
      notice = (
        <ScopeMismatchNotice
          title="Notes — pointers & memory"
          subjectName="Programming"
          onAddToScope={() => ctx.log("addToScope")}
          onNewConversation={() => ctx.log("newConversation")}
        />
      );
      break;
    case "empty":
      list = [];
      break;
    default:
      list = turns.slice(0, 2);
  }

  const providerList =
    state === "missing-provider" ? providersMissing : providers;

  return (
    <div className="h-full border-l" style={{ width: `min(100%, ${width}px)` }}>
      <AiPanel
        provider={{
          providers: providerList,
          providerId,
          modelId,
          onProviderChange: (id) => {
            setProviderId(id);
            setModelId(providerList.find((p) => p.id === id)?.models[0]?.id);
          },
          onModelChange: setModelId,
          onConnect: (id) => ctx.log("connect", id),
        }}
        scope={{
          items: state === "empty" ? scope.slice(0, 1) : scope,
          onRemove: (item) => ctx.log("removeScope", item.id),
          onOpen: (item) => ctx.log("openScope", item.id),
        }}
        turns={list}
        status={status}
        composer={{
          onSend: (text) => ctx.log("send", text),
          onStop: () => {
            stream.stop();
            setStopped(true);
            ctx.log("stop");
          },
          onAttach: () => ctx.log("attach"),
          busy: status.kind === "streaming",
          disabledReason:
            state === "missing-provider"
              ? "Connect a provider to send"
              : undefined,
        }}
        context={contextInspector}
        notice={notice}
        onRetry={() => ctx.log("onRetry")}
        onResume={(id) => ctx.log("onResume", id)}
        onAcceptEdit={(id) => {
          setEditStatus("accepted");
          ctx.log("onAcceptEdit", id);
        }}
        onRejectEdit={(id) => {
          setEditStatus("rejected");
          ctx.log("onRejectEdit", id);
        }}
        onOpenCitation={(citation) => ctx.log("onOpenCitation", citation.id)}
        onInsert={() => ctx.log("onInsert")}
        onCopy={() => ctx.log("onCopy")}
        onNewConversation={() => ctx.log("onNewConversation")}
        onCollapse={() => ctx.log("onCollapse")}
        onConnect={() => ctx.log("onConnect")}
      />
    </div>
  );
}

export const page: ExamplePage = {
  section: "patterns",
  group: "AI",
  slug: "ai-panel",
  title: "AI panel",
  description:
    "The full panel across its states. Streaming is simulated: press Stop to end it. Essential actions stay in the same place in every state.",
  source: "packages/ui/src/patterns/ai/ai-panel.tsx",
  keywords: ["chat", "panel", "streaming", "conversation"],
  examples: [
    {
      id: "panel",
      title: "Panel",
      width: "full",
      height: 720,
      states: [
        "default",
        "streaming",
        "awaiting-review",
        "stopped",
        "failed",
        "missing-provider",
        "mismatch",
        "empty",
      ],
      controls: {
        width: { type: "select", options: ["384", "480"], default: "384" },
      },
      render: (ctx) => (
        <div className="flex h-full justify-end bg-background">
          <Panel
            key={`${ctx.state}-${ctx.resetKey}`}
            ctx={ctx}
            width={Number(ctx.controls.width)}
          />
        </div>
      ),
    },
  ],
};
