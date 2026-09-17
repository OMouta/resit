/** Import, save, conflict, history, trash, export, and error fixtures. */

export interface ImportJobFixture {
  id: string;
  fileName: string;
  sizeBytes: number;
  subjectName: string;
  stage:
    | "queued"
    | "copying"
    | "hashing"
    | "extracting"
    | "indexing"
    | "done"
    | "failed"
    | "cancelled";
  progress: number;
  error?: string;
  cancelable: boolean;
}

export const importJobs: ImportJobFixture[] = [
  {
    id: "imp_1",
    fileName: "Worksheet 4 — Derivatives.pdf",
    sizeBytes: 2_411_200,
    subjectName: "Mathematics",
    stage: "extracting",
    progress: 0.62,
    cancelable: true,
  },
  {
    id: "imp_2",
    fileName: "Aula 5 — Estruturas de dados (ç, ã, õ).pdf",
    sizeBytes: 9_812_004,
    subjectName: "Programming",
    stage: "queued",
    progress: 0,
    cancelable: true,
  },
  {
    id: "imp_3",
    fileName: "Chapter 5 – Work and energy.pdf",
    sizeBytes: 3_002_118,
    subjectName: "Physics",
    stage: "done",
    progress: 1,
    cancelable: false,
  },
  {
    id: "imp_4",
    fileName: "scan_0042.pdf",
    sizeBytes: 41_900_233,
    subjectName: "Mathematics",
    stage: "failed",
    progress: 0.3,
    error: "The PDF is encrypted. Remove the password and import it again.",
    cancelable: false,
  },
];

export const attachmentDetails = {
  resourceId: "res_prog_main",
  title: "main.c",
  path: "Programming/attachments/main.c",
  sizeBytes: 3_812,
  mediaType: "text/x-c",
  sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  addedAt: "2026-09-15T18:30:00Z",
  modifiedAt: "2026-09-15T18:30:00Z",
  referencedBy: [
    { title: "Notes — pointers & memory", subjectName: "Programming" },
    { title: "Assignment 2 — Linked lists in C", subjectName: "Programming" },
  ],
  sidecar: "Programming/attachments/main.c.resit.json",
};

export type SaveState =
  "saved" | "saving" | "unsaved" | "error" | "read-only" | "conflict";

export const saveStates: Record<SaveState, { label: string; detail: string }> =
  {
    saved: { label: "Saved", detail: "All changes saved at 21:05" },
    saving: { label: "Saving…", detail: "Writing Resolution — Worksheet 3.md" },
    unsaved: {
      label: "Unsaved changes",
      detail: "Draft kept on disk. Last save 21:05",
    },
    error: {
      label: "Not saved",
      detail: "Disk is full. Your draft is kept in the recovery folder.",
    },
    "read-only": {
      label: "Read-only",
      detail: "Another resit window owns this workspace",
    },
    conflict: {
      label: "Conflict",
      detail: "Changed on disk while you were editing",
    },
  };

export const conflict = {
  resourceTitle: "Resolution — Worksheet 3",
  path: "Mathematics/notes/Resolution — Worksheet 3.md",
  mine: {
    label: "Your version",
    savedAt: "2026-09-16T21:05:00Z",
    text: `## Exercise 2 (b)

$$|(3x - 1) - 5| = |3x - 6| = |3(x - 2)| = 3|x - 2|$$

The last equality uses $|ab| = |a|\\,|b|$.

So choosing $\\delta = \\varepsilon / 3$ gives $3|x - 2| < \\varepsilon$.`,
  },
  theirs: {
    label: "On disk",
    savedAt: "2026-09-16T21:07:00Z",
    text: `## Exercise 2 (b)

$$|(3x - 1) - 5| = |3x - 6| = 3|x - 2|$$

So choosing δ = ε/3 works. (edited in VS Code)

TODO: check exercise 3.`,
  },
};

export interface HistoryRevisionFixture {
  id: string;
  revision: number;
  at: string;
  cause: "manual save" | "autosave" | "ai edit" | "restore" | "import";
  summary: string;
  sizeBytes: number;
  current?: boolean;
}

export const history: HistoryRevisionFixture[] = [
  {
    id: "rev_9",
    revision: 9,
    at: "2026-09-16T21:05:00Z",
    cause: "manual save",
    summary: "Added factoring step to Exercise 2 (b)",
    sizeBytes: 2_140,
    current: true,
  },
  {
    id: "rev_8",
    revision: 8,
    at: "2026-09-16T20:58:30Z",
    cause: "ai edit",
    summary: "Accepted edit from conversation “I do not understand this step”",
    sizeBytes: 2_098,
  },
  {
    id: "rev_7",
    revision: 7,
    at: "2026-09-16T20:12:00Z",
    cause: "autosave",
    summary: "Exercise 3 draft",
    sizeBytes: 1_402,
  },
  {
    id: "rev_6",
    revision: 6,
    at: "2026-09-14T09:50:00Z",
    cause: "restore",
    summary: "Restored from revision 4",
    sizeBytes: 1_210,
  },
  {
    id: "rev_5",
    revision: 5,
    at: "2026-09-14T09:41:00Z",
    cause: "manual save",
    summary: "Deleted section by mistake",
    sizeBytes: 380,
  },
  {
    id: "rev_4",
    revision: 4,
    at: "2026-09-13T22:30:00Z",
    cause: "manual save",
    summary: "Exercise 2 complete",
    sizeBytes: 1_210,
  },
  {
    id: "rev_1",
    revision: 1,
    at: "2026-09-12T14:25:00Z",
    cause: "import",
    summary: "Created from Worksheet 3",
    sizeBytes: 96,
  },
];

export interface TrashItemFixture {
  id: string;
  title: string;
  kind: "note" | "pdf" | "image" | "attachment" | "subject";
  subjectName: string | null;
  deletedAt: string;
  originalPath: string;
  ownedCount?: number;
}

export const trash: TrashItemFixture[] = [
  {
    id: "tr_1",
    title: "Scratch — attempt 1",
    kind: "note",
    subjectName: "Mathematics",
    deletedAt: "2026-09-16T19:00:00Z",
    originalPath: "Mathematics/notes/Scratch — attempt 1.md",
  },
  {
    id: "tr_2",
    title: "IMG_2048.jpeg",
    kind: "image",
    subjectName: "Physics",
    deletedAt: "2026-09-15T12:10:00Z",
    originalPath: "Physics/attachments/IMG_2048.jpeg",
  },
  {
    id: "tr_3",
    title: "Química Geral",
    kind: "subject",
    subjectName: null,
    deletedAt: "2026-09-10T08:00:00Z",
    originalPath: "Química Geral/",
    ownedCount: 14,
  },
];

export const exportOptions = {
  formats: [
    {
      id: "resit",
      label: ".resit archive",
      description:
        "Everything: notes, PDFs, annotations, references, study records, and visible chats. Opens on another computer.",
      recommended: true,
    },
    {
      id: "markdown",
      label: "Markdown folder",
      description:
        "Notes as .md files with attachments beside them. No study records.",
    },
    {
      id: "pdf",
      label: "PDF",
      description: "One PDF of the selected notes with rendered math.",
    },
    {
      id: "anki",
      label: "Flashcards (.apkg)",
      description: "Flashcards for Anki. Sources become plain text links.",
    },
  ],
  scopes: [
    {
      id: "workspace",
      label: "Whole workspace",
      count: "5 subjects · 13 resources",
    },
    { id: "subject", label: "Mathematics", count: "4 resources" },
    { id: "selection", label: "Selected notes", count: "2 notes" },
  ],
  estimateBytes: 12_400_000,
};

export interface ErrorPanelFixture {
  id: string;
  title: string;
  detail: string;
  cause?: string;
  actions: { label: string; primary?: boolean }[];
}

export const errorPanels: Record<
  | "disk-full"
  | "source-replaced"
  | "broken-reference"
  | "permission"
  | "future-format",
  ErrorPanelFixture
> = {
  "disk-full": {
    id: "err_disk",
    title: "Could not save Resolution — Worksheet 3",
    detail:
      "The disk is full. The previous saved version is untouched and your draft is kept in the recovery folder.",
    cause:
      "ENOSPC while writing Mathematics/notes/Resolution — Worksheet 3.md.tmp",
    actions: [
      { label: "Retry", primary: true },
      { label: "Show recovery folder" },
    ],
  },
  "source-replaced": {
    id: "err_replaced",
    title: "Worksheet 3 was replaced outside resit",
    detail:
      "The PDF on disk has a different hash from the one your 4 annotations were made on. Annotations stay attached to the previous revision until you choose.",
    actions: [
      { label: "Keep annotations on the old revision", primary: true },
      { label: "Re-anchor to the new file" },
      { label: "Show both" },
    ],
  },
  "broken-reference": {
    id: "err_broken",
    title: "Linked resource not found",
    detail:
      "Chapter 4 – Newton's laws of motion is referenced by this note but its file is missing from Physics/documents.",
    actions: [
      { label: "Locate file…", primary: true },
      { label: "Remove link" },
    ],
  },
  permission: {
    id: "err_perm",
    title: "This workspace is read-only",
    detail:
      "Another resit window has it open for writing. You can read everything; edits will not be saved.",
    actions: [
      { label: "Focus the other window", primary: true },
      { label: "Open read-only" },
    ],
  },
  "future-format": {
    id: "err_future",
    title: "Workspace was saved by a newer resit",
    detail:
      "Format version 3 is newer than this app understands (2). Opening read-only to avoid rewriting files.",
    actions: [
      { label: "Open read-only", primary: true },
      { label: "Check for updates" },
    ],
  },
};
