import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, nativeTheme, session } from "electron";
import { EVENT_CHANNEL } from "../shared/ipc";
import { abortAllTurns } from "./agent/turns";
import { registerHandlers } from "./handlers";
import { setIpcContext } from "./ipc";
import { setEventSink } from "./session";
import { loadSettings } from "./settings";

const rendererFile = join(import.meta.dirname, "../renderer/index.html");
const rendererUrl = new URL(
  !app.isPackaged && process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(rendererFile).href,
).href;

let mainWindow: BrowserWindow | null = null;
let closeConfirmed = false;

async function createWindow(): Promise<void> {
  const settings = await loadSettings();
  nativeTheme.themeSource = settings.theme;
  const window = new BrowserWindow({
    title: "resit",
    width: 1360,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#000000" : "#ffffff",
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
  // Give the renderer a moment to save open notes before the window goes.
  window.on("close", (event) => {
    if (closeConfirmed) return;
    event.preventDefault();
    window.webContents.send(EVENT_CHANNEL, { type: "before-close" });
    setTimeout(() => {
      if (window.isDestroyed()) return;
      closeConfirmed = true;
      window.close();
    }, 3000);
  });
  window.on("closed", () => {
    mainWindow = null;
    closeConfirmed = false;
  });
  window.once("ready-to-show", () => {
    if (!app.commandLine.hasSwitch("hidden")) window.show();
  });
  await window.loadURL(rendererUrl);
}

void app
  .whenReady()
  .then(async () => {
    // Only writing to the clipboard (the Copy buttons) is allowed.
    session.defaultSession.setPermissionCheckHandler(
      (_contents, permission) => permission === "clipboard-sanitized-write",
    );
    session.defaultSession.setPermissionRequestHandler(
      (_contents, permission, callback) => {
        callback(permission === "clipboard-sanitized-write");
      },
    );

    setIpcContext({ window: () => mainWindow, rendererUrl });
    setEventSink((event) => {
      mainWindow?.webContents.send(EVENT_CHANNEL, event);
    });
    registerHandlers(
      () => mainWindow,
      () => {
        closeConfirmed = true;
        mainWindow?.close();
      },
    );

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

app.on("before-quit", abortAllTurns);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
