import { randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { z } from "zod";

import { STUDY_INSTRUCTIONS, type StudyTool } from "./study-tools";

/** The revision of the MCP specification this endpoint speaks. */
const PROTOCOL_VERSION = "2025-06-18";
const MAX_BODY_BYTES = 1024 * 1024;

const messageSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
});

export interface McpEndpoint {
  /** Where the provider should connect, for example `http://127.0.0.1:1234/mcp`. */
  url: string;
  /** Sent as `Authorization: Bearer <token>`. */
  token: string;
  close(): Promise<void>;
}

function jsonSchemaFor(tool: StudyTool): Record<string, unknown> {
  const schema = z.toJSONSchema(z.object(tool.shape), { io: "input" });
  // Providers expect an object schema even when a tool takes no arguments.
  return { type: "object", properties: {}, ...schema };
}

interface Reply {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES)
      throw new Error("The request body is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * A study-tool MCP server on the loopback interface, for providers that
 * cannot load tools in this process. One endpoint serves one turn: it holds
 * that turn's scope, and its token dies with it.
 */
export async function startMcpEndpoint(
  tools: StudyTool[],
  serverName = "resit",
): Promise<McpEndpoint> {
  const token = randomBytes(32).toString("base64url");
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  const handle = async (message: unknown): Promise<Reply | null> => {
    const parsed = messageSchema.safeParse(message);
    if (!parsed.success) return null;
    const { id, method, params } = parsed.data;
    // Notifications and responses need no reply.
    if (id === undefined || !method) return null;
    const reply = (result: unknown): Reply => ({ jsonrpc: "2.0", id, result });

    switch (method) {
      case "initialize":
        return reply({
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: serverName, version: "1.0.0" },
          instructions: STUDY_INSTRUCTIONS,
        });
      case "ping":
        return reply({});
      case "tools/list":
        return reply({
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: jsonSchemaFor(tool),
          })),
        });
      case "tools/call": {
        const call = z
          .object({ name: z.string(), arguments: z.unknown().optional() })
          .safeParse(params);
        const tool = call.success ? byName.get(call.data.name) : undefined;
        if (!call.success || !tool)
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "No such tool." },
          };
        const result = await tool.run(call.data.arguments ?? {});
        return reply(result);
      }
      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown method ${method}.` },
        };
    }
  };

  const server = createServer((request, response) => {
    void respond(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });

  const respond = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const url = request.url ?? "";
    if (!url.startsWith("/mcp")) {
      response.writeHead(404).end();
      return;
    }
    if (request.headers.authorization !== `Bearer ${token}`) {
      response
        .writeHead(401, {
          "www-authenticate": "Bearer",
          "content-type": "application/json",
        })
        .end(JSON.stringify({ error: "invalid_token" }));
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405, { allow: "POST" }).end();
      return;
    }
    const body = await readBody(request);
    let payload: unknown;
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      response.writeHead(400, { "content-type": "application/json" }).end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Invalid JSON." },
        }),
      );
      return;
    }
    const batch = Array.isArray(payload) ? payload : [payload];
    const replies = (await Promise.all(batch.map(handle))).filter(
      (entry): entry is Reply => entry !== null,
    );
    // A batch of notifications has nothing to answer with.
    if (replies.length === 0) {
      response.writeHead(202).end();
      return;
    }
    response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify(Array.isArray(payload) ? replies : replies[0]));
  };

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (typeof address === "string" || address === null) {
    server.close();
    throw new Error("The study tools endpoint did not start.");
  }

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    token,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
