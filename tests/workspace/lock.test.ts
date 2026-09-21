import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  acquireLock,
  releaseLock,
} from "../../apps/desktop/src/main/workspace/lock";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "resit-lock-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function lockFile(): Promise<{ pid: number; host: string }> {
  return JSON.parse(await readFile(join(root, ".resit", "lock.json"), "utf8"));
}

async function writeLock(pid: number, host: string): Promise<void> {
  await mkdir(join(root, ".resit"), { recursive: true });
  await writeFile(
    join(root, ".resit", "lock.json"),
    JSON.stringify({ pid, host, since: "2026-09-21T10:00:00.000Z" }),
  );
}

/** The ID of a process that has already exited. */
async function exitedPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""]);
  await new Promise((resolve) => child.once("exit", resolve));
  return child.pid!;
}

describe("workspace lock", () => {
  it("claims a free workspace and gives it back", async () => {
    expect(await acquireLock(root)).toBeNull();
    expect(await lockFile()).toMatchObject({
      pid: process.pid,
      host: hostname(),
    });
    // Opening the same workspace again in the same copy is fine.
    expect(await acquireLock(root)).toBeNull();
    await releaseLock(root);
    await expect(lockFile()).rejects.toThrow();
  });

  it("refuses a workspace another running copy holds, until forced", async () => {
    await writeLock(process.ppid, hostname());
    expect(await acquireLock(root)).toMatchObject({ pid: process.ppid });
    expect(await acquireLock(root, true)).toBeNull();
    expect((await lockFile()).pid).toBe(process.pid);
  });

  it("takes over a lock left by a copy that stopped running", async () => {
    await writeLock(await exitedPid(), hostname());
    expect(await acquireLock(root)).toBeNull();
    expect((await lockFile()).pid).toBe(process.pid);
  });

  it("keeps a lock from another computer, which it cannot check", async () => {
    await writeLock(process.pid, "another-laptop");
    expect(await acquireLock(root)).toMatchObject({ host: "another-laptop" });
  });

  it("leaves another copy's lock alone when releasing", async () => {
    await writeLock(process.ppid, hostname());
    await releaseLock(root);
    expect((await lockFile()).pid).toBe(process.ppid);
  });
});
