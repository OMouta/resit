import { readFileSync, rmSync } from "node:fs";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join } from "node:path";

import { z } from "zod";

import { writeJson } from "./files";

/** Which copy of resit has a workspace open. */
const lockSchema = z.object({
  pid: z.number().int(),
  host: z.string(),
  since: z.string(),
});
export type WorkspaceLock = z.infer<typeof lockSchema>;

function lockPath(root: string): string {
  return join(root, ".resit", "lock.json");
}

function ours(lock: WorkspaceLock): boolean {
  return lock.pid === process.pid && lock.host === hostname();
}

/** Whether a process on this computer is still running. */
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // It exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function parse(text: string): WorkspaceLock | null {
  try {
    return lockSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Claims a workspace for this copy of resit, or returns the lock another
 * copy holds. A lock left by a copy that is no longer running on this
 * computer is taken over. One from another computer cannot be checked, so it
 * holds until `force` takes it over.
 */
export async function acquireLock(
  root: string,
  force = false,
): Promise<WorkspaceLock | null> {
  const path = lockPath(root);
  const mine: WorkspaceLock = {
    pid: process.pid,
    host: hostname(),
    since: new Date().toISOString(),
  };
  await mkdir(dirname(path), { recursive: true });
  try {
    const handle = await open(path, "wx");
    try {
      await handle.writeFile(`${JSON.stringify(mine, null, 2)}\n`);
    } finally {
      await handle.close();
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const held = parse(await readFile(path, "utf8").catch(() => ""));
  if (
    held &&
    !force &&
    !ours(held) &&
    (held.host !== hostname() || running(held.pid))
  )
    return held;
  await writeJson(path, mine);
  return null;
}

/** Whether a lock was taken on this computer. */
export function heldHere(lock: WorkspaceLock): boolean {
  return lock.host === hostname();
}

/** Gives the workspace up, if this copy of resit holds it. */
export async function releaseLock(root: string): Promise<void> {
  const held = parse(await readFile(lockPath(root), "utf8").catch(() => ""));
  if (held && ours(held)) await rm(lockPath(root), { force: true });
}

/** The same, for when the app is quitting and cannot wait. */
export function releaseLockSync(root: string): void {
  try {
    const held = parse(readFileSync(lockPath(root), "utf8"));
    if (held && ours(held)) rmSync(lockPath(root), { force: true });
  } catch {
    // Nothing to release.
  }
}
