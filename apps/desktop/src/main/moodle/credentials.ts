import { rm } from "node:fs/promises";
import { join } from "node:path";
import { app, safeStorage } from "electron";
import { z } from "zod";

import type { MoodleConnection } from "../../shared/moodle";
import { readJson, writeJson } from "../workspace/files";
import {
  MoodleError,
  normalizeSiteUrl,
  requestToken,
  siteInfo,
  type MoodleSession,
} from "./client";

/**
 * The Moodle account belongs to the computer, not to a workspace. The token is
 * encrypted with the OS keystore and never leaves the main process.
 */
const accountSchema = z.object({
  siteUrl: z.string(),
  siteName: z.string(),
  username: z.string(),
  fullName: z.string(),
  userId: z.number().int(),
  /** Base64 of the encrypted web-service token. */
  token: z.string(),
});

type Account = z.infer<typeof accountSchema>;

let cached: Account | null | undefined;
let status: MoodleConnection | null = null;

function accountPath(): string {
  return join(app.getPath("userData"), "moodle.json");
}

async function load(): Promise<Account | null> {
  if (cached !== undefined) return cached;
  try {
    cached = accountSchema.parse(await readJson(accountPath()));
  } catch {
    cached = null;
  }
  return cached;
}

function connected(account: Account): MoodleConnection {
  return {
    status: "connected",
    siteUrl: account.siteUrl,
    siteName: account.siteName,
    fullName: account.fullName,
    username: account.username,
  };
}

/** What the renderer is told. Never includes the token. */
export async function moodleConnection(): Promise<MoodleConnection> {
  if (status) return status;
  const account = await load();
  status = account ? connected(account) : { status: "disconnected" };
  return status;
}

/** The site and token for a request. Throws when no account is stored. */
export async function moodleSession(): Promise<MoodleSession> {
  const account = await load();
  if (!account)
    throw new MoodleError("Connect your Moodle account in settings first.");
  return {
    siteUrl: account.siteUrl,
    token: safeStorage.decryptString(Buffer.from(account.token, "base64")),
  };
}

/** The Moodle user ID the token belongs to. */
export async function moodleUserId(): Promise<number> {
  const account = await load();
  if (!account)
    throw new MoodleError("Connect your Moodle account in settings first.");
  return account.userId;
}

export async function connectMoodle(input: {
  siteUrl: string;
  username: string;
  password: string;
}): Promise<MoodleConnection> {
  if (!safeStorage.isEncryptionAvailable())
    throw new MoodleError(
      "This computer has no secure store for the Moodle token, so resit will not save one.",
    );
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  const token = await requestToken({ ...input, siteUrl });
  const info = await siteInfo({ siteUrl, token });
  const account: Account = {
    siteUrl,
    siteName: info.siteName || new URL(siteUrl).host,
    username: info.username || input.username,
    fullName: info.fullName,
    userId: info.userId,
    token: safeStorage.encryptString(token).toString("base64"),
  };
  await writeJson(accountPath(), account);
  cached = account;
  status = connected(account);
  return status;
}

export async function disconnectMoodle(): Promise<MoodleConnection> {
  await rm(accountPath(), { force: true });
  cached = null;
  status = { status: "disconnected" };
  return status;
}

/** Re-checks the stored token against the site. */
export async function moodleStatus(
  refresh: boolean,
): Promise<MoodleConnection> {
  if (!refresh) return moodleConnection();
  const account = await load();
  if (!account) {
    status = { status: "disconnected" };
    return status;
  }
  try {
    const info = await siteInfo(await moodleSession());
    const next: Account = {
      ...account,
      siteName: info.siteName || account.siteName,
      username: info.username || account.username,
      fullName: info.fullName || account.fullName,
      userId: info.userId,
    };
    await writeJson(accountPath(), next);
    cached = next;
    status = connected(next);
  } catch (error) {
    status = {
      status: "failed",
      siteUrl: account.siteUrl,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  return status;
}
