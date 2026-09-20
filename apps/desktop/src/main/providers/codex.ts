import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import type { ModelOption, ProviderState } from "../../shared/conversations";
import { loadSettings } from "../settings";
import { exists } from "../workspace/files";
import { startCodexAppServer, type CodexClient } from "./codex-client";

const windows = process.platform === "win32";
const PROBE_TIMEOUT_MS = 20_000;

export const CODEX_CLIENT_INFO = {
  name: "resit",
  title: "resit",
  version: "0.1.0",
} as const;

/** Places a GUI-launched app may not have on PATH. */
function knownLocations(): string[] {
  const home = homedir();
  const name = windows ? "codex.exe" : "codex";
  return [
    join(home, ".codex", "bin", name),
    join(home, ".local", "bin", name),
    ...(windows
      ? []
      : ["/opt/homebrew/bin/codex", "/usr/local/bin/codex", "/usr/bin/codex"]),
  ];
}

/** Finds the installed Codex executable. The settings override wins. */
export async function findCodexExecutable(): Promise<string | null> {
  const override = (await loadSettings()).codex.executablePath;
  if (override) return (await exists(override)) ? override : null;

  const directories = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const names = windows ? ["codex.exe", "codex.cmd", "codex"] : ["codex"];
  for (const directory of directories)
    for (const name of names) {
      const candidate = join(directory, name);
      if (await exists(candidate)) return candidate;
    }
  for (const candidate of knownLocations())
    if (await exists(candidate)) return candidate;
  return null;
}

export interface CodexLaunch {
  executable: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

/**
 * How to start `codex app-server`, including the study tools endpoint when
 * one is given. Codex reads the token from the environment, so it never
 * appears in a process listing.
 */
export async function codexLaunch(options?: {
  mcp?: { name: string; url: string; token: string };
}): Promise<CodexLaunch | null> {
  const executable = await findCodexExecutable();
  if (!executable) return null;
  const settings = await loadSettings();
  const home = settings.codex.homePath;
  const mcp = options?.mcp;
  return {
    executable,
    args: [
      "app-server",
      ...(mcp
        ? [
            "-c",
            `mcp_servers.${mcp.name}.url=${mcp.url}`,
            "-c",
            `mcp_servers.${mcp.name}.bearer_token_env_var="RESIT_MCP_TOKEN"`,
          ]
        : []),
    ],
    env: {
      ...process.env,
      ...(home ? { CODEX_HOME: home } : {}),
      ...(mcp ? { RESIT_MCP_TOKEN: mcp.token } : {}),
    },
  };
}

interface InitializeResponse {
  userAgent?: string;
}

interface AccountResponse {
  account?: { type?: string; email?: string; planType?: string } | null;
  requiresOpenaiAuth?: boolean;
}

interface ModelListResponse {
  data?: {
    id?: string;
    model?: string;
    displayName?: string;
    description?: string;
    hidden?: boolean;
    isDefault?: boolean;
  }[];
  nextCursor?: string | null;
}

/** Starts the app server, runs `use`, and always stops the process. */
async function withAppServer<T>(
  launch: CodexLaunch,
  use: (client: CodexClient) => Promise<T>,
): Promise<T> {
  const client = startCodexAppServer({
    executable: launch.executable,
    args: launch.args,
    cwd: tmpdir(),
    env: launch.env,
  });
  const timer = setTimeout(() => client.close(), PROBE_TIMEOUT_MS);
  try {
    return await use(client);
  } finally {
    clearTimeout(timer);
    client.close();
  }
}

let cached: Promise<ProviderState> | null = null;
let models: Promise<ModelOption[]> | null = null;

/**
 * Checks installation and sign-in by starting the app server and asking it,
 * which is the only way Codex reports its account. Cached until refreshed.
 */
export function codexStatus(refresh = false): Promise<ProviderState> {
  if (!cached || refresh) {
    cached = probe();
    models = null;
  }
  return cached;
}

/** Models the installed Codex offers. Cached until the status is checked. */
export function codexModels(): Promise<ModelOption[]> {
  if (!models) {
    models = listModels();
    models.catch(() => {
      models = null;
    });
  }
  return models;
}

async function probe(): Promise<ProviderState> {
  const launch = await codexLaunch();
  if (!launch)
    return {
      status: "not-installed",
      message: (await loadSettings()).codex.executablePath
        ? "No file exists at the Codex path set in Settings."
        : "Codex is not installed, or resit cannot find it.",
    };
  try {
    return await withAppServer(launch, async (client) => {
      const initialize = await client.request<InitializeResponse>(
        "initialize",
        { clientInfo: CODEX_CLIENT_INFO, capabilities: {} },
      );
      client.notify("initialized");
      const version =
        /\/(\S+)/.exec(initialize.userAgent ?? "")?.[1] ?? "unknown";
      const account = await client.request<AccountResponse>("account/read", {});
      return account.account
        ? { status: "ready", version, path: launch.executable }
        : { status: "not-authenticated", version, path: launch.executable };
    });
  } catch (error) {
    return {
      status: "failed",
      path: launch.executable,
      message: `Codex did not start: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function listModels(): Promise<ModelOption[]> {
  const status = await codexStatus();
  if (status.status !== "ready") return [];
  const launch = await codexLaunch();
  if (!launch) return [];
  return withAppServer(launch, async (client) => {
    await client.request("initialize", {
      clientInfo: CODEX_CLIENT_INFO,
      capabilities: {},
    });
    client.notify("initialized");
    const options: ModelOption[] = [];
    let cursor: string | undefined;
    do {
      const response = await client.request<ModelListResponse>(
        "model/list",
        cursor ? { cursor } : {},
      );
      for (const model of response.data ?? []) {
        const id = model.model ?? model.id;
        if (!id || model.hidden) continue;
        options.push({
          id,
          name: model.displayName ?? id,
          description: model.description ?? "",
          isDefault: model.isDefault === true,
        });
      }
      cursor = response.nextCursor ?? undefined;
    } while (cursor);
    return options;
  });
}
