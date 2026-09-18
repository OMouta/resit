import { z } from "zod";

export const themeSchema = z.enum(["system", "light", "dark"]);

export const recentWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
});

/** Machine settings. Stored in the app's user data folder, never in a workspace. */
export const appSettingsSchema = z.object({
  theme: themeSchema.catch("system"),
  recent: z.array(recentWorkspaceSchema).catch([]),
  lastWorkspacePath: z.string().optional().catch(undefined),
  claude: z
    .object({
      executablePath: z.string().optional().catch(undefined),
      model: z.string().optional().catch(undefined),
    })
    .catch({}),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const settingsPatchSchema = z.object({
  theme: themeSchema.optional(),
  claude: z
    .object({
      executablePath: z.string().max(1024).optional(),
      model: z.string().max(200).optional(),
    })
    .optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
