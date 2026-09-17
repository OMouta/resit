/** Conversation fixtures: scope, attachments, turns, tool activity, and a streaming script. */

export type ProviderId = "claude-code" | "codex";

export interface ProviderFixture {
  id: ProviderId;
  name: string;
  status: "ready" | "not-installed" | "not-authenticated" | "checking";
  version?: string;
  models: { id: string; name: string }[];
}

export const providers: ProviderFixture[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    status: "ready",
    version: "2.1.14",
    models: [
      { id: "claude-fable-5-1", name: "Claude Fable 5.1" },
      { id: "claude-opus-5", name: "Claude Opus 5" },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5" },
    ],
  },
  {
    id: "codex",
    name: "Codex",
    status: "not-authenticated",
    version: "0.52.0",
    models: [{ id: "gpt-5-codex", name: "GPT-5 Codex" }],
  },
];

export const providersMissing: ProviderFixture[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    status: "not-installed",
    models: [],
  },
  { id: "codex", name: "Codex", status: "not-installed", models: [] },
];

export type ScopeChipFixture =
  | {
      kind: "subject";
      id: string;
      label: string;
      color: "blue" | "green" | "orange";
    }
  | { kind: "project"; id: string; label: string }
  | {
      kind: "resource";
      id: string;
      label: string;
      resourceKind: "note" | "pdf";
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

export const scope: ScopeChipFixture[] = [
  { kind: "subject", id: "sub_math", label: "Mathematics", color: "blue" },
  {
    kind: "resource",
    id: "res_ws3_pdf",
    label: "Worksheet 3 — Limits and continuity (ε–δ definitions)",
    resourceKind: "pdf",
  },
  { kind: "page", id: "res_ws3_pdf:7", label: "Page 7", page: 7 },
  {
    kind: "region",
    id: "ann_2",
    label: "Selected region",
    page: 7,
    description: "Exercise 2 (b): lim (3x − 1) = 5 as x → 2",
  },
];

export const projectScope: ScopeChipFixture[] = [
  { kind: "project", id: "prj_numsim", label: "Numerical Simulation" },
  { kind: "subject", id: "sub_math", label: "Mathematics", color: "blue" },
  { kind: "subject", id: "sub_prog", label: "Programming", color: "green" },
  { kind: "subject", id: "sub_phys", label: "Physics", color: "orange" },
];

export interface ToolCallFixture {
  id: string;
  name: string;
  summary: string;
  status: "running" | "done" | "failed";
  detail?: string;
  durationMs?: number;
}

export interface EditProposalFixture {
  id: string;
  resourceId: string;
  resourceTitle: string;
  before: string;
  after: string;
  status: "pending" | "accepted" | "rejected";
}

export type TurnFixture =
  | {
      id: string;
      role: "user";
      text: string;
      attachments?: ScopeChipFixture[];
      at: string;
    }
  | {
      id: string;
      role: "assistant";
      status:
        "streaming" | "complete" | "awaiting-review" | "stopped" | "failed";
      text: string;
      tools?: ToolCallFixture[];
      citations?: {
        id: string;
        label: string;
        page?: number;
        missing?: boolean;
      }[];
      edit?: EditProposalFixture;
      error?: { title: string; detail: string; retryable: boolean };
      at: string;
    };

export const turns: TurnFixture[] = [
  {
    id: "turn_1",
    role: "user",
    text: "I do not understand this step.",
    attachments: [
      {
        kind: "region",
        id: "ann_2",
        label: "Page 7 region",
        page: 7,
        description: "Exercise 2 (b): lim (3x − 1) = 5 as x → 2",
      },
    ],
    at: "2026-09-16T20:56:00Z",
  },
  {
    id: "turn_2",
    role: "assistant",
    status: "complete",
    tools: [
      {
        id: "tool_1",
        name: "read_pdf_page",
        summary: "Read page 7 of Worksheet 3",
        status: "done",
        durationMs: 420,
      },
      {
        id: "tool_2",
        name: "search_notes",
        summary: "Searched Mathematics notes for “absolute value inequality”",
        status: "done",
        detail:
          "2 results: Sequences — ∑ and ∏ notation; Resolution — Worksheet 3",
        durationMs: 180,
      },
    ],
    text: `The step rewrites $|(3x - 1) - 5|$ as $3|x - 2|$. Two things happen at once:

1. Simplify inside the absolute value: $(3x - 1) - 5 = 3x - 6$.
2. Factor the 3 out: $|3x - 6| = |3(x - 2)| = 3|x - 2|$, because $|ab| = |a||b|$ [1].

Once the expression is a constant times $|x - 2|$, picking $\\delta = \\varepsilon / 3$ makes $3|x - 2| < 3\\delta = \\varepsilon$ [2].

The prerequisite here is the product rule for absolute values, not limits themselves. Want a two-minute exercise on it?`,
    citations: [
      { id: "cit_2", label: "Sequences — ∑ and ∏ notation" },
      { id: "cit_1", label: "Worksheet 3, page 7", page: 7 },
    ],
    at: "2026-09-16T20:56:20Z",
  },
  {
    id: "turn_3",
    role: "user",
    text: "Yes, and add the explanation to my resolution note.",
    at: "2026-09-16T20:58:00Z",
  },
  {
    id: "turn_4",
    role: "assistant",
    status: "awaiting-review",
    tools: [
      {
        id: "tool_3",
        name: "propose_note_edit",
        summary: "Proposed an edit to Resolution — Worksheet 3",
        status: "done",
        durationMs: 610,
      },
    ],
    text: "I added the factoring step under Exercise 2 (b) with a link back to page 7. Review the edit below.",
    edit: {
      id: "edit_1",
      resourceId: "res_ws3_note",
      resourceTitle: "Resolution — Worksheet 3",
      before: `$$|(3x - 1) - 5| = |3x - 6| = 3|x - 2|$$

So choosing $\\delta = \\varepsilon / 3$ works.`,
      after: `$$|(3x - 1) - 5| = |3x - 6| = |3(x - 2)| = 3|x - 2|$$

The last equality uses $|ab| = |a|\\,|b|$ (see [Sequences — ∑ and ∏ notation](resit://res_seq_note)).

So choosing $\\delta = \\varepsilon / 3$ gives $3|x - 2| < \\varepsilon$. Source: [Worksheet 3, page 7](resit://res_ws3_pdf?page=7).`,
      status: "pending",
    },
    at: "2026-09-16T20:58:30Z",
  },
];

export const failedTurn: TurnFixture = {
  id: "turn_err",
  role: "assistant",
  status: "failed",
  text: "",
  tools: [
    {
      id: "tool_x",
      name: "read_pdf_page",
      summary: "Read page 3 of Chapter 4 – Newton's laws of motion",
      status: "failed",
      detail: "The PDF file is missing from the workspace.",
    },
  ],
  error: {
    title: "Turn failed",
    detail:
      "Claude Code exited with code 1 before finishing. Diagnostics were saved to the log.",
    retryable: true,
  },
  at: "2026-09-16T21:02:00Z",
};

export const stoppedTurn: TurnFixture = {
  id: "turn_stop",
  role: "assistant",
  status: "stopped",
  text: "The chain rule says that when a function is built by composing two others, its derivative is the product of",
  at: "2026-09-16T21:03:00Z",
};

/** Text chunks for simulated streaming. Join to get the full message. */
export const streamScript: string[] = [
  "Start ",
  "from the ",
  "definition: ",
  "$|f(x) - L| < \\varepsilon$ ",
  "must hold ",
  "whenever ",
  "$0 < |x - a| < \\delta$.\n\n",
  "Here $f(x) = 3x - 1$, ",
  "$a = 2$, ",
  "and $L = 5$. ",
  "So we bound ",
  "$|(3x - 1) - 5| = 3|x - 2|$ ",
  "and choose ",
  "$\\delta = \\varepsilon / 3$.",
];

export const terminalOutput = `$ claude --version
2.1.14 (Claude Code)
$ claude auth status
Logged in as student@isep.ipp.pt (Claude Max)
[mcp] resit-study listening on 127.0.0.1:52731
[mcp] tool read_pdf_page ok 420ms
[mcp] tool search_notes ok 180ms`;

export const contextInspector = {
  turnId: "turn_2",
  included: [
    { kind: "Scope", items: ["Subject: Mathematics", "Project: none"] },
    {
      kind: "Attached",
      items: [
        "Worksheet 3 — Limits and continuity (ε–δ definitions), page 7 (text, 1.2k chars)",
        "Selected region: Exercise 2 (b): lim (3x − 1) = 5 as x → 2",
      ],
    },
    {
      kind: "Learner profile",
      items: [
        "Explanation language: English",
        "Known gap: absolute value inequalities (proposed)",
      ],
    },
  ],
  retrieved: [
    {
      title: "Sequences — ∑ and ∏ notation",
      detail: "section 1, 640 chars",
      via: "search_notes",
    },
    {
      title: "Resolution — Worksheet 3",
      detail: "Exercise 2 (b), 380 chars",
      via: "search_notes",
    },
  ],
  excluded: [
    {
      title: "Notes — pointers & memory",
      reason: "Outside scope (Programming)",
    },
    {
      title: "Lecture notes — Derivatives, the chain rule, and applications…",
      reason: "Too large for the prompt; available through retrieval",
    },
  ],
  tokens: { prompt: 4_812, retrieved: 1_020, budget: 32_000 },
};
