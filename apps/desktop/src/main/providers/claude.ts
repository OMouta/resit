import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { execFile } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import type { ModelOption, ProviderState } from "../../shared/conversations";
import { loadSettings } from "../settings";
import { exists } from "../workspace/files";
import { t } from "../i18n";

const windows = process.platform === "win32";
const PROBE_TIMEOUT_MS = 15_000;

/** Places a GUI-launched app may not have on PATH. */
function knownLocations(): string[] {
  const home = homedir();
  const name = windows ? "claude.exe" : "claude";
  return [
    join(home, ".local", "bin", name),
    join(home, ".claude", "local", name),
    ...(windows
      ? []
      : [
          "/opt/homebrew/bin/claude",
          "/usr/local/bin/claude",
          "/usr/bin/claude",
        ]),
  ];
}

/**
 * npm installs put a `claude.cmd` shim on PATH on Windows. It cannot be
 * started without a shell, so use the package's script instead.
 */
async function npmScriptBeside(directory: string): Promise<string | null> {
  const script = join(
    directory,
    "node_modules",
    "@anthropic-ai",
    "claude-code",
    "cli.js",
  );
  return (await exists(script)) ? script : null;
}

/** Finds the installed Claude Code executable. The settings override wins. */
export async function findClaudeExecutable(): Promise<string | null> {
  const override = (await loadSettings()).claude.executablePath;
  if (override) return (await exists(override)) ? override : null;

  const directories = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const directory of directories) {
    const candidate = join(directory, windows ? "claude.exe" : "claude");
    if (await exists(candidate)) return candidate;
  }
  for (const candidate of knownLocations())
    if (await exists(candidate)) return candidate;
  if (windows)
    for (const directory of directories)
      if (await exists(join(directory, "claude.cmd"))) {
        const script = await npmScriptBeside(directory);
        if (script) return script;
      }
  return null;
}

function run(
  executable: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const script = executable.endsWith(".js");
  return new Promise((resolve, reject) => {
    execFile(
      script ? "node" : executable,
      script ? [executable, ...args] : args,
      { timeout: PROBE_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
  });
}

let cached: Promise<ProviderState> | null = null;

/**
 * Checks installation, version, and sign-in without sending a model
 * request. Results are cached until `refresh` is set.
 */
export function claudeStatus(refresh = false): Promise<ProviderState> {
  if (!cached || refresh) {
    cached = probe();
    models = null;
  }
  return cached;
}

let models: Promise<ModelOption[]> | null = null;

/**
 * Models the installed Claude Code offers. Starts it without sending a
 * message, asks for the list, and stops it. Cached until the status is
 * checked again.
 */
export function claudeModels(): Promise<ModelOption[]> {
  if (!models) {
    models = listModels();
    models.catch(() => {
      models = null;
    });
  }
  return models;
}

async function listModels(): Promise<ModelOption[]> {
  const status = await claudeStatus();
  if (status.status !== "ready") return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  // A prompt that sends nothing and ends when the list has arrived.
  const idle: AsyncIterable<SDKUserMessage> = {
    [Symbol.asyncIterator]: () => ({
      next: () =>
        new Promise<IteratorResult<SDKUserMessage>>((resolve) =>
          controller.signal.addEventListener("abort", () =>
            resolve({ done: true, value: undefined }),
          ),
        ),
    }),
  };
  const run = query({
    prompt: idle,
    options: {
      pathToClaudeCodeExecutable: status.path,
      ...(status.path.endsWith(".js") ? { executable: "node" as const } : {}),
      cwd: tmpdir(),
      abortController: controller,
      settingSources: [],
      tools: [],
    },
  });
  try {
    const list = await run.supportedModels();
    const fallback = list.find((model) => model.value === "default");
    // Claude Code describes each model as "Sonnet 5 · Efficient for …".
    // The "default" entry repeats one of the others, so it is dropped and
    // that model is marked as the default instead.
    return list
      .filter(
        (model) =>
          model !== fallback ||
          !list.some(
            (other) =>
              other !== model && other.resolvedModel === model.resolvedModel,
          ),
      )
      .map((model) => {
        const [name, ...rest] = model.description.split(" · ");
        return {
          id: model.value,
          name: name || model.displayName,
          description: rest.join(" · "),
          isDefault:
            model === fallback ||
            (fallback?.resolvedModel !== undefined &&
              model.resolvedModel === fallback.resolvedModel),
        };
      });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function probe(): Promise<ProviderState> {
  const path = await findClaudeExecutable();
  if (!path)
    return {
      status: "not-installed",
      message: (await loadSettings()).claude.executablePath
        ? t("No file exists at the Claude Code path set in Settings.")
        : t("Claude Code is not installed, or resit cannot find it."),
    };
  let version: string;
  try {
    const { stdout } = await run(path, ["--version"]);
    version = stdout.trim().split(/\s+/)[0] ?? "unknown";
  } catch (error) {
    return {
      status: "failed",
      path,
      message: t("Claude Code did not start: {problem}", {
        problem: error instanceof Error ? error.message : String(error),
      }),
    };
  }
  try {
    const { stdout } = await run(path, ["auth", "status"]);
    const auth = JSON.parse(stdout) as { loggedIn?: unknown };
    return auth.loggedIn === true
      ? { status: "ready", version, path }
      : { status: "not-authenticated", version, path };
  } catch (error) {
    // `auth status` exits non-zero when signed out.
    const stdout = (error as { stdout?: string }).stdout ?? "";
    if (
      stdout.includes('"loggedIn": false') ||
      stdout.includes('"loggedIn":false')
    )
      return { status: "not-authenticated", version, path };
    return { status: "ready", version, path };
  }
}
