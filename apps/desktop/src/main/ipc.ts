import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";

export interface IpcContext {
  window: () => BrowserWindow | null;
  rendererUrl: string;
}

let context: IpcContext | null = null;

export function setIpcContext(next: IpcContext): void {
  context = next;
}

/** Only the main window's top frame, at the app's own URL, may call in. */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const window = context?.window();
  if (
    !context ||
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    event.senderFrame?.url !== context.rendererUrl
  )
    throw new Error("Unauthorized request");
}

/**
 * Registers an IPC handler whose arguments are validated against `args`
 * before the handler runs.
 */
export function handle<Args extends z.ZodTuple>(
  channel: string,
  args: Args,
  handler: (...values: z.infer<Args>) => unknown,
): void {
  ipcMain.handle(channel, (event, ...values: unknown[]) => {
    assertTrustedSender(event);
    const parsed = args.safeParse(values);
    if (!parsed.success) throw new Error(`Invalid request to ${channel}`);
    return handler(...(parsed.data as z.infer<Args>));
  });
}

export const id = z.string().min(1).max(200);
export const title = z.string().trim().min(1).max(200);
