import { join } from "node:path";
import { app } from "electron";

import {
  appSettingsSchema,
  type AppSettings,
  type SettingsPatch,
} from "../shared/settings";
import type { RecentWorkspace } from "../shared/workspace";
import { readJson, writeJson } from "./workspace/files";

const MAX_RECENT = 8;
let cached: AppSettings | null = null;

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

export async function loadSettings(): Promise<AppSettings> {
  if (cached) return cached;
  let raw: unknown = {};
  try {
    raw = await readJson(settingsPath());
  } catch {
    // First launch or unreadable settings: start from defaults.
  }
  cached = appSettingsSchema.parse(
    typeof raw === "object" && raw !== null ? raw : {},
  );
  return cached;
}

async function save(next: AppSettings): Promise<AppSettings> {
  cached = next;
  await writeJson(settingsPath(), next);
  return next;
}

export async function updateSettings(
  patch: SettingsPatch,
): Promise<AppSettings> {
  const current = await loadSettings();
  const claude = { ...current.claude };
  if (patch.claude) {
    for (const key of ["executablePath", "model"] as const) {
      if (!(key in patch.claude)) continue;
      const value = patch.claude[key]?.trim();
      if (value) claude[key] = value;
      else delete claude[key];
    }
  }
  return save({
    ...current,
    ...(patch.theme ? { theme: patch.theme } : {}),
    claude,
  });
}

export async function rememberWorkspace(
  workspace: RecentWorkspace,
): Promise<AppSettings> {
  const current = await loadSettings();
  return save({
    ...current,
    lastWorkspacePath: workspace.path,
    recent: [
      workspace,
      ...current.recent.filter(
        (entry) => entry.id !== workspace.id && entry.path !== workspace.path,
      ),
    ].slice(0, MAX_RECENT),
  });
}

export async function forgetLastWorkspace(): Promise<void> {
  const current = await loadSettings();
  const { lastWorkspacePath: _last, ...rest } = current;
  await save(rest);
}
