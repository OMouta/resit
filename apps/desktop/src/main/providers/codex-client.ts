import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { t } from "../i18n";

/**
 * Codex's app server speaks JSON-RPC over stdio, one message per line, and
 * without the `jsonrpc` version field.
 */
interface Incoming {
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
}

export interface CodexClientOptions {
  executable: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Answers a request from the app server, such as an approval. */
  onRequest?: (method: string, params: unknown) => Promise<unknown>;
  onNotification?: (method: string, params: unknown) => void;
}

export class CodexError extends Error {}

export interface CodexClient {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
  notify(method: string, params?: unknown): void;
  /** The last lines the app server wrote to stderr. */
  stderr(): string;
  /** Resolves when the process exits, whether asked to or not. */
  exited: Promise<void>;
  close(): void;
}

const MAX_STDERR = 4000;

export function startCodexAppServer(options: CodexClientOptions): CodexClient {
  const child: ChildProcessWithoutNullStreams = spawn(
    options.executable,
    options.args,
    {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      // `.cmd` and `.ps1` shims on Windows cannot be started without one.
      shell:
        process.platform === "win32" && !/\.exe$/i.test(options.executable),
    },
  );

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-MAX_STDERR);
  });

  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  let closed = false;

  const fail = (error: Error) => {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  const exited = new Promise<void>((resolve) => {
    child.once("exit", (code) => {
      closed = true;
      fail(
        new CodexError(
          `${
            code === null
              ? t("Codex stopped.")
              : t("Codex stopped with code {code}.", { code })
          }${
            stderr.trim()
              ? ` ${stderr.trim().split("\n").slice(-2).join(" ")}`
              : ""
          }`,
        ),
      );
      resolve();
    });
    child.once("error", (error) => {
      closed = true;
      fail(
        new CodexError(
          t("Codex could not be started: {problem}", {
            problem: error.message,
          }),
        ),
      );
      resolve();
    });
  });

  const write = (message: Record<string, unknown>) => {
    if (closed) throw new CodexError(t("Codex is no longer running."));
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };

  createInterface({ input: child.stdout }).on("line", (line) => {
    if (!line.trim()) return;
    let message: Incoming;
    try {
      message = JSON.parse(line) as Incoming;
    } catch {
      return;
    }
    if (message.id !== undefined && message.method === undefined) {
      const entry = pending.get(Number(message.id));
      if (!entry) return;
      pending.delete(Number(message.id));
      if (message.error)
        entry.reject(
          new CodexError(message.error.message ?? "Codex reported an error."),
        );
      else entry.resolve(message.result);
      return;
    }
    if (!message.method) return;
    if (message.id === undefined) {
      options.onNotification?.(message.method, message.params);
      return;
    }
    const id = message.id;
    const answer = options.onRequest?.(message.method, message.params);
    void (answer ?? Promise.resolve({})).then(
      (result) => {
        if (!closed) write({ id, result });
      },
      (error: unknown) => {
        if (closed) return;
        write({
          id,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      },
    );
  });

  return {
    request<T>(method: string, params?: unknown): Promise<T> {
      const id = nextId++;
      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        try {
          write({ id, method, ...(params === undefined ? {} : { params }) });
        } catch (error) {
          pending.delete(id);
          reject(
            error instanceof Error ? error : new CodexError(String(error)),
          );
        }
      });
    },
    notify(method: string, params?: unknown): void {
      write({ method, ...(params === undefined ? {} : { params }) });
    },
    stderr: () => stderr,
    exited,
    close() {
      if (closed) return;
      closed = true;
      child.kill();
      fail(new CodexError("Codex was stopped."));
    },
  };
}
