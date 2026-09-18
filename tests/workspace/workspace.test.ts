import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createNote,
  createWorkspace,
  deleteResource,
  importFile,
  openWorkspace,
  readNote,
  renameResource,
  saveNote,
  scanWorkspace,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

let directory: string;
let workspace: OpenWorkspace;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-workspace-"));
  workspace = await createWorkspace({
    folder: join(directory, "ISEP"),
    name: "ISEP 2026/27",
    subject: { name: "Mathematics", color: "blue" },
  });
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function mathematics() {
  const subject = snapshot(workspace).subjects[0];
  if (!subject) throw new Error("Missing subject");
  return subject;
}

describe("workspace files", () => {
  it("keeps the workspace ID and subjects when reopened", async () => {
    const reopened = await openWorkspace(workspace.root);
    expect(reopened.file.id).toBe(workspace.file.id);
    expect(snapshot(reopened).subjects.map((subject) => subject.name)).toEqual([
      "Mathematics",
    ]);
  });

  it("refuses to create a workspace over an existing one", async () => {
    await expect(
      createWorkspace({
        folder: workspace.root,
        name: "Again",
        subject: { name: "Physics", color: "red" },
      }),
    ).rejects.toThrow(/already contains a workspace/);
  });

  it("refuses workspaces written by a newer format", async () => {
    const manifest = join(workspace.root, "workspace.json");
    const data = JSON.parse(await readFile(manifest, "utf8"));
    await writeFile(manifest, JSON.stringify({ ...data, formatVersion: 99 }));
    await expect(openWorkspace(workspace.root)).rejects.toThrow(
      /newer version/,
    );
  });

  it("saves only when the file still has the revision the editor loaded", async () => {
    const note = await createNote(workspace, {
      subjectId: mathematics().id,
      title: "Limits",
    });
    const loaded = await readNote(workspace, note.id);
    const first = await saveNote(workspace, {
      id: note.id,
      body: "$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$\n",
      expectedRevision: loaded.revision,
    });
    expect(first.status).toBe("saved");

    const stale = await saveNote(workspace, {
      id: note.id,
      body: "Overwritten",
      expectedRevision: loaded.revision,
    });
    expect(stale.status).toBe("conflict");
    expect((await readNote(workspace, note.id)).body).toContain("\\lim");
  });

  it("keeps unknown frontmatter fields when saving", async () => {
    const note = await createNote(workspace, {
      subjectId: mathematics().id,
      title: "Derivatives",
    });
    const path = join(workspace.root, note.path);
    const text = await readFile(path, "utf8");
    await writeFile(path, text.replace("title:", "course: MATE1\ntitle:"));
    const loaded = await readNote(workspace, note.id);
    await saveNote(workspace, {
      id: note.id,
      body: "Rules.\n",
      expectedRevision: loaded.revision,
    });
    const saved = await readFile(path, "utf8");
    expect(saved).toContain("course: MATE1");
    expect(saved).toContain(`id: ${note.id}`);
    expect(saved.endsWith("Rules.\n")).toBe(true);
  });

  it("keeps a note's ID when its title and file name change", async () => {
    const note = await createNote(workspace, {
      subjectId: mathematics().id,
      title: "Draft",
    });
    const renamed = await renameResource(workspace, {
      id: note.id,
      title: "Séries de Taylor",
    });
    expect(renamed.id).toBe(note.id);
    expect(renamed.path.endsWith("séries-de-taylor.md")).toBe(true);
    await scanWorkspace(workspace);
    expect(workspace.resources.get(note.id)?.info.title).toBe(
      "Séries de Taylor",
    );
  });

  it("moves deleted notes to the trash instead of removing them", async () => {
    const note = await createNote(workspace, {
      subjectId: mathematics().id,
      title: "Old",
    });
    await deleteResource(workspace, note.id);
    await scanWorkspace(workspace);
    expect(workspace.resources.has(note.id)).toBe(false);
    const trash = await readdir(join(workspace.root, ".resit", "trash"));
    expect(trash).toHaveLength(1);
    const files = await readdir(
      join(workspace.root, ".resit", "trash", trash[0]!),
    );
    expect(files.sort()).toEqual(["old.md", "trash.json"]);
  });

  it("adopts notes and files added outside the app", async () => {
    const subjectDir = join(workspace.root, "subjects", "mathematics");
    await writeFile(join(subjectDir, "loose.md"), "# Loose note\n\nText.\n");
    await writeFile(join(subjectDir, "sheet.pdf"), "%PDF-1.4\n");
    await scanWorkspace(workspace);
    const resources = snapshot(workspace).resources;
    expect(
      resources.map((resource) => [resource.kind, resource.title]),
    ).toEqual([
      ["note", "Loose note"],
      ["pdf", "sheet"],
    ]);
    expect(await readFile(join(subjectDir, "loose.md"), "utf8")).toMatch(
      /^---\nid: /,
    );
    const before = resources.map((resource) => resource.id);
    await scanWorkspace(workspace);
    expect(
      snapshot(workspace).resources.map((resource) => resource.id),
    ).toEqual(before);
  });

  it("reports duplicate IDs instead of picking one silently", async () => {
    const note = await createNote(workspace, {
      subjectId: mathematics().id,
      title: "Original",
    });
    const text = await readFile(join(workspace.root, note.path), "utf8");
    await writeFile(
      join(workspace.root, "subjects", "mathematics", "notes", "copy.md"),
      text,
    );
    await scanWorkspace(workspace);
    expect(workspace.issues).toEqual([
      expect.objectContaining({ kind: "duplicate-id" }),
    ]);
  });

  it("copies imported files and leaves the original in place", async () => {
    const source = join(directory, "Worksheet 1.pdf");
    await writeFile(source, "%PDF-1.4\n");
    const resource = await importFile(workspace, {
      subjectId: mathematics().id,
      sourcePath: source,
    });
    expect(resource.kind).toBe("pdf");
    expect(resource.path).toBe(
      "subjects/mathematics/documents/worksheet-1.pdf",
    );
    expect(await readFile(source, "utf8")).toBe("%PDF-1.4\n");
    const sidecar = JSON.parse(
      await readFile(
        join(workspace.root, `${resource.path}.resource.json`),
        "utf8",
      ),
    );
    expect(sidecar).toMatchObject({
      id: resource.id,
      type: "pdf",
      originalFilename: "Worksheet 1.pdf",
    });
  });
});
