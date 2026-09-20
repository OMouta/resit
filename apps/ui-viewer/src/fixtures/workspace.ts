import type { SubjectColor } from "@resit/ui/lib/subject-color";

/** Fixed clock so relative dates render the same on every load. */
export const FIXTURE_NOW = new Date("2026-09-17T10:00:00Z");

export interface SubjectFixture {
  id: string;
  name: string;
  course: string;
  year: string;
  color: SubjectColor;
  archived?: boolean;
}

export type ResourceKind = "note" | "pdf" | "image" | "attachment";

export interface ResourceFixture {
  id: string;
  subjectId: string | null;
  kind: ResourceKind;
  title: string;
  path: string;
  folder?: string;
  modifiedAt: string;
  pages?: number;
  sizeBytes?: number;
  /** The file is referenced by the workspace but not found on disk. */
  missing?: boolean;
}

export interface ProjectFixture {
  id: string;
  name: string;
  resourceIds: string[];
  subjectIds: string[];
  createdAt: string;
}

export const workspace = {
  id: "ws_8f2c1d",
  name: "Studies 2026/27",
  path: "D:/Studies 2026-27",
  recent: [
    { id: "ws_8f2c1d", name: "Studies 2026/27", path: "D:/Studies 2026-27" },
    {
      id: "ws_3a9e0b",
      name: "Curso Profissional — Informática",
      path: "D:/Study/Curso Profissional",
    },
    {
      id: "ws_c0ffee",
      name: "Sandbox",
      path: "C:/Users/student/Desktop/resit-sandbox",
    },
  ],
};

export const subjects: SubjectFixture[] = [
  {
    id: "sub_math",
    name: "Mathematics",
    course: "Análise Matemática I",
    year: "Year 1 · Semester 1",
    color: "blue",
  },
  {
    id: "sub_prog",
    name: "Programming",
    course: "Programação Imperativa",
    year: "Year 1 · Semester 1",
    color: "green",
  },
  {
    id: "sub_phys",
    name: "Physics",
    course: "Física I",
    year: "Year 1 · Semester 1",
    color: "orange",
  },
  {
    id: "sub_num",
    name: "Métodos Numéricos",
    course: "Métodos Numéricos",
    year: "Year 1 · Semester 2",
    color: "red",
  },
  {
    id: "sub_alg",
    name: "Algebra",
    course: "Álgebra Linear e Geometria Analítica",
    year: "Year 1 · Semester 1",
    color: "purple",
    archived: true,
  },
];

export const resources: ResourceFixture[] = [
  {
    id: "res_ws3_pdf",
    subjectId: "sub_math",
    kind: "pdf",
    title: "Worksheet 3 — Limits and continuity (ε–δ definitions)",
    path: "Mathematics/documents/Worksheet 3 — Limits and continuity.pdf",
    folder: "Worksheets",
    modifiedAt: "2026-09-12T14:20:00Z",
    pages: 14,
    sizeBytes: 1_284_311,
  },
  {
    id: "res_ws3_note",
    subjectId: "sub_math",
    kind: "note",
    title: "Resolution — Worksheet 3",
    path: "Mathematics/notes/Resolution — Worksheet 3.md",
    folder: "Worksheets",
    modifiedAt: "2026-09-16T21:05:00Z",
  },
  {
    id: "res_seq_note",
    subjectId: "sub_math",
    kind: "note",
    title: "Sequences — ∑ and ∏ notation",
    path: "Mathematics/notes/Sequences — ∑ and ∏ notation.md",
    modifiedAt: "2026-09-10T09:30:00Z",
  },
  {
    id: "res_deriv_pdf",
    subjectId: "sub_math",
    kind: "pdf",
    title:
      "Lecture notes — Derivatives, the chain rule, and applications to optimisation problems in one real variable (revised edition, September 2026)",
    path: "Mathematics/documents/Lecture notes — Derivatives (revised).pdf",
    folder: "Lectures",
    modifiedAt: "2026-09-08T16:45:00Z",
    pages: 62,
    sizeBytes: 5_902_144,
  },
  {
    id: "res_prog_a2",
    subjectId: "sub_prog",
    kind: "pdf",
    title: "Assignment 2 — Linked lists in C",
    path: "Programming/documents/Assignment 2 — Linked lists in C.pdf",
    folder: "Assignments",
    modifiedAt: "2026-09-14T11:00:00Z",
    pages: 6,
    sizeBytes: 402_118,
  },
  {
    id: "res_prog_ptr",
    subjectId: "sub_prog",
    kind: "note",
    title: "Notes — pointers & memory",
    path: "Programming/notes/Notes — pointers & memory.md",
    modifiedAt: "2026-09-15T18:12:00Z",
  },
  {
    id: "res_prog_ws3",
    subjectId: "sub_prog",
    kind: "note",
    title: "Resolution — Worksheet 3",
    path: "Programming/notes/Resolution — Worksheet 3.md",
    folder: "Worksheets",
    modifiedAt: "2026-09-11T20:40:00Z",
  },
  {
    id: "res_prog_main",
    subjectId: "sub_prog",
    kind: "attachment",
    title: "main.c",
    path: "Programming/attachments/main.c",
    modifiedAt: "2026-09-15T18:30:00Z",
    sizeBytes: 3_812,
  },
  {
    id: "res_phys_kin",
    subjectId: "sub_phys",
    kind: "note",
    title: "Kinematics — Δv and vector components",
    path: "Physics/notes/Kinematics — Δv and vector components.md",
    modifiedAt: "2026-09-13T08:15:00Z",
  },
  {
    id: "res_phys_lab",
    subjectId: "sub_phys",
    kind: "note",
    title: "Lab report — simple pendulum (g ≈ 9.81 m·s⁻²)",
    path: "Physics/notes/Lab report — simple pendulum.md",
    modifiedAt: "2026-09-09T17:00:00Z",
  },
  {
    id: "res_phys_ch4",
    subjectId: "sub_phys",
    kind: "pdf",
    title: "Chapter 4 – Newton's laws of motion",
    path: "Physics/documents/Chapter 4 – Newton's laws of motion.pdf",
    modifiedAt: "2026-09-02T10:00:00Z",
    pages: 38,
    sizeBytes: 3_114_002,
    missing: true,
  },
  {
    id: "res_phys_fig",
    subjectId: "sub_phys",
    kind: "image",
    title: "free-body-diagram.png",
    path: "Physics/attachments/free-body-diagram.png",
    modifiedAt: "2026-09-13T08:20:00Z",
    sizeBytes: 88_120,
  },
  {
    id: "res_lib_cal",
    subjectId: null,
    kind: "pdf",
    title: "Academic calendar 2026/27",
    path: "Library/Academic calendar 2026-27.pdf",
    modifiedAt: "2026-09-01T09:00:00Z",
    pages: 2,
    sizeBytes: 210_554,
  },
];

export const projects: ProjectFixture[] = [
  {
    id: "prj_numsim",
    name: "Numerical Simulation",
    resourceIds: ["res_deriv_pdf", "res_prog_ptr", "res_phys_kin"],
    subjectIds: ["sub_math", "sub_prog", "sub_phys"],
    createdAt: "2026-09-05T12:00:00Z",
  },
  {
    id: "prj_exam",
    name: "Exam prep — January",
    resourceIds: ["res_ws3_pdf", "res_ws3_note", "res_seq_note"],
    subjectIds: ["sub_math"],
    createdAt: "2026-09-15T12:00:00Z",
  },
];

export function subjectById(id: string | null): SubjectFixture | undefined {
  return subjects.find((subject) => subject.id === id);
}

export function resourceById(id: string): ResourceFixture {
  const resource = resources.find((entry) => entry.id === id);
  if (!resource) throw new Error(`Unknown fixture resource ${id}`);
  return resource;
}

export function resourcesForSubject(
  subjectId: string | null,
): ResourceFixture[] {
  return resources.filter((resource) => resource.subjectId === subjectId);
}

/** Open tabs for the composed workspace. Two tabs share a title across subjects. */
export interface TabFixture {
  id: string;
  resourceId: string;
  pinned?: boolean;
  dirty?: boolean;
  paneId: "left" | "right";
}

export const openTabs: TabFixture[] = [
  { id: "tab_1", resourceId: "res_ws3_pdf", paneId: "left", pinned: true },
  { id: "tab_2", resourceId: "res_ws3_note", paneId: "right", dirty: true },
  { id: "tab_3", resourceId: "res_prog_ws3", paneId: "right" },
  { id: "tab_4", resourceId: "res_deriv_pdf", paneId: "left" },
  { id: "tab_5", resourceId: "res_phys_ch4", paneId: "left" },
  { id: "tab_6", resourceId: "res_prog_ptr", paneId: "right" },
  { id: "tab_7", resourceId: "res_seq_note", paneId: "right" },
];
