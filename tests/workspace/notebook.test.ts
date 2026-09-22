import { describe, expect, it } from "vitest";

import {
  notebookText,
  parseNotebook,
} from "../../apps/desktop/src/shared/notebook";

const notebook = JSON.stringify({
  metadata: { language_info: { name: "python" } },
  cells: [
    {
      cell_type: "markdown",
      source: ["# Newton's method\n", "Find $\\sqrt 2$."],
    },
    {
      cell_type: "code",
      source: "print(newton(2))",
      outputs: [
        { output_type: "stream", text: ["1.41421356\n"] },
        { output_type: "display_data", data: { "image/png": "iVBOR\nw0=" } },
        {
          output_type: "error",
          ename: "ValueError",
          evalue: "did not converge",
          traceback: ["\u001b[31mValueError\u001b[0m: did not converge"],
        },
      ],
    },
  ],
});

describe("Jupyter notebooks", () => {
  it("reads cells and the outputs resit shows", () => {
    expect(parseNotebook(notebook)).toEqual({
      language: "python",
      cells: [
        {
          kind: "markdown",
          source: "# Newton's method\nFind $\\sqrt 2$.",
          outputs: [],
        },
        {
          kind: "code",
          source: "print(newton(2))",
          outputs: [
            { type: "text", text: "1.41421356\n" },
            { type: "image", mime: "image/png", data: "iVBORw0=" },
            { type: "error", text: "ValueError: did not converge" },
          ],
        },
      ],
    });
  });

  it("gives search the cells and text outputs, not images", () => {
    const text = notebookText(parseNotebook(notebook)!);
    expect(text).toContain("Newton's method");
    expect(text).toContain("1.41421356");
    expect(text).not.toContain("iVBOR");
  });

  it("refuses JSON that is not a notebook", () => {
    expect(parseNotebook('{"cells": 3}')).toBeNull();
    expect(parseNotebook("not json")).toBeNull();
  });
});
