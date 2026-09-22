/** One output of a code cell, in the forms resit shows. */
export type NotebookOutput =
  | { type: "text"; text: string }
  | { type: "image"; mime: string; data: string }
  | { type: "error"; text: string };

export interface NotebookCell {
  kind: "markdown" | "code" | "raw";
  source: string;
  outputs: NotebookOutput[];
}

export interface Notebook {
  /** The kernel's language, such as `python`. */
  language: string;
  cells: NotebookCell[];
}

/** Notebook text comes as one string or as a list of lines. */
function joined(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.filter((part) => typeof part === "string").join("");
  return "";
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];

/** Tracebacks carry terminal colour codes. */
// eslint-disable-next-line no-control-regex
const TERMINAL_COLOURS = /\u001b\[[\d;]*m/g;

function outputsOf(value: unknown): NotebookOutput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((output): NotebookOutput[] => {
    if (!output || typeof output !== "object") return [];
    const entry = output as Record<string, unknown>;
    if (entry.output_type === "stream")
      return [{ type: "text", text: joined(entry.text) }];
    if (entry.output_type === "error")
      return [
        {
          type: "error",
          text: joined(
            Array.isArray(entry.traceback)
              ? entry.traceback.join("\n")
              : `${String(entry.ename)}: ${String(entry.evalue)}`,
          ).replace(TERMINAL_COLOURS, ""),
        },
      ];
    const data = entry.data as Record<string, unknown> | undefined;
    if (!data) return [];
    const image = IMAGE_TYPES.find((mime) => typeof data[mime] === "string");
    if (image)
      return [
        {
          type: "image",
          mime: image,
          data: String(data[image]).replace(/\s/g, ""),
        },
      ];
    const text = joined(data["text/plain"]);
    return text ? [{ type: "text", text }] : [];
  });
}

/** A Jupyter notebook's cells, or null when the file is not one. */
export function parseNotebook(json: string): Notebook | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const notebook = raw as Record<string, unknown>;
  if (!Array.isArray(notebook.cells)) return null;
  const metadata = notebook.metadata as Record<string, unknown> | undefined;
  const info = metadata?.language_info as Record<string, unknown> | undefined;
  return {
    language: typeof info?.name === "string" ? info.name : "python",
    cells: notebook.cells.flatMap((cell): NotebookCell[] => {
      if (!cell || typeof cell !== "object") return [];
      const entry = cell as Record<string, unknown>;
      const kind =
        entry.cell_type === "markdown" || entry.cell_type === "code"
          ? entry.cell_type
          : "raw";
      return [
        {
          kind,
          source: joined(entry.source),
          outputs: kind === "code" ? outputsOf(entry.outputs) : [],
        },
      ];
    }),
  };
}

/** The notebook's words, for search and the assistant: cells and text output. */
export function notebookText(notebook: Notebook): string {
  return notebook.cells
    .map((cell) =>
      [
        cell.source,
        ...cell.outputs.flatMap((output) =>
          output.type === "image" ? [] : [output.text],
        ),
      ].join("\n"),
    )
    .join("\n\n");
}
