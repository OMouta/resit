import { z } from "zod";

export const themeSchema = z.enum(["system", "light", "dark"]);

export const recentWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
});

/** Machine settings. Stored in the app's user data folder, never in a workspace. */
export const providerIdSchema = z.enum(["claude", "codex"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const appSettingsSchema = z.object({
  theme: themeSchema.catch("system"),
  recent: z.array(recentWorkspaceSchema).catch([]),
  lastWorkspacePath: z.string().optional().catch(undefined),
  /** Provider new conversations start with. */
  provider: providerIdSchema.catch("claude"),
  claude: z
    .object({
      executablePath: z.string().optional().catch(undefined),
      model: z.string().optional().catch(undefined),
    })
    .catch({}),
  codex: z
    .object({
      executablePath: z.string().optional().catch(undefined),
      model: z.string().optional().catch(undefined),
      /** CODEX_HOME, when the student keeps Codex somewhere else. */
      homePath: z.string().optional().catch(undefined),
    })
    .catch({}),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const settingsPatchSchema = z.object({
  theme: themeSchema.optional(),
  provider: providerIdSchema.optional(),
  claude: z
    .object({
      executablePath: z.string().max(1024).optional(),
      model: z.string().max(200).optional(),
    })
    .optional(),
  codex: z
    .object({
      executablePath: z.string().max(1024).optional(),
      model: z.string().max(200).optional(),
      homePath: z.string().max(1024).optional(),
    })
    .optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
