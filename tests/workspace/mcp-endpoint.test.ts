import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { startMcpEndpoint } from "../../apps/desktop/src/main/agent/mcp-endpoint";
import { studyTools } from "../../apps/desktop/src/main/agent/study-tools";
import {
  createNote,
  createSubject,
  createWorkspace,
  saveNote,
  snapshot,
  readNote,
  type OpenWorkspace,
} from "../../apps/desktop/src/main/workspace/workspace";

let directory: string;
let workspace: OpenWorkspace;
let endpoint: Awaited<ReturnType<typeof startMcpEndpoint>>;

/** One JSON-RPC call over the endpoint, the way a provider makes it. */
async function call(
  method: string,
  params?: unknown,
  token = endpoint.token,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(endpoint.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      ...(method === "notifications/initialized" ? {} : { id: 1 }),
      method,
      ...(params === undefined ? {} : { params }),
    }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as unknown) : null,
  };
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-mcp-"));
  workspace = await createWorkspace({
    folder: join(directory, "Studies"),
    name: "Studies",
    subject: { name: "Mathematics", color: "blue" },
  });
  const subject = snapshot(workspace).subjects[0]!;
  const note = await createNote(workspace, {
    subjectId: subject.id,
    title: "Limits",
  });
  await saveNote(workspace, {
    id: note.id,
    body: "The squeeze theorem.\n",
    expectedRevision: (await readNote(workspace, note.id)).revision,
  });
  endpoint = await startMcpEndpoint(
    studyTools(workspace, { subjectIds: [subject.id], resourceIds: [] }),
  );
});

afterEach(async () => {
  await endpoint.close();
  await rm(directory, { recursive: true, force: true });
});

describe("study tools over http", () => {
  it("refuses a request without the turn's token", async () => {
    const response = await fetch(endpoint.url, {
      method: "POST",
      body: "{}",
    });
    expect(response.status).toBe(401);
    expect((await call("tools/list", {}, "not-the-token")).status).toBe(401);
  });

  it("answers initialize, lists tools, and runs one", async () => {
    const initialize = await call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(initialize.body).toMatchObject({
      result: { protocolVersion: "2025-06-18", capabilities: { tools: {} } },
    });

    const listed = (await call("tools/list", {})).body as {
      result: { tools: { name: string; inputSchema: { type: string } }[] };
    };
    expect(listed.result.tools.map((tool) => tool.name)).toContain(
      "study_read_note",
    );
    expect(
      listed.result.tools.every((tool) => tool.inputSchema.type === "object"),
    ).toBe(true);

    const notes = (
      await call("tools/call", {
        name: "study_list_resources",
        arguments: { kind: "note" },
      })
    ).body as { result: { content: { text: string }[] } };
    const files = JSON.parse(notes.result.content[0]!.text) as {
      files: { id: string; title: string }[];
    };
    expect(files.files.map((file) => file.title)).toEqual(["Limits"]);

    const read = (
      await call("tools/call", {
        name: "study_read_note",
        arguments: { noteId: files.files[0]!.id },
      })
    ).body as { result: { content: { text: string }[] } };
    expect(read.result.content[0]!.text).toContain("squeeze theorem");
  });

  it("keeps files outside the conversation's scope out of reach", async () => {
    const other = await createSubject(workspace, {
      name: "Physics",
      color: "red",
    });
    const hidden = await createNote(workspace, {
      subjectId: other.id,
      title: "Kinematics",
    });
    const result = (
      await call("tools/call", {
        name: "study_read_note",
        arguments: { noteId: hidden.id },
      })
    ).body as { result: { content: { text: string }[]; isError?: boolean } };
    expect(result.result.isError).toBe(true);
    expect(result.result.content[0]!.text).toContain("OUT_OF_SCOPE");
  });

  it("reports a tool that does not exist, and takes notifications", async () => {
    const missing = (await call("tools/call", { name: "nope" })).body as {
      error: { message: string };
    };
    expect(missing.error.message).toBe("No such tool.");
    expect((await call("notifications/initialized")).status).toBe(202);
  });

  it("stops answering once the turn is over", async () => {
    const url = endpoint.url;
    const token = endpoint.token;
    await endpoint.close();
    await expect(
      fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: "{}",
      }),
    ).rejects.toThrow();
    // The next turn starts a fresh endpoint, so teardown has something to do.
    endpoint = await startMcpEndpoint([]);
    await writeFile(join(directory, "done"), "");
  });
});
