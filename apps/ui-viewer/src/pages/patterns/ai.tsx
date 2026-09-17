import { useState } from "react";

import {
  ApprovalCard,
  type ApprovalStatus,
} from "@resit/ui/patterns/ai/approval-card";
import { Composer } from "@resit/ui/patterns/ai/composer";
import { ContextInspector } from "@resit/ui/patterns/ai/context-inspector";
import { EditPreview } from "@resit/ui/patterns/ai/edit-preview";
import {
  AssistantMessage,
  TurnErrorCard,
  UserMessage,
} from "@resit/ui/patterns/ai/message";
import {
  ProviderModelSelect,
  ProviderStatusBadge,
} from "@resit/ui/patterns/ai/provider-select";
import {
  ScopeChipList,
  ScopeMismatchNotice,
} from "@resit/ui/patterns/ai/scope-chips";
import { TerminalOutput } from "@resit/ui/patterns/ai/terminal-output";
import { ToolActivity } from "@resit/ui/patterns/ai/tool-activity";
import {
  TurnStatusBar,
  type PanelStatus,
} from "@resit/ui/patterns/ai/turn-status";
import type { EditStatus, ScopeItem } from "@resit/ui/patterns/ai/types";

import {
  contextInspector,
  failedTurn,
  projectScope,
  providers,
  providersMissing,
  scope,
  stoppedTurn,
  terminalOutput,
  turns,
} from "../../fixtures/chat";
import type { ExampleContext, ExamplePage } from "../../viewer/types";

function ProviderExample({ ctx }: { ctx: ExampleContext }) {
  const list = ctx.state === "missing" ? providersMissing : providers;
  const [providerId, setProviderId] = useState(
    ctx.state === "codex" ? "codex" : "claude-code",
  );
  const [modelId, setModelId] = useState<string | undefined>(
    "claude-fable-5-1",
  );
  return (
    <ProviderModelSelect
      providers={
        ctx.state === "checking"
          ? list.map((p) => ({ ...p, status: "checking" as const }))
          : list
      }
      providerId={providerId}
      modelId={modelId}
      onProviderChange={(id) => {
        setProviderId(id);
        setModelId(list.find((p) => p.id === id)?.models[0]?.id);
        ctx.log("onProviderChange", id);
      }}
      onModelChange={(id) => {
        setModelId(id);
        ctx.log("onModelChange", id);
      }}
      onConnect={(id) => ctx.log("onConnect", id)}
    />
  );
}

function ScopeExample({ ctx }: { ctx: ExampleContext }) {
  const initial: ScopeItem[] =
    ctx.state === "project"
      ? projectScope
      : ctx.state === "overflow"
        ? [
            ...scope,
            ...projectScope,
            {
              kind: "selection",
              id: "sel_1",
              label: "Selection",
              text: "choose δ accordingly",
            },
            { kind: "block", id: "blk_1", label: "Exercise 2 (b)" },
          ]
        : scope;
  const [items, setItems] = useState<ScopeItem[]>(initial);
  return (
    <ScopeChipList
      items={ctx.state === "empty" ? [] : items}
      readOnly={ctx.state === "read-only"}
      onRemove={(item) => {
        setItems((previous) =>
          previous.filter((entry) => entry.id !== item.id),
        );
        ctx.log("onRemove", item.id);
      }}
      onOpen={(item) => ctx.log("onOpen", item.id)}
      onShowAll={() => ctx.log("onShowAll")}
    />
  );
}

function EditExample({ ctx }: { ctx: ExampleContext }) {
  const edit = turns[3]!.role === "assistant" ? turns[3]!.edit! : null;
  const [status, setStatus] = useState<EditStatus>("pending");
  if (!edit) return null;
  return (
    <EditPreview
      edit={{ ...edit, status }}
      subjectName="Mathematics"
      onAccept={(id) => {
        setStatus("accepted");
        ctx.log("onAccept", id);
      }}
      onReject={(id) => {
        setStatus("rejected");
        ctx.log("onReject", id);
      }}
      onOpen={(id) => ctx.log("onOpen", id)}
    />
  );
}

function ApprovalExample({ ctx }: { ctx: ExampleContext }) {
  const [status, setStatus] = useState<ApprovalStatus>(
    ctx.state === "expired" ? "expired" : "pending",
  );
  return (
    <ApprovalCard
      title="Create a flashcard deck in Mathematics"
      description="The agent wants to add 6 flashcards from Worksheet 3 to your Mathematics deck."
      {...(ctx.state === "risky"
        ? { risk: "Writes files outside the current note." }
        : {})}
      status={status}
      onApprove={(options) => {
        setStatus("approved");
        ctx.log("onApprove", options);
      }}
      onReject={() => {
        setStatus("rejected");
        ctx.log("onReject");
      }}
    />
  );
}

const assistantTurn = turns[1]!.role === "assistant" ? turns[1]! : null;
const reviewTurn = turns[3]!.role === "assistant" ? turns[3]! : null;

const statusByState: Record<string, PanelStatus> = {
  idle: { kind: "idle" },
  streaming: { kind: "streaming", phase: "writing" },
  tools: { kind: "streaming", phase: "tools" },
  review: { kind: "awaiting-review", pending: 1 },
  stopped: { kind: "stopped" },
  failed: {
    kind: "failed",
    message: "Claude Code exited with code 1 before finishing.",
  },
  "missing-provider": { kind: "missing-provider", providerName: "Claude Code" },
};

export const page: ExamplePage = {
  section: "patterns",
  group: "AI",
  slug: "ai",
  title: "AI panel components",
  description:
    "Provider and model selection, scope chips, the composer, messages with tool activity and citations, edit previews, approvals, and the context inspector.",
  source: "packages/ui/src/patterns/ai/message.tsx",
  keywords: [
    "chat",
    "assistant",
    "provider",
    "scope",
    "composer",
    "citation",
    "approval",
    "diff",
  ],
  examples: [
    {
      id: "provider",
      title: "Provider and model",
      description:
        "Providers that are not ready stay visible with a status and a next step.",
      width: "auto",
      states: ["ready", "codex", "checking", "missing"],
      render: (ctx) => (
        <div className="flex flex-col gap-4">
          <ProviderExample ctx={ctx} />
          <div className="flex flex-wrap gap-2">
            <ProviderStatusBadge status="ready" version="2.1.14" />
            <ProviderStatusBadge status="not-authenticated" />
            <ProviderStatusBadge status="not-installed" />
            <ProviderStatusBadge status="checking" />
          </div>
        </div>
      ),
    },
    {
      id: "scope",
      title: "Scope chips",
      width: 420,
      states: ["default", "project", "overflow", "read-only", "empty"],
      render: (ctx) => <ScopeExample key={ctx.state} ctx={ctx} />,
    },
    {
      id: "mismatch",
      title: "Out-of-scope tab",
      width: 420,
      render: (ctx) => (
        <ScopeMismatchNotice
          title="Notes — pointers & memory"
          subjectName="Programming"
          onAddToScope={() => ctx.log("onAddToScope")}
          onNewConversation={() => ctx.log("onNewConversation")}
          onDismiss={() => ctx.log("onDismiss")}
        />
      ),
    },
    {
      id: "composer",
      title: "Composer",
      width: 420,
      states: ["idle", "busy", "disabled"],
      render: (ctx) => (
        <Composer
          key={ctx.state}
          busy={ctx.state === "busy"}
          disabledReason={
            ctx.state === "disabled" ? "Connect a provider to send" : undefined
          }
          defaultValue={
            ctx.state === "busy"
              ? ""
              : "Why does the factor 3 come out of the absolute value?"
          }
          onSend={(text) => ctx.log("onSend", text)}
          onStop={() => ctx.log("onStop")}
          onAttach={() => ctx.log("onAttach")}
        >
          <ScopeChipList items={scope.slice(0, 2)} readOnly />
        </Composer>
      ),
    },
    {
      id: "messages",
      title: "Messages",
      description:
        "A user turn with an attached region, then an assistant turn with tools and sources.",
      width: 480,
      render: (ctx) => (
        <div className="flex flex-col gap-5">
          <UserMessage
            text={turns[0]!.text}
            attachments={
              turns[0]!.role === "user" ? turns[0]!.attachments : undefined
            }
            at={turns[0]!.at}
          />
          {assistantTurn ? (
            <AssistantMessage
              status="complete"
              text={assistantTurn.text}
              providerName="Claude Code"
              tools={assistantTurn.tools}
              citations={assistantTurn.citations}
              at={assistantTurn.at}
              onCopy={(text) => ctx.log("onCopy", text.length)}
              onInsert={() => ctx.log("onInsert")}
              onRegenerate={() => ctx.log("onRegenerate")}
              onOpenCitation={(citation) =>
                ctx.log("onOpenCitation", citation.id)
              }
            />
          ) : null}
        </div>
      ),
    },
    {
      id: "message-states",
      title: "Message states",
      width: 480,
      states: ["streaming", "awaiting-review", "stopped", "failed"],
      render: (ctx) => {
        if (ctx.state === "streaming")
          return (
            <AssistantMessage
              status="streaming"
              text="Start from the definition: $|f(x) - L| < \\varepsilon$ must hold whenever"
              providerName="Claude Code"
              tools={[
                {
                  id: "t",
                  name: "read_pdf_page",
                  summary: "Reading page 7 of Worksheet 3",
                  status: "running",
                },
              ]}
              at="2026-09-16T20:56:00Z"
              onStop={() => ctx.log("onStop")}
            />
          );
        if (ctx.state === "awaiting-review" && reviewTurn)
          return (
            <AssistantMessage
              status="awaiting-review"
              text={reviewTurn.text}
              providerName="Claude Code"
              tools={reviewTurn.tools}
              at={reviewTurn.at}
            >
              <EditExample ctx={ctx} />
            </AssistantMessage>
          );
        if (ctx.state === "stopped" && stoppedTurn.role === "assistant")
          return (
            <AssistantMessage
              status="stopped"
              text={stoppedTurn.text}
              providerName="Claude Code"
              at={stoppedTurn.at}
              onResume={() => ctx.log("onResume")}
            />
          );
        if (failedTurn.role === "assistant")
          return (
            <AssistantMessage
              status="failed"
              text=""
              providerName="Claude Code"
              tools={failedTurn.tools}
              error={failedTurn.error}
              at={failedTurn.at}
              onRetry={() => ctx.log("onRetry")}
              onDiagnostics={() => ctx.log("onDiagnostics")}
            />
          );
        return null;
      },
    },
    {
      id: "tools",
      title: "Tool activity",
      width: 420,
      render: () => (
        <ToolActivity
          calls={[
            {
              id: "1",
              name: "read_pdf_page",
              summary: "Read page 7 of Worksheet 3",
              status: "done",
              durationMs: 420,
            },
            {
              id: "2",
              name: "search_notes",
              summary: "Searched Mathematics notes for “absolute value”",
              status: "done",
              detail: "2 results",
              durationMs: 180,
            },
            {
              id: "3",
              name: "read_pdf_page",
              summary: "Read page 3 of Chapter 4 – Newton's laws of motion",
              status: "failed",
              detail: "The PDF file is missing from the workspace.",
            },
            {
              id: "4",
              name: "propose_note_edit",
              summary: "Proposing an edit to Resolution — Worksheet 3",
              status: "running",
            },
          ]}
        />
      ),
    },
    {
      id: "edit-preview",
      title: "Edit preview",
      width: 480,
      render: (ctx) => <EditExample key={ctx.resetKey} ctx={ctx} />,
    },
    {
      id: "approval",
      title: "Approval card",
      width: 480,
      states: ["default", "risky", "expired"],
      render: (ctx) => (
        <ApprovalExample key={`${ctx.state}-${ctx.resetKey}`} ctx={ctx} />
      ),
    },
    {
      id: "error",
      title: "Turn error",
      width: 420,
      render: (ctx) =>
        failedTurn.role === "assistant" && failedTurn.error ? (
          <TurnErrorCard
            error={failedTurn.error}
            onRetry={() => ctx.log("onRetry")}
            onDiagnostics={() => ctx.log("onDiagnostics")}
          />
        ) : null,
    },
    {
      id: "context",
      title: "Context inspector",
      width: 360,
      render: () => <ContextInspector {...contextInspector} />,
    },
    {
      id: "status",
      title: "Turn status bar",
      width: 420,
      states: Object.keys(statusByState),
      render: (ctx) => (
        <div className="-m-4 border-t">
          <TurnStatusBar
            status={statusByState[ctx.state] ?? { kind: "idle" }}
            onStop={() => ctx.log("onStop")}
            onRetry={() => ctx.log("onRetry")}
            onReview={() => ctx.log("onReview")}
            onConnect={() => ctx.log("onConnect")}
          />
        </div>
      ),
    },
    {
      id: "terminal",
      title: "Diagnostics output",
      width: 480,
      render: (ctx) => (
        <TerminalOutput
          text={terminalOutput}
          onCopy={() => ctx.log("onCopy")}
        />
      ),
    },
  ],
};
