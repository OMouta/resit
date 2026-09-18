import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, nativeTheme, session } from "electron";
import { EVENT_CHANNEL } from "../shared/ipc";
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

    setIpcContext({ window: () => mainWindow, rendererUrl });
    setEventSink((event) => {
      mainWindow?.webContents.send(EVENT_CHANNEL, event);
    });
    registerHandlers(() => mainWindow);

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
