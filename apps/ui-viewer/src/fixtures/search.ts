import type { SearchResult } from "@resit/ui/patterns/navigation/search-results";

export const searchQuery = "absolute value";

export const searchResults: SearchResult[] = [
  {
    id: "sr_1",
    kind: "note",
    title: "Sequences — ∑ and ∏ notation",
    subject: { name: "Mathematics", color: "blue" },
    snippet:
      "For any real numbers a and b, |a · b| = |a| · |b|, and |a + b| ≤ |a| + |b|. These two facts are used constantly when bounding {{absolute value}} expressions.",
    location: "Section 1",
  },
  {
    id: "sr_2",
    kind: "note",
    title: "Resolution — Worksheet 3",
    subject: { name: "Mathematics", color: "blue" },
    snippet:
      "Prerequisite: {{absolute value}} inequalities. See Sequences — ∑ and ∏ notation, section 1.",
    location: "Exercise 2 (b)",
  },
  {
    id: "sr_3",
    kind: "pdf",
    title: "Worksheet 3 — Limits and continuity (ε–δ definitions)",
    subject: { name: "Mathematics", color: "blue" },
    snippet:
      "Hint: write |f(x) − L| in terms of |x − a| and choose δ accordingly. Recall the {{absolute value}} of a product.",
    page: 7,
  },
  {
    id: "sr_4",
    kind: "flashcard",
    title: "What does |ab| = |a| |b| let you do inside an ε–δ bound?",
    subject: { name: "Mathematics", color: "blue" },
    snippet:
      "Pull a constant factor out of an {{absolute value}}: |3(x−2)| = 3|x−2|.",
  },
  {
    id: "sr_5",
    kind: "conversation",
    title: "I do not understand this step",
    subject: { name: "Mathematics", color: "blue" },
    snippet:
      "The prerequisite here is the product rule for {{absolute value}}s, not limits themselves.",
  },
  {
    id: "sr_6",
    kind: "note",
    title: "Kinematics — Δv and vector components",
    subject: { name: "Physics", color: "orange" },
    snippet:
      "Speed is the {{absolute value}} of velocity along the direction of motion; the sign only tells the direction.",
    location: "Definitions",
  },
];
