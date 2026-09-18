import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

import type { ProviderState } from "../../shared/conversations";
import { loadSettings } from "../settings";
import { exists } from "../workspace/files";

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
  if (!cached || refresh) cached = probe();
  return cached;
}

async function probe(): Promise<ProviderState> {
  const path = await findClaudeExecutable();
  if (!path)
    return {
      status: "not-installed",
      message: (await loadSettings()).claude.executablePath
        ? "No file exists at the Claude Code path set in Settings."
        : "Claude Code is not installed, or resit cannot find it.",
    };
  let version: string;
  try {
    const { stdout } = await run(path, ["--version"]);
    version = stdout.trim().split(/\s+/)[0] ?? "unknown";
  } catch (error) {
    return {
      status: "failed",
      path,
      message: `Claude Code did not start: ${error instanceof Error ? error.message : String(error)}`,
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
