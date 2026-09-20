import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  subjectNameFromCourse,
  type MoodleLink,
} from "../../apps/desktop/src/shared/moodle";
import {
  useNetworkFetch,
  type NetworkFetch,
} from "../../apps/desktop/src/main/moodle/client";
import {
  downloadItems,
  listItems,
  planCourse,
} from "../../apps/desktop/src/main/moodle/sync";
import {
  createWorkspace,
  linkSubject,
  openWorkspace,
  scanWorkspace,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

const SITE = "https://moodle.example.edu";
const session = { siteUrl: SITE, token: "secret-token" };
const link: MoodleLink = {
  siteUrl: SITE,
  courseId: 7,
  shortname: "MAT1",
  fullname: "Análise Matemática I",
};

function fileUrl(name: string): string {
  return `${SITE}/webservice/pluginfile.php/9/mod_resource/content/0/${name}`;
}

function file(name: string, extra: Record<string, unknown> = {}) {
  return {
    type: "file",
    filename: name,
    filepath: "/",
    filesize: 10,
    fileurl: fileUrl(name),
    timemodified: 1700000000,
    mimetype: "application/pdf",
    ...extra,
  };
}

/** Two sections: loose course material, then a week with a folder activity. */
function contents() {
  return [
    {
      id: 1,
      name: "General",
      section: 0,
      modules: [
        {
          id: 100,
          name: "Course outline",
          modname: "resource",
          contents: [file("outline.pdf")],
        },
        {
          id: 101,
          name: "Announcements",
          modname: "forum",
          contents: [file("notice.txt")],
        },
      ],
    },
    {
      id: 2,
      name: "Week 1 — Limits",
      section: 1,
      modules: [
        {
          id: 102,
          name: "Lecture slides",
          modname: "resource",
          contents: [file("lecture-01.pdf")],
        },
        {
          id: 103,
          name: "Exercises",
          modname: "folder",
          contents: [file("sheet-a.pdf"), file("sheet-b.pdf")],
        },
        {
          id: 104,
          name: "Recording",
          modname: "resource",
          contents: [file("class.mp4", { isexternalfile: true })],
        },
        {
          id: 105,
          name: "Hidden notes",
          modname: "resource",
          uservisible: false,
          contents: [file("hidden.pdf")],
        },
      ],
    },
  ];
}

let directory: string;
let workspace: OpenWorkspace;
let subjectId: string;
let downloads: string[];

/** Serves the course JSON, and file bytes naming the file and the revision. */
function serve(course: unknown = contents(), revision = "v1"): void {
  const fake: NetworkFetch = (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/server.php"))
      return Promise.resolve(
        new Response(JSON.stringify(course), {
          headers: { "content-type": "application/json" },
        }),
      );
    const name = parsed.pathname.split("/").at(-1) ?? "";
    downloads.push(name);
    return Promise.resolve(
      new Response(new Uint8Array(Buffer.from(`${name} ${revision}`)), {
        headers: { "content-type": "application/pdf" },
      }),
    );
  };
  useNetworkFetch(fake);
}

beforeEach(async () => {
  downloads = [];
  directory = await mkdtemp(join(tmpdir(), "resit-moodle-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies 2026/27",
    subject: { name: "Mathematics", color: "blue" },
  });
  subjectId = snapshot(workspace).subjects[0]?.id ?? "";
  await linkSubject(workspace, { subjectId, link });
  serve();
});

afterEach(async () => {
  useNetworkFetch(fetch);
  await rm(directory, { recursive: true, force: true });
});

describe("planning a course", () => {
  it("keeps the files resit can store and says what it left out", () => {
    const plan = planCourse(contents(), link, new Map());
    expect(plan.items.map((item) => item.filename)).toEqual([
      "outline.pdf",
      "lecture-01.pdf",
      "sheet-a.pdf",
      "sheet-b.pdf",
    ]);
    expect(plan.items.every((item) => item.state === "new")).toBe(true);
    expect(plan.skipped).toEqual([
      { reason: "unsupported", detail: "forum", count: 1 },
      { reason: "external", detail: "linked from another site", count: 1 },
    ]);
  });

  it("puts sections in folders and leaves the general section loose", () => {
    const plan = planCourse(contents(), link, new Map());
    expect(plan.items.map((item) => item.section)).toEqual([
      "",
      "week-1-limits",
      "week-1-limits",
      "week-1-limits",
    ]);
  });

  it("names a single file after its activity and folder files after themselves", () => {
    const plan = planCourse(contents(), link, new Map());
    expect(plan.items.map((item) => item.name)).toEqual([
      "Course outline",
      "Lecture slides",
      "sheet-a",
      "sheet-b",
    ]);
  });
});

describe("downloading", () => {
  it("stores files in section folders with their Moodle record", async () => {
    const plan = await listItems(workspace, session, subjectId);
    const result = await downloadItems(workspace, session, {
      subjectId,
      keys: plan.items.map((item) => item.key),
    });

    expect(result).toEqual({ added: 4, replaced: 0, failures: [] });
    expect(downloads.sort()).toEqual([
      "lecture-01.pdf",
      "outline.pdf",
      "sheet-a.pdf",
      "sheet-b.pdf",
    ]);

    const resources = snapshot(workspace).resources;
    // Files keep their Moodle names; the activity name becomes the title.
    expect(resources.map((resource) => resource.path).sort()).toEqual([
      "subjects/mathematics/documents/outline.pdf",
      "subjects/mathematics/documents/week-1-limits/lecture-01.pdf",
      "subjects/mathematics/documents/week-1-limits/sheet-a.pdf",
      "subjects/mathematics/documents/week-1-limits/sheet-b.pdf",
    ]);
    const slides = resources.find(
      (resource) => resource.title === "Lecture slides",
    );
    expect(slides?.folder).toBe("week-1-limits");

    const sidecar = JSON.parse(
      await readFile(
        join(workspace.root, `${slides?.path}.resource.json`),
        "utf8",
      ),
    ) as { moodle: { moduleId: number; key: string } };
    expect(sidecar.moodle).toMatchObject({
      siteUrl: SITE,
      courseId: 7,
      moduleId: 102,
      key: "102:/lecture-01.pdf",
      filesize: 10,
      timemodified: 1700000000,
    });
  });

  it("marks downloaded files as already here", async () => {
    const plan = await listItems(workspace, session, subjectId);
    await downloadItems(workspace, session, {
      subjectId,
      keys: plan.items.map((item) => item.key),
    });
    const again = await listItems(workspace, session, subjectId);
    expect(again.items.every((item) => item.state === "current")).toBe(true);
  });

  it("replaces a changed file and keeps its ID", async () => {
    const plan = await listItems(workspace, session, subjectId);
    await downloadItems(workspace, session, {
      subjectId,
      keys: plan.items.map((item) => item.key),
    });
    const before = snapshot(workspace).resources.find(
      (resource) => resource.title === "Lecture slides",
    );

    const changed = contents();
    const slides = changed[1]?.modules[0]?.contents?.[0];
    if (!slides) throw new Error("Missing fixture module");
    slides.timemodified = 1700009999;
    slides.filesize = 11;
    serve(changed, "v2");

    const updated = await listItems(workspace, session, subjectId);
    const item = updated.items.find(
      (entry) => entry.key === "102:/lecture-01.pdf",
    );
    expect(item?.state).toBe("updated");
    expect(item?.resourceId).toBe(before?.id);

    const result = await downloadItems(workspace, session, {
      subjectId,
      keys: [item?.key ?? ""],
    });
    expect(result).toEqual({ added: 0, replaced: 1, failures: [] });

    const after = snapshot(workspace).resources.find(
      (resource) => resource.id === before?.id,
    );
    expect(after?.path).toBe(before?.path);
    expect(after?.revision).not.toBe(before?.revision);
    expect(snapshot(workspace).resources).toHaveLength(4);
  });

  it("reports a file that failed without stopping the rest", async () => {
    const fake: NetworkFetch = (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("/server.php"))
        return Promise.resolve(
          new Response(JSON.stringify(contents()), {
            headers: { "content-type": "application/json" },
          }),
        );
      if (parsed.pathname.endsWith("outline.pdf"))
        return Promise.resolve(new Response("nope", { status: 500 }));
      return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
    };
    useNetworkFetch(fake);

    const plan = await listItems(workspace, session, subjectId);
    const result = await downloadItems(workspace, session, {
      subjectId,
      keys: plan.items.map((item) => item.key),
    });
    expect(result.added).toBe(3);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.filename).toBe("outline.pdf");
  });

  it("survives a reopened workspace", async () => {
    const plan = await listItems(workspace, session, subjectId);
    await downloadItems(workspace, session, {
      subjectId,
      keys: plan.items.map((item) => item.key),
    });
    const reopened = await openWorkspace(workspace.root);
    await scanWorkspace(reopened);
    expect(snapshot(reopened).subjects[0]?.moodle).toEqual(link);
    const again = await listItems(reopened, session, subjectId);
    expect(again.items.every((item) => item.state === "current")).toBe(true);
  });
});

describe("naming a subject after a course", () => {
  const named = (fullname: string, shortname = "X") =>
    subjectNameFromCourse({ id: 1, shortname, fullname });

  it("drops the department code and the term", () => {
    expect(
      named(
        "DEE-EC - Projeto de Engenharia em Eletrotecnia - 1º Semestre 2026/2027",
      ),
    ).toBe("Projeto de Engenharia em Eletrotecnia");
    expect(named("MAT1 – Análise Matemática I – 2026/2027")).toBe(
      "Análise Matemática I",
    );
  });

  it("leaves a plain course title alone", () => {
    expect(named("Física I")).toBe("Física I");
  });

  it("falls back to the first part when everything looks like a code", () => {
    expect(named("MAT1 - 2026/2027")).toBe("MAT1");
    expect(named("2026/2027")).toBe("2026/2027");
  });
});
