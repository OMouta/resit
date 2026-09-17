/** Learner profile, exercises, quizzes, flashcards, reviews, and planning fixtures. */

export interface ConceptFixture {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  prerequisites: string[];
}

export const concepts: ConceptFixture[] = [
  {
    id: "con_abs",
    name: "Absolute value inequalities",
    subjectId: "sub_math",
    subjectName: "Mathematics",
    prerequisites: [],
  },
  {
    id: "con_lim",
    name: "Limits (ε–δ definition)",
    subjectId: "sub_math",
    subjectName: "Mathematics",
    prerequisites: ["con_abs"],
  },
  {
    id: "con_cont",
    name: "Continuity at a point",
    subjectId: "sub_math",
    subjectName: "Mathematics",
    prerequisites: ["con_lim"],
  },
  {
    id: "con_chain",
    name: "Chain rule",
    subjectId: "sub_math",
    subjectName: "Mathematics",
    prerequisites: ["con_lim"],
  },
  {
    id: "con_ptr",
    name: "Pointers and addresses",
    subjectId: "sub_prog",
    subjectName: "Programming",
    prerequisites: [],
  },
  {
    id: "con_ll",
    name: "Singly linked lists",
    subjectId: "sub_prog",
    subjectName: "Programming",
    prerequisites: ["con_ptr"],
  },
  {
    id: "con_vec",
    name: "Vector components",
    subjectId: "sub_phys",
    subjectName: "Physics",
    prerequisites: [],
  },
];

export interface EvidenceFixture {
  id: string;
  conceptId: string;
  conceptName: string;
  kind: "exercise" | "quiz" | "flashcard" | "conversation" | "manual";
  outcome: "correct" | "partial" | "incorrect" | "observed";
  summary: string;
  sourceTitle: string;
  at: string;
}

export const evidence: EvidenceFixture[] = [
  {
    id: "ev_1",
    conceptId: "con_abs",
    conceptName: "Absolute value inequalities",
    kind: "conversation",
    outcome: "observed",
    summary:
      "Asked why |3x − 6| = 3|x − 2|; needed the product rule explained.",
    sourceTitle: "Conversation · Worksheet 3, page 7",
    at: "2026-09-16T20:56:00Z",
  },
  {
    id: "ev_2",
    conceptId: "con_abs",
    conceptName: "Absolute value inequalities",
    kind: "exercise",
    outcome: "correct",
    summary: "Solved |2x + 1| < 5 with the correct interval (−3, 2).",
    sourceTitle: "Practice · Absolute values",
    at: "2026-09-16T21:10:00Z",
  },
  {
    id: "ev_3",
    conceptId: "con_lim",
    conceptName: "Limits (ε–δ definition)",
    kind: "quiz",
    outcome: "partial",
    summary: "Chose δ = ε for lim (3x − 1); missed the factor 3.",
    sourceTitle: "Quiz · Limits, attempt 2",
    at: "2026-09-15T19:20:00Z",
  },
  {
    id: "ev_4",
    conceptId: "con_ll",
    conceptName: "Singly linked lists",
    kind: "exercise",
    outcome: "incorrect",
    summary: "Lost the head pointer when inserting at the front.",
    sourceTitle: "Assignment 2 — Linked lists in C",
    at: "2026-09-14T16:40:00Z",
  },
  {
    id: "ev_5",
    conceptId: "con_vec",
    conceptName: "Vector components",
    kind: "flashcard",
    outcome: "correct",
    summary: "Recalled v·cos θ for the horizontal component.",
    sourceTitle: "Flashcards · Kinematics",
    at: "2026-09-13T08:30:00Z",
  },
];

export interface ProfileProposalFixture {
  id: string;
  conceptId: string;
  conceptName: string;
  subjectName: string;
  change: string;
  from: "unknown" | "gap" | "developing" | "secure";
  to: "gap" | "developing" | "secure";
  evidenceIds: string[];
  status: "proposed" | "accepted" | "rejected";
  proposedAt: string;
}

export const profileProposals: ProfileProposalFixture[] = [
  {
    id: "prop_1",
    conceptId: "con_abs",
    conceptName: "Absolute value inequalities",
    subjectName: "Mathematics",
    change:
      "Mark as a developing prerequisite: one explanation needed, then one correct exercise.",
    from: "unknown",
    to: "developing",
    evidenceIds: ["ev_1", "ev_2"],
    status: "proposed",
    proposedAt: "2026-09-16T21:11:00Z",
  },
  {
    id: "prop_2",
    conceptId: "con_vec",
    conceptName: "Vector components",
    subjectName: "Physics",
    change: "Mark as secure after three correct reviews in a row.",
    from: "developing",
    to: "secure",
    evidenceIds: ["ev_5"],
    status: "accepted",
    proposedAt: "2026-09-13T08:31:00Z",
  },
  {
    id: "prop_3",
    conceptId: "con_ll",
    conceptName: "Singly linked lists",
    subjectName: "Programming",
    change: "Mark as a gap after one incorrect insertion.",
    from: "developing",
    to: "gap",
    evidenceIds: ["ev_4"],
    status: "rejected",
    proposedAt: "2026-09-14T16:41:00Z",
  },
];

export interface ExerciseFixture {
  id: string;
  conceptName: string;
  subjectName: string;
  prompt: string;
  /** Markdown with math. */
  body: string;
  hint?: string;
  solution: string;
  sourceTitle: string;
  sourcePage?: number;
}

export const exercise: ExerciseFixture = {
  id: "ex_1",
  conceptName: "Absolute value inequalities",
  subjectName: "Mathematics",
  prompt: "Solve for x.",
  body: "Find all real $x$ such that $|2x + 1| < 5$. Write the answer as an interval.",
  hint: "Rewrite $|u| < c$ as $-c < u < c$, then solve both inequalities for $x$.",
  solution:
    "$-5 < 2x + 1 < 5 \\iff -6 < 2x < 4 \\iff -3 < x < 2$, so $x \\in (-3, 2)$.",
  sourceTitle: "Sequences — ∑ and ∏ notation",
};

export interface AnswerFeedbackFixture {
  outcome: "correct" | "partial" | "incorrect";
  answer: string;
  message: string;
  nextStep?: string;
}

export const answerFeedback: Record<
  AnswerFeedbackFixture["outcome"],
  AnswerFeedbackFixture
> = {
  correct: {
    outcome: "correct",
    answer: "(−3, 2)",
    message: "Correct. Both bounds come from splitting the absolute value.",
    nextStep: "Try the same with |x − 4| ≥ 2.",
  },
  partial: {
    outcome: "partial",
    answer: "x < 2",
    message:
      "Half right: the upper bound is correct, but $|u| < c$ also gives a lower bound $u > -c$.",
    nextStep: "Solve $2x + 1 > -5$ and combine.",
  },
  incorrect: {
    outcome: "incorrect",
    answer: "x < 5",
    message:
      "Not yet. The 5 bounds the whole expression $2x + 1$, not $x$ alone.",
    nextStep: "Start from $-5 < 2x + 1 < 5$.",
  },
};

export interface QuizQuestionFixture {
  id: string;
  number: number;
  kind: "choice" | "open";
  text: string;
  options?: string[];
  status: "unanswered" | "answered" | "flagged" | "current";
}

export const quiz = {
  id: "quiz_1",
  title: "Limits — ε–δ proofs",
  subjectName: "Mathematics",
  timeLimitMinutes: 20,
  questions: [
    {
      id: "q1",
      number: 1,
      kind: "choice",
      text: "For $\\lim_{x\\to2}(3x-1)=5$, which $\\delta$ works for a given $\\varepsilon$?",
      options: [
        "$\\delta = \\varepsilon$",
        "$\\delta = \\varepsilon/3$",
        "$\\delta = 3\\varepsilon$",
        "$\\delta = \\varepsilon^2$",
      ],
      status: "answered",
    },
    {
      id: "q2",
      number: 2,
      kind: "open",
      text: "State the ε–δ definition of $\\lim_{x\\to a} f(x) = L$.",
      status: "current",
    },
    {
      id: "q3",
      number: 3,
      kind: "choice",
      text: "Which statement is equivalent to $|x - 2| < 0.1$?",
      options: ["$1.9 < x < 2.1$", "$x < 2.1$", "$x > 1.9$", "$|x| < 2.1$"],
      status: "flagged",
    },
    {
      id: "q4",
      number: 4,
      kind: "open",
      text: "Is $f(x) = \\dfrac{x^2-4}{x-2}$ continuous at $x = 2$? Justify.",
      status: "unanswered",
    },
    {
      id: "q5",
      number: 5,
      kind: "choice",
      text: "Which identity is used to factor $|3x - 6|$?",
      options: [
        "$|a+b| \\le |a|+|b|$",
        "$|ab| = |a||b|$",
        "$|a| = \\sqrt{a^2}$",
        "$|a - b| = |b - a|$",
      ],
      status: "unanswered",
    },
  ] satisfies QuizQuestionFixture[],
};

export interface FlashcardFixture {
  id: string;
  kind: "basic" | "cloze";
  front: string;
  back: string;
  subjectName: string;
  sourceTitle: string;
  due: string;
  state: "new" | "learning" | "review" | "suspended";
  interval?: string;
}

export const flashcards: FlashcardFixture[] = [
  {
    id: "fc_1",
    kind: "basic",
    front: "What does $|ab| = |a|\\,|b|$ let you do inside an ε–δ bound?",
    back: "Pull a constant factor out: $|3(x-2)| = 3|x-2|$, so the bound becomes a multiple of $|x - a|$.",
    subjectName: "Mathematics",
    sourceTitle: "Sequences — ∑ and ∏ notation",
    due: "2026-09-17T08:00:00Z",
    state: "review",
    interval: "3 days",
  },
  {
    id: "fc_2",
    kind: "cloze",
    front:
      "A function $f$ is continuous at $a$ when $\\lim_{x\\to a} f(x) = $ {{c1::$f(a)$}}.",
    back: "$f(a)$",
    subjectName: "Mathematics",
    sourceTitle: "Worksheet 3, page 9",
    due: "2026-09-17T08:00:00Z",
    state: "learning",
    interval: "10 minutes",
  },
  {
    id: "fc_3",
    kind: "basic",
    front: "In C, what is the value of `p` after `int x = 5; int *p = &x;`?",
    back: "The address of `x`. `*p` reads the value 5.",
    subjectName: "Programming",
    sourceTitle: "Notes — pointers & memory",
    due: "2026-09-18T08:00:00Z",
    state: "review",
    interval: "1 day",
  },
  {
    id: "fc_4",
    kind: "basic",
    front:
      "Horizontal component of a velocity $v$ at angle $\\theta$ above the horizontal?",
    back: "$v_x = v\\cos\\theta$",
    subjectName: "Physics",
    sourceTitle: "Kinematics — Δv and vector components",
    due: "2026-09-20T08:00:00Z",
    state: "suspended",
  },
];

export const reviewIntervals = {
  again: "1 min",
  hard: "8 min",
  good: "3 d",
  easy: "8 d",
};

export type AgendaStatus =
  "scheduled" | "in-progress" | "completed" | "overdue" | "suspended";

export interface AgendaItemFixture {
  id: string;
  title: string;
  subjectName: string;
  subjectColor: "blue" | "green" | "orange" | "red" | "purple";
  kind: "reading" | "exercises" | "quiz" | "flashcards" | "assessment";
  start: string;
  end: string;
  status: AgendaStatus;
  resourceTitle?: string;
  progress?: { done: number; total: number };
}

export const agenda: AgendaItemFixture[] = [
  {
    id: "ag_1",
    title: "Read Worksheet 3, pages 7–10",
    subjectName: "Mathematics",
    subjectColor: "blue",
    kind: "reading",
    start: "2026-09-17T09:00:00Z",
    end: "2026-09-17T09:45:00Z",
    status: "completed",
    resourceTitle: "Worksheet 3 — Limits and continuity (ε–δ definitions)",
  },
  {
    id: "ag_2",
    title: "Exercises — absolute value inequalities",
    subjectName: "Mathematics",
    subjectColor: "blue",
    kind: "exercises",
    start: "2026-09-17T10:00:00Z",
    end: "2026-09-17T10:40:00Z",
    status: "in-progress",
    progress: { done: 3, total: 8 },
  },
  {
    id: "ag_3",
    title: "Flashcards due",
    subjectName: "Mathematics",
    subjectColor: "blue",
    kind: "flashcards",
    start: "2026-09-17T14:00:00Z",
    end: "2026-09-17T14:15:00Z",
    status: "scheduled",
    progress: { done: 0, total: 12 },
  },
  {
    id: "ag_4",
    title: "Assignment 2 — insertion and deletion",
    subjectName: "Programming",
    subjectColor: "green",
    kind: "exercises",
    start: "2026-09-16T18:00:00Z",
    end: "2026-09-16T19:30:00Z",
    status: "overdue",
    resourceTitle: "Assignment 2 — Linked lists in C",
  },
  {
    id: "ag_5",
    title: "Quiz — Newton's laws",
    subjectName: "Physics",
    subjectColor: "orange",
    kind: "quiz",
    start: "2026-09-18T16:00:00Z",
    end: "2026-09-18T16:30:00Z",
    status: "suspended",
    resourceTitle: "Chapter 4 – Newton's laws of motion",
  },
  {
    id: "ag_6",
    title: "Test 1 — Análise Matemática I",
    subjectName: "Mathematics",
    subjectColor: "blue",
    kind: "assessment",
    start: "2026-10-02T09:00:00Z",
    end: "2026-10-02T11:00:00Z",
    status: "scheduled",
  },
];

export const weekPlan = {
  weekStart: "2026-09-14T00:00:00Z",
  days: [
    "2026-09-14",
    "2026-09-15",
    "2026-09-16",
    "2026-09-17",
    "2026-09-18",
    "2026-09-19",
    "2026-09-20",
  ],
  availability: [
    { day: "2026-09-14", from: "18:00", to: "21:00" },
    { day: "2026-09-16", from: "18:00", to: "20:00" },
    { day: "2026-09-17", from: "09:00", to: "12:00" },
    { day: "2026-09-17", from: "14:00", to: "16:00" },
    { day: "2026-09-18", from: "16:00", to: "19:00" },
    { day: "2026-09-19", from: "10:00", to: "13:00" },
  ],
  assessments: [
    {
      id: "as_1",
      title: "Test 1 — Análise Matemática I",
      date: "2026-10-02",
      subjectName: "Mathematics",
    },
    {
      id: "as_2",
      title: "Assignment 2 delivery",
      date: "2026-09-21",
      subjectName: "Programming",
    },
  ],
};

export const learnerProfile = {
  explanationLanguage: "English",
  interfaceLanguage: "English",
  concepts: [
    {
      id: "con_abs",
      name: "Absolute value inequalities",
      subjectName: "Mathematics",
      level: "developing",
      lastEvidence: "2026-09-16T21:10:00Z",
    },
    {
      id: "con_lim",
      name: "Limits (ε–δ definition)",
      subjectName: "Mathematics",
      level: "developing",
      lastEvidence: "2026-09-15T19:20:00Z",
    },
    {
      id: "con_cont",
      name: "Continuity at a point",
      subjectName: "Mathematics",
      level: "unknown",
      lastEvidence: null,
    },
    {
      id: "con_chain",
      name: "Chain rule",
      subjectName: "Mathematics",
      level: "gap",
      lastEvidence: "2026-09-08T17:00:00Z",
    },
    {
      id: "con_ptr",
      name: "Pointers and addresses",
      subjectName: "Programming",
      level: "secure",
      lastEvidence: "2026-09-15T18:30:00Z",
    },
    {
      id: "con_ll",
      name: "Singly linked lists",
      subjectName: "Programming",
      level: "developing",
      lastEvidence: "2026-09-14T16:40:00Z",
    },
    {
      id: "con_vec",
      name: "Vector components",
      subjectName: "Physics",
      level: "secure",
      lastEvidence: "2026-09-13T08:30:00Z",
    },
  ] as const,
};
