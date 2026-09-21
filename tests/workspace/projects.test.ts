import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

import {
  createProject,
  deleteProject,
  resolveScope,
  updateProject,
} from "../../apps/desktop/src/main/workspace/projects";
import {
  listTrash,
  restoreFromTrash,
} from "../../apps/desktop/src/main/workspace/trash";
import {
  createNote,
  createSubject,
  createWorkspace,
  openWorkspace,
  snapshot,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

let directory: string;
let workspace: OpenWorkspace;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-projects-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

it("groups subjects and files from across the workspace", async () => {
  const mathematics = snapshot(workspace).subjects[0]!;
  const physics = await createSubject(workspace, {
    name: "Physics",
    color: "red",
  });
  const programming = await createSubject(workspace, {
    name: "Programming",
    color: "green",
  });
  const solver = await createNote(workspace, {
    subjectId: programming.id,
    title: "ODE solver",
  });

  const project = await createProject(workspace, {
    title: "Numerical Simulation",
    subjectIds: [mathematics.id, physics.id, mathematics.id, "gone"],
    resourceIds: [solver.id],
  });
  expect(project.subjectIds).toEqual([mathematics.id, physics.id]);
  expect(await readdir(join(workspace.root, "projects"))).toEqual([
    "numerical-simulation.json",
  ]);

  // It is read back when the workspace opens again.
  const reopened = await openWorkspace(workspace.root);
  expect(snapshot(reopened).projects).toEqual([project]);

  const renamed = await updateProject(workspace, {
    id: project.id,
    title: "Simulation",
    subjectIds: [physics.id],
  });
  expect(renamed).toMatchObject({
    title: "Simulation",
    subjectIds: [physics.id],
    resourceIds: [solver.id],
  });

  // A conversation about the project reaches what the project holds now.
  expect(
    resolveScope(workspace, {
      subjectIds: [mathematics.id],
      resourceIds: [],
      projectId: project.id,
    }),
  ).toEqual({
    subjectIds: [mathematics.id, physics.id],
    resourceIds: [solver.id],
  });
});

it("deletes only the project, which the trash can bring back", async () => {
  const subjectId = snapshot(workspace).subjects[0]!.id;
  const note = await createNote(workspace, { subjectId, title: "Limits" });
  const project = await createProject(workspace, {
    title: "Exam prep",
    subjectIds: [subjectId],
    resourceIds: [note.id],
  });
  await deleteProject(workspace, project.id);
  expect(snapshot(workspace).projects).toEqual([]);
  expect(snapshot(workspace).resources.map((entry) => entry.id)).toEqual([
    note.id,
  ]);
  expect(
    resolveScope(workspace, {
      subjectIds: [],
      resourceIds: [],
      projectId: project.id,
    }),
  ).toEqual({ subjectIds: [], resourceIds: [] });

  const [deleted] = await listTrash(workspace);
  expect(deleted).toMatchObject({ kind: "project", title: "Exam prep" });
  await restoreFromTrash(workspace, deleted!.id);
  expect(snapshot(workspace).projects).toEqual([project]);
});
