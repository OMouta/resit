import { z } from "zod";

import { annotationColorSchema } from "./workspace";

export const themeSchema = z.enum(["system", "light", "dark"]);

export const recentWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
});

/** Machine settings. Stored in the app's user data folder, never in a workspace. */
export const providerIdSchema = z.enum(["claude", "codex"]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const documentFontSchema = z.enum(["sans", "serif", "mono"]);
export type DocumentFont = z.infer<typeof documentFontSchema>;
export const documentWidthSchema = z.enum(["narrow", "normal", "wide"]);
export type DocumentWidth = z.infer<typeof documentWidthSchema>;
export const editorModeSchema = z.enum(["rich", "source"]);
export type EditorMode = z.infer<typeof editorModeSchema>;
/** Zoom a PDF opens at. Numbers are percentages. */
export const pdfZoomSchema = z.enum([
  "fit-width",
  "fit-page",
  "100",
  "125",
  "150",
]);
export type PdfZoomSetting = z.infer<typeof pdfZoomSchema>;
export const pdfPanelSchema = z.enum([
  "none",
  "thumbnails",
  "outline",
  "highlights",
]);
export type PdfPanel = z.infer<typeof pdfPanelSchema>;
/** Languages text recognition reads scanned pages in, by Tesseract code. */
export const ocrLanguageSchema = z.enum(["eng", "por"]);
export type OcrLanguage = z.infer<typeof ocrLanguageSchema>;

const documentSettingsSchema = z.object({
  font: documentFontSchema.catch("sans"),
  /** Body text size in pixels. */
  size: z.number().int().min(13).max(22).catch(17),
  width: documentWidthSchema.catch("normal"),
});
export type DocumentSettings = z.infer<typeof documentSettingsSchema>;

const editorSettingsSchema = z.object({
  spellcheck: z.boolean().catch(true),
  /** Which editor a note opens in. */
  mode: editorModeSchema.catch("rich"),
  /** Show the heading outline beside a note. */
  outline: z.boolean().catch(false),
});
export type EditorSettings = z.infer<typeof editorSettingsSchema>;

const pdfSettingsSchema = z.object({
  zoom: pdfZoomSchema.catch("fit-width"),
  /** Which side panel a PDF opens with. */
  panel: pdfPanelSchema.catch("none"),
  /** Tone pages down in the dark theme so a white page is not a lamp. */
  dimInDark: z.boolean().catch(true),
  highlightColor: annotationColorSchema.catch("yellow"),
  ocrLanguages: z.array(ocrLanguageSchema).min(1).max(2).catch(["eng", "por"]),
});
export type PdfSettings = z.infer<typeof pdfSettingsSchema>;

/** Reminders before study sessions, shown while resit is running. */
const reminderSettingsSchema = z.object({
  enabled: z.boolean().catch(false),
  minutesBefore: z
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .catch(10),
});
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;

const DOCUMENT_DEFAULTS: DocumentSettings = {
  font: "sans",
  size: 17,
  width: "normal",
};
const EDITOR_DEFAULTS: EditorSettings = {
  spellcheck: true,
  mode: "rich",
  outline: false,
};
const REMINDER_DEFAULTS: ReminderSettings = {
  enabled: false,
  minutesBefore: 10,
};
const PDF_DEFAULTS: PdfSettings = {
  zoom: "fit-width",
  panel: "none",
  dimInDark: true,
  highlightColor: "yellow",
  ocrLanguages: ["eng", "por"],
};

export const appSettingsSchema = z.object({
  theme: themeSchema.catch("system"),
  /** Cuts animation down for anyone who asks for it here rather than in the OS. */
  reduceMotion: z.boolean().catch(false),
  /** Open the last workspace when resit starts. */
  reopenLastWorkspace: z.boolean().catch(true),
  document: documentSettingsSchema.catch(DOCUMENT_DEFAULTS),
  editor: editorSettingsSchema.catch(EDITOR_DEFAULTS),
  pdf: pdfSettingsSchema.catch(PDF_DEFAULTS),
  reminders: reminderSettingsSchema.catch(REMINDER_DEFAULTS),
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
  reduceMotion: z.boolean().optional(),
  reopenLastWorkspace: z.boolean().optional(),
  document: documentSettingsSchema.partial().optional(),
  editor: editorSettingsSchema.partial().optional(),
  pdf: pdfSettingsSchema.partial().optional(),
  reminders: reminderSettingsSchema.partial().optional(),
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
