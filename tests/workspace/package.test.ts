import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yauzl from "yauzl";
import yazl from "yazl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  exportPackage,
  extractPackage,
  readPackage,
  type PackageOptions,
} from "../../apps/desktop/src/main/workspace/package";
import {
  createNote,
  createWorkspace,
  deleteResource,
  importFile,
  openWorkspace,
  readNote,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";
import { samplePdf } from "../tools/sample-pdf.mjs";

let directory: string;
let workspace: OpenWorkspace;

const everything: PackageOptions = {
  conversations: true,
  learner: true,
  history: false,
  trash: false,
};
const quietly = {
  onProgress: () => undefined,
  signal: new AbortController().signal,
};

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-package-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies 2026/27",
    subject: { name: "Análise", color: "blue" },
  });
  const subjectId = snapshot(workspace).subjects[0]!.id;
  await createNote(workspace, {
    subjectId,
    title: "Limites",
    body: "Um limite descreve…\n",
  });
  const source = join(directory, "Ficha 1.pdf");
  await writeFile(source, samplePdf([{ title: "Limits", lines: ["sin x"] }]));
  await importFile(workspace, { subjectId, sourcePath: source });
  const trashed = await createNote(workspace, { subjectId, title: "Old" });
  await deleteResource(workspace, trashed.id);

  const root = workspace.root;
  await mkdir(join(root, "conversations", "c1"), { recursive: true });
  await writeFile(join(root, "conversations", "c1", "conversation.json"), "{}");
  await writeFile(join(root, "learner.json"), "{}");
  for (const machine of ["cache", "state", "drafts"])
    await mkdir(join(root, ".resit", machine), { recursive: true });
  await writeFile(join(root, ".resit", "cache", "index.sqlite"), "cache");
  await writeFile(join(root, ".resit", "state", "layout.json"), "{}");
  await writeFile(join(root, ".resit", "drafts", "x.json"), "{}");
  await writeFile(join(root, ".resit", "lock.json"), "{}");
  await mkdir(join(root, ".resit", "history", "notes", "n"), {
    recursive: true,
  });
  await writeFile(join(root, ".resit", "history", "notes", "n", "a.md"), "a");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function entryNames(path: string): Promise<string[]> {
  const zip = await yauzl.openPromise(path, { lazyEntries: true });
  const names: string[] = [];
  await new Promise<void>((resolve, reject) => {
    zip.on("entry", (entry: yauzl.Entry) => {
      names.push(entry.fileName);
      zip.readEntry();
    });
    zip.on("end", resolve);
    zip.on("error", reject);
    zip.readEntry();
  });
  zip.close();
  return names.sort();
}

async function writeArchive(
  path: string,
  entries: { name: string; data: string; link?: boolean }[],
  manifest?: object,
): Promise<void> {
  const zip = new yazl.ZipFile();
  const files = entries
    .filter((entry) => entry.name.startsWith("workspace/"))
    .map((entry) => ({
      path: entry.name.slice("workspace/".length),
      size: Buffer.byteLength(entry.data),
      sha256: createHash("sha256").update(entry.data).digest("hex"),
    }));
  // yazl will not write a name like "../evil.md", so each entry gets a
  // placeholder of the same length that is swapped in the bytes afterwards.
  const swaps = entries.map((entry, index) => {
    const raw = Buffer.from(entry.name);
    const placeholder = Buffer.from(
      `z${index}`.padEnd(raw.length, "q").slice(0, raw.length),
    );
    zip.addBuffer(Buffer.from(entry.data), placeholder.toString(), {
      ...(entry.link ? { mode: 0o120777 } : {}),
    });
    return { placeholder, raw };
  });
  zip.addBuffer(
    Buffer.from(
      JSON.stringify(
        manifest ?? {
          format: "resit-package",
          formatVersion: 1,
          exportedAt: new Date().toISOString(),
          workspaceId: "w",
          workspaceName: "Evil",
          files,
        },
      ),
    ),
    "manifest.json",
  );
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk as Buffer);
  const bytes = Buffer.concat(chunks);
  for (const { placeholder, raw } of swaps)
    for (
      let at = bytes.indexOf(placeholder);
      at !== -1;
      at = bytes.indexOf(placeholder, at + 1)
    )
      raw.copy(bytes, at);
  await writeFile(path, bytes);
}

const workspaceJson = JSON.stringify({
  format: "resit-workspace",
  formatVersion: 1,
  id: "w",
  name: "Evil",
  createdAt: "2026-09-21T10:00:00.000Z",
  updatedAt: "2026-09-21T10:00:00.000Z",
});

describe("resit packages", () => {
  it("packs the workspace's own files and leaves this computer's out", async () => {
    const path = join(directory, "Studies.resit");
    const result = await exportPackage(workspace, {
      destination: path,
      options: everything,
      ...quietly,
    });
    const names = await entryNames(path);
    expect(names).toContain("manifest.json");
    expect(names).toContain("workspace/workspace.json");
    expect(names).toContain("workspace/learner.json");
    expect(names).toContain("workspace/conversations/c1/conversation.json");
    expect(names).toContain(
      "workspace/subjects/análise/documents/ficha-1.pdf.resource.json",
    );
    expect(names.filter((name) => name.includes(".resit/"))).toEqual([]);
    expect(result.files).toBe(names.length - 1);
    expect(await readdir(directory)).not.toContainEqual(
      expect.stringMatching(/\.tmp$/),
    );

    const summary = await readPackage(path);
    expect(summary).toMatchObject({
      workspaceName: "Studies 2026/27",
      files: result.files,
    });
  });

  it("leaves out private records and takes history and trash when asked", async () => {
    const path = join(directory, "Studies.resit");
    await exportPackage(workspace, {
      destination: path,
      options: {
        conversations: false,
        learner: false,
        history: true,
        trash: true,
      },
      ...quietly,
    });
    const names = await entryNames(path);
    expect(
      names.some((name) => name.startsWith("workspace/conversations/")),
    ).toBe(false);
    expect(names).not.toContain("workspace/learner.json");
    expect(names).toContain("workspace/.resit/history/notes/n/a.md");
    expect(
      names.some((name) => name.startsWith("workspace/.resit/trash/")),
    ).toBe(true);
    expect(names).not.toContain("workspace/.resit/lock.json");
  });

  it("opens a package as a new workspace with the same files", async () => {
    const path = join(directory, "Studies.resit");
    await exportPackage(workspace, {
      destination: path,
      options: everything,
      ...quietly,
    });
    const elsewhere = join(directory, "Other computer");
    const root = await extractPackage(path, elsewhere, quietly);
    expect(root).toBe(join(elsewhere, "Studies 2026 27"));
    const copy = await openWorkspace(root);
    expect(copy.file.id).not.toBe(workspace.file.id);
    expect(copy.file.name).toBe("Studies 2026/27");
    const note = snapshot(copy).resources.find(
      (resource) => resource.title === "Limites",
    );
    expect((await readNote(copy, note!.id)).body).toBe("Um limite descreve…\n");
    expect(
      await readFile(
        join(root, "subjects", "análise", "documents", "ficha-1.pdf"),
      ),
    ).toEqual(
      await readFile(
        join(workspace.root, "subjects", "análise", "documents", "ficha-1.pdf"),
      ),
    );

    // Opening it again makes a second copy beside the first.
    expect(await extractPackage(path, elsewhere, quietly)).toBe(
      join(elsewhere, "Studies 2026 27 2"),
    );
  });

  const refusals: [string, { name: string; data: string; link?: boolean }[]][] =
    [
      [
        "a path out of the folder",
        [{ name: "workspace/../evil.md", data: "x" }],
      ],
      ["a Windows path", [{ name: "workspace/a\\..\\evil.md", data: "x" }]],
      ["a drive letter", [{ name: "workspace/C:/evil.md", data: "x" }]],
      [
        "a link",
        [{ name: "workspace/link.md", data: "/etc/passwd", link: true }],
      ],
      [
        "names that differ only in case",
        [
          { name: "workspace/Note.md", data: "a" },
          { name: "workspace/note.md", data: "b" },
        ],
      ],
      ["an entry outside workspace/", [{ name: "evil.md", data: "x" }]],
    ];

  for (const [what, entries] of refusals)
    it(`refuses ${what} and writes nothing`, async () => {
      const path = join(directory, "evil.resit");
      await writeArchive(path, [
        { name: "workspace/workspace.json", data: workspaceJson },
        ...entries,
      ]);
      const target = join(directory, "target");
      await expect(extractPackage(path, target, quietly)).rejects.toThrow();
      expect(await readdir(target).catch(() => [])).toEqual([]);
      expect(await readdir(directory)).not.toContain("evil.md");
    });

  it("refuses a file whose contents do not match the manifest", async () => {
    const path = join(directory, "evil.resit");
    const good = createHash("sha256").update("original").digest("hex");
    await writeArchive(
      path,
      [
        { name: "workspace/workspace.json", data: workspaceJson },
        { name: "workspace/note.md", data: "tampered" },
      ],
      {
        format: "resit-package",
        formatVersion: 1,
        exportedAt: "2026-09-21T10:00:00.000Z",
        workspaceId: "w",
        workspaceName: "Evil",
        files: [
          {
            path: "workspace.json",
            size: Buffer.byteLength(workspaceJson),
            sha256: createHash("sha256").update(workspaceJson).digest("hex"),
          },
          { path: "note.md", size: 8, sha256: good },
        ],
      },
    );
    const target = join(directory, "target");
    await expect(extractPackage(path, target, quietly)).rejects.toThrow(
      /damaged/,
    );
    expect(await readdir(target)).toEqual([]);
  });

  it("refuses files the manifest does not list, and newer formats", async () => {
    const path = join(directory, "evil.resit");
    await writeArchive(
      path,
      [{ name: "workspace/workspace.json", data: workspaceJson }],
      {
        format: "resit-package",
        formatVersion: 1,
        exportedAt: "2026-09-21T10:00:00.000Z",
        workspaceId: "w",
        workspaceName: "Evil",
        files: [],
      },
    );
    await expect(readPackage(path)).rejects.toThrow(/does not match/);

    await writeArchive(
      path,
      [{ name: "workspace/workspace.json", data: workspaceJson }],
      { format: "resit-package", formatVersion: 99 },
    );
    await expect(readPackage(path)).rejects.toThrow(/newer version/);

    await writeFile(path, "not a zip");
    await expect(readPackage(path)).rejects.toThrow(/not a resit file/);
  });

  it("stops an export without leaving a file behind", async () => {
    const path = join(directory, "Studies.resit");
    const controller = new AbortController();
    controller.abort(new Error("Stopped."));
    await expect(
      exportPackage(workspace, {
        destination: path,
        options: everything,
        onProgress: () => undefined,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(
      (await readdir(directory)).filter((name) => name.includes(".resit")),
    ).toEqual([]);
  });
});
