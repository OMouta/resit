import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, ipcMain, session } from "electron";
import { HEALTH_CHECK_CHANNEL } from "../shared/ipc";
import { checkHealth } from "./health";

const rendererFile = join(import.meta.dirname, "../renderer/index.html");
const rendererUrl = new URL(
  !app.isPackaged && process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(rendererFile).href,
).href;

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    title: "resit",
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });
  mainWindow = window;
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.on("closed", () => {
    mainWindow = null;
  });
  window.once("ready-to-show", () => {
    if (!app.commandLine.hasSwitch("hidden")) window.show();
  });
  await window.loadURL(rendererUrl);
}

void app
  .whenReady()
  .then(async () => {
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler(
      (_contents, _permission, callback) => {
        callback(false);
      },
    );

    ipcMain.handle(HEALTH_CHECK_CHANNEL, (event, ...args: unknown[]) => {
      if (
        !mainWindow ||
        event.sender !== mainWindow.webContents ||
        event.senderFrame !== mainWindow.webContents.mainFrame ||
        event.senderFrame.url !== rendererUrl ||
        args.length !== 0
      ) {
        throw new Error("Unauthorized health check");
      }
      return checkHealth();
    });

    await createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow();
      }
    });
  })
  .catch((error: unknown) => {
    console.error("Unable to start resit", error);
    app.exit(1);
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
