/** Note content, math, PDF pages, annotations, and citations. */

export const noteMarkdown = `# Resolution — Worksheet 3

## Exercise 2 (b)

Show that $\\lim_{x \\to 2} (3x - 1) = 5$ using the ε–δ definition.

Let $\\varepsilon > 0$. We need $\\delta > 0$ such that $0 < |x - 2| < \\delta$ implies $|(3x - 1) - 5| < \\varepsilon$.

$$|(3x - 1) - 5| = |3x - 6| = 3|x - 2|$$

So choosing $\\delta = \\varepsilon / 3$ works.

> Prerequisite: absolute value inequalities. See *Sequences — ∑ and ∏ notation*, section 1.

## Exercise 3

The function $f(x) = \\dfrac{x^2 - 4}{x - 2}$ is not defined at $x = 2$, but the limit exists.
`;

export const outline = [
  { id: "h1", level: 1, text: "Resolution — Worksheet 3" },
  { id: "h2a", level: 2, text: "Exercise 2 (b)" },
  { id: "h2b", level: 2, text: "Exercise 3" },
  { id: "h3a", level: 3, text: "Removable discontinuity" },
  {
    id: "h2c",
    level: 2,
    text: "Exercise 5 — continuity of piecewise functions on closed intervals",
  },
  { id: "h2d", level: 2, text: "Open questions" },
];

export const mathSamples = {
  inline: "\\varepsilon\\text{–}\\delta",
  limit: "\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2} = 4",
  epsilonDelta:
    "\\forall \\varepsilon > 0\\; \\exists \\delta > 0 : 0 < |x - a| < \\delta \\implies |f(x) - L| < \\varepsilon",
  integral: "\\int_0^{\\pi} \\sin(x)\\,dx = \\Big[-\\cos(x)\\Big]_0^{\\pi} = 2",
  matrix:
    "A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}, \\quad \\det A = -2",
  sum: "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}",
  long: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h} = \\lim_{h \\to 0} \\frac{(x+h)^3 - x^3}{h} = \\lim_{h \\to 0} \\frac{3x^2h + 3xh^2 + h^3}{h} = 3x^2",
  broken: "\\frac{1}{2",
  unknownCommand: "\\foo{x}",
};

export interface PdfPageFixture {
  number: number;
  /** Rendered aspect ratio width/height. */
  aspect: number;
  /** Text lines drawn on the placeholder page. */
  lines: string[];
}

export const pdfDocument = {
  resourceId: "res_ws3_pdf",
  title: "Worksheet 3 — Limits and continuity (ε–δ definitions)",
  pageCount: 14,
  currentPage: 7,
  zoom: 1.25,
  pages: Array.from({ length: 14 }, (_, index): PdfPageFixture => ({
    number: index + 1,
    aspect: 0.707,
    lines:
      index + 1 === 7
        ? [
            "Exercise 2. Prove the following limits using the definition.",
            "(a)  lim (2x + 3) = 7  as x → 2",
            "(b)  lim (3x − 1) = 5  as x → 2",
            "(c)  lim x² = 9  as x → 3",
            "",
            "Hint: write |f(x) − L| in terms of |x − a| and choose δ accordingly.",
            "",
            "Exercise 3. Study the continuity of f at x = 2 where",
            "      f(x) = (x² − 4) / (x − 2)  for x ≠ 2,  f(2) = 3.",
          ]
        : [
            `Section ${Math.ceil((index + 1) / 3)} — page ${index + 1}`,
            "Lorem ipsum is not used in study fixtures. This page holds",
            "placeholder text so page navigation has something to show.",
          ],
  })),
};

export interface AnnotationFixture {
  id: string;
  kind: "highlight" | "underline" | "region" | "comment";
  page: number;
  color: "yellow" | "green" | "blue" | "pink";
  text?: string;
  comment?: string;
  /** Region rectangle in page fractions. */
  rect?: { x: number; y: number; width: number; height: number };
  description?: string;
  createdAt: string;
}

export const annotations: AnnotationFixture[] = [
  {
    id: "ann_1",
    kind: "highlight",
    page: 7,
    color: "yellow",
    text: "Prove the following limits using the definition.",
    createdAt: "2026-09-14T09:12:00Z",
  },
  {
    id: "ann_2",
    kind: "region",
    page: 7,
    color: "blue",
    rect: { x: 0.12, y: 0.31, width: 0.6, height: 0.07 },
    description: "Exercise 2 (b): lim (3x − 1) = 5 as x → 2",
    comment: "I do not understand this step",
    createdAt: "2026-09-16T20:55:00Z",
  },
  {
    id: "ann_3",
    kind: "underline",
    page: 9,
    color: "green",
    text: "A function is continuous at a if the limit equals f(a).",
    createdAt: "2026-09-14T09:40:00Z",
  },
  {
    id: "ann_4",
    kind: "comment",
    page: 12,
    color: "pink",
    comment: "Ask about the second case in the exam review.",
    createdAt: "2026-09-15T15:02:00Z",
  },
];

export interface CitationFixture {
  id: string;
  resourceId: string;
  resourceTitle: string;
  subjectName: string;
  page?: number;
  quote: string;
  /** The linked resource or page no longer resolves. */
  missing?: boolean;
}

export const citations: CitationFixture[] = [
  {
    id: "cit_1",
    resourceId: "res_ws3_pdf",
    resourceTitle: "Worksheet 3 — Limits and continuity (ε–δ definitions)",
    subjectName: "Mathematics",
    page: 7,
    quote:
      "Hint: write |f(x) − L| in terms of |x − a| and choose δ accordingly.",
  },
  {
    id: "cit_2",
    resourceId: "res_seq_note",
    resourceTitle: "Sequences — ∑ and ∏ notation",
    subjectName: "Mathematics",
    quote:
      "For any real numbers a and b, |a · b| = |a| · |b|, and |a + b| ≤ |a| + |b| (triangle inequality). These two facts are used constantly when bounding expressions of the form |f(x) − L|, because they let us pull constants out and split sums into pieces that can each be controlled separately. The triangle inequality is the workhorse of every ε–δ proof in this course, and it is worth practising until the manipulation is automatic.",
  },
  {
    id: "cit_3",
    resourceId: "res_phys_ch4",
    resourceTitle: "Chapter 4 – Newton's laws of motion",
    subjectName: "Physics",
    page: 3,
    quote: "The net force on a body equals the rate of change of its momentum.",
    missing: true,
  },
];

export const relatedResources = [
  {
    resourceId: "res_seq_note",
    title: "Sequences — ∑ and ∏ notation",
    subjectName: "Mathematics",
    reason: "Linked from Exercise 2 (b)",
  },
  {
    resourceId: "res_deriv_pdf",
    title:
      "Lecture notes — Derivatives, the chain rule, and applications to optimisation problems in one real variable (revised edition, September 2026)",
    subjectName: "Mathematics",
    reason: "Same concept: limits",
  },
  {
    resourceId: "res_phys_ch4",
    title: "Chapter 4 – Newton's laws of motion",
    subjectName: "Physics",
    reason: "Cited in this note",
    missing: true,
  },
];
