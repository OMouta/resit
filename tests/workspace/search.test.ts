import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeSearchIndex,
  searchWorkspace,
} from "../../apps/desktop/src/main/workspace/search";
import {
  createNote,
  createWorkspace,
  deleteResource,
  importFile,
  openWorkspace,
  readNote,
  saveNote,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import { samplePdf } from "../tools/sample-pdf.mjs";

let directory: string;
let workspace: OpenWorkspace;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-search-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
});

afterEach(async () => {
  closeSearchIndex(workspace);
  await rm(directory, { recursive: true, force: true });
});

const subjectId = () => snapshot(workspace).subjects[0]!.id;
const everything = { allow: () => true, limit: 20 };

async function writeNote(title: string, body: string) {
  const note = await createNote(workspace, { subjectId: subjectId(), title });
  await saveNote(workspace, {
    id: note.id,
    body,
    expectedRevision: (await readNote(workspace, note.id)).revision,
  });
  return note;
}

describe("search index", () => {
  it("finds note text and PDF pages, ignoring accents and case", async () => {
    await writeNote("Limits", "A função é contínua em todo o domínio.\n");
    const source = join(directory, "Worksheet.pdf");
    await writeFile(
      source,
      samplePdf([
        { title: "Limits", lines: ["Compute the limit."] },
        { title: "Continuity", lines: ["Where is 1/(x - 2) continuous?"] },
      ]),
    );
    await importFile(workspace, { subjectId: subjectId(), sourcePath: source });

    const notes = await searchWorkspace(
      workspace,
      "FUNCAO continua",
      everything,
    );
    expect(notes).toMatchObject([
      {
        title: "Limits",
        kind: "note",
        snippet: expect.stringContaining("função"),
      },
    ]);
    const pages = await searchWorkspace(workspace, "continuous", everything);
    expect(pages).toMatchObject([{ kind: "pdf", page: 2 }]);
    // Words match from their start.
    expect(await searchWorkspace(workspace, "contin", everything)).toHaveLength(
      2,
    );
    expect(await readdir(join(workspace.root, ".resit", "cache"))).toContain(
      "index.sqlite",
    );
  });

  it("finds words in imported text and code files", async () => {
    const source = join(directory, "newton.py");
    await writeFile(source, "def newton(f, df, x0):\n    # Método de Newton\n");
    await importFile(workspace, { subjectId: subjectId(), sourcePath: source });
    const hits = await searchWorkspace(workspace, "metodo newton", everything);
    expect(hits.map((hit) => [hit.title, hit.kind])).toEqual([
      ["newton", "attachment"],
    ]);
  });

  it("follows changed and deleted notes", async () => {
    const note = await writeNote("Series", "Geometric series converge.\n");
    expect(
      await searchWorkspace(workspace, "geometric", everything),
    ).toHaveLength(1);
    await saveNote(workspace, {
      id: note.id,
      body: "Telescoping sums.\n",
      expectedRevision: (await readNote(workspace, note.id)).revision,
    });
    expect(await searchWorkspace(workspace, "geometric", everything)).toEqual(
      [],
    );
    expect(
      await searchWorkspace(workspace, "telescoping", everything),
    ).toHaveLength(1);
    await deleteResource(workspace, note.id);
    expect(await searchWorkspace(workspace, "telescoping", everything)).toEqual(
      [],
    );
  });

  it("keeps its text between sessions and rebuilds when the cache goes", async () => {
    await writeNote("Integrals", "Integration by parts.\n");
    expect(await searchWorkspace(workspace, "parts", everything)).toHaveLength(
      1,
    );
    closeSearchIndex(workspace);

    workspace = await openWorkspace(workspace.root);
    expect(await searchWorkspace(workspace, "parts", everything)).toHaveLength(
      1,
    );
    closeSearchIndex(workspace);

    await rm(join(workspace.root, ".resit", "cache"), { recursive: true });
    expect(await searchWorkspace(workspace, "parts", everything)).toHaveLength(
      1,
    );
  });

  it("never returns text from files outside the allowed set", async () => {
    await writeNote("Allowed", "Shared word.\n");
    const hidden = await writeNote("Hidden", "Shared word.\n");
    const hits = await searchWorkspace(workspace, "shared", {
      allow: (resource) => resource.id !== hidden.id,
      limit: 20,
    });
    expect(hits.map((hit) => hit.title)).toEqual(["Allowed"]);
  });

  it("treats punctuation in a query as text", async () => {
    await writeNote("Quotes", 'He said "limit" twice.\n');
    expect(await searchWorkspace(workspace, '"limit', everything)).toHaveLength(
      1,
    );
    expect(await searchWorkspace(workspace, "*", everything)).toEqual([]);
  });
});
