import { z } from "zod";

/** One file the student has open, as the window sees it. */
export const openFileSchema = z.object({
  resourceId: z.string().min(1).max(200),
  title: z.string().max(300),
  kind: z.enum(["note", "pdf", "image", "attachment"]),
  /** 1 for the first pane, 2 for the one beside it. */
  pane: z.number().int().min(1).max(2),
  /** The tab on top in its pane. */
  visible: z.boolean(),
  /** The tab the student is working in. */
  focused: z.boolean(),
  /** One-based page for a PDF. */
  page: z.number().int().positive().optional(),
  pageCount: z.number().int().positive().optional(),
  selection: z.string().max(20_000).optional(),
});
export type OpenFile = z.infer<typeof openFileSchema>;

/** What the window shows right now, as opposed to when a message was sent. */
export const liveContextSchema = z.object({
  at: z.iso.datetime({ offset: true }),
  files: z.array(openFileSchema).max(50),
});
export type LiveContext = z.infer<typeof liveContextSchema>;
