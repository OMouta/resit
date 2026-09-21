import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

import { exportMarkdown } from "../../apps/desktop/src/main/workspace/markdown-export";
import {
  createFolder,
  createNote,
  createSubject,
  createWorkspace,
  importFile,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import { samplePdf } from "../tools/sample-pdf.mjs";

let directory: string;
let workspace: OpenWorkspace;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-markdown-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Análise", color: "blue" },
  });
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

it("writes a subject's notes as Markdown with working links", async () => {
  const subjectId = snapshot(workspace).subjects[0]!.id;
  const physics = await createSubject(workspace, {
    name: "Physics",
    color: "red",
  });
  const elsewhere = await createNote(workspace, {
    subjectId: physics.id,
    title: "Forces",
  });
  const source = join(directory, "Ficha 1.pdf");
  await writeFile(source, samplePdf([{ title: "Limits", lines: ["sin x"] }]));
  const pdf = await importFile(workspace, { subjectId, sourcePath: source });
  await createFolder(workspace, { subjectId, name: "Fichas" });
  const worked = await createNote(workspace, {
    subjectId,
    title: "Resolução 1",
    folder: "Fichas",
    body: "Back to [the summary](resit://resource/SUMMARY).\n",
  });
  const summary = await createNote(workspace, {
    subjectId,
    title: "Limites",
    body: [
      `See [the worked example](resit://resource/${worked.id}).`,
      `> Compute sin(x)/x.`,
      `> — [Ficha 1, p. 3](resit://resource/${pdf.id}?page=3&annotation=a1)`,
      `Compare [forces](resit://resource/${elsewhere.id}).`,
      "",
    ].join("\n"),
  });
  // The worked example links back once the summary's ID is known.
  const workedPath = join(workspace.root, worked.path);
  await writeFile(
    workedPath,
    (await readFile(workedPath, "utf8")).replace("SUMMARY", summary.id),
  );

  const result = await exportMarkdown(workspace, {
    notes: snapshot(workspace).resources.filter(
      (resource) => resource.subjectId === subjectId,
    ),
    parent: join(directory, "out"),
    name: "Análise",
  });
  expect(result).toEqual({
    folder: join(directory, "out", "Análise"),
    notes: 2,
    files: 1,
    unresolved: 1,
  });
  expect((await readdir(result.folder)).sort()).toEqual([
    "Fichas",
    "Limites.md",
    "files",
  ]);
  const written = await readFile(join(result.folder, "Limites.md"), "utf8");
  expect(written).not.toMatch(/^---/);
  expect(written).toContain("(Fichas/Resolu%C3%A7%C3%A3o%201.md)");
  expect(written).toContain("(files/Ficha%201.pdf#page=3)");
  expect(written).toContain(`(resit://resource/${elsewhere.id})`);
  expect(
    await readFile(join(result.folder, "Fichas", "Resolução 1.md"), "utf8"),
  ).toContain("(../Limites.md)");
  expect(await readFile(join(result.folder, "files", "Ficha 1.pdf"))).toEqual(
    await readFile(join(workspace.root, pdf.path)),
  );

  // Exporting again goes beside the first export.
  const again = await exportMarkdown(workspace, {
    notes: [summary],
    parent: join(directory, "out"),
    name: "Análise",
  });
  expect(again.folder).toBe(join(directory, "out", "Análise 2"));
});
