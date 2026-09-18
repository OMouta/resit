import type { SubjectColor } from "@resit/ui/lib/subject-color";

export type ProviderStatus =
  "ready" | "not-installed" | "not-authenticated" | "checking";

export interface ProviderOption {
  id: string;
  name: string;
  status: ProviderStatus;
  version?: string;
  models: { id: string; name: string; description?: string }[];
}

export type ScopeItem =
  | { kind: "subject"; id: string; label: string; color: SubjectColor }
  | { kind: "project"; id: string; label: string }
  | {
      kind: "resource";
      id: string;
      label: string;
      resourceKind: "note" | "pdf" | "image" | "attachment";
      retrievable?: boolean;
    }
  | { kind: "page"; id: string; label: string; page: number }
  | {
      kind: "region";
      id: string;
      label: string;
      page: number;
      description: string;
    }
  | { kind: "selection"; id: string; label: string; text: string }
  | { kind: "block"; id: string; label: string };

export type ToolCallStatus = "running" | "done" | "failed";

export interface ToolCall {
  id: string;
  name: string;
  summary: string;
  status: ToolCallStatus;
  detail?: string;
  durationMs?: number;
}

export interface Citation {
  id: string;
  label: string;
  page?: number;
  missing?: boolean;
}

export type EditStatus = "pending" | "accepted" | "rejected";

export interface EditProposal {
  id: string;
  resourceId: string;
  resourceTitle: string;
  before: string;
  after: string;
  status: EditStatus;
}

export type TurnStatus =
  "streaming" | "complete" | "awaiting-review" | "stopped" | "failed";

export interface TurnError {
  title: string;
  detail: string;
  retryable: boolean;
}

export type Turn =
  | {
      id: string;
      role: "user";
      text: string;
      attachments?: ScopeItem[];
      at: string;
    }
  | {
      id: string;
      role: "assistant";
      status: TurnStatus;
      text: string;
      tools?: ToolCall[];
      citations?: Citation[];
      edit?: EditProposal;
      error?: TurnError;
      at: string;
    };
