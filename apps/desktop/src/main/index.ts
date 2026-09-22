import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, nativeTheme, net, session } from "electron";
import { EVENT_CHANNEL } from "../shared/ipc";
import { resolveLocale } from "../shared/settings";
import { abortAllTurns } from "./agent/turns";
import { registerHandlers } from "./handlers";
import { setLocale } from "./i18n";
import { setIpcContext } from "./ipc";
import { handleFileScheme, registerFileScheme } from "./media-protocol";
import { useNetworkFetch } from "./moodle/client";
import { startReminders } from "./planning/reminders";
import {
  currentWorkspace,
  hasWorkspace,
  releaseWorkspaceSync,
  setEventSink,
} from "./session";
import { loadSettings } from "./settings";

const rendererFile = join(import.meta.dirname, "../renderer/index.html");
const rendererUrl = new URL(
  !app.isPackaged && process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(rendererFile).href,
).href;

let mainWindow: BrowserWindow | null = null;
let closeConfirmed = false;

/**
 * A second copy of resit would write to the same workspace as this one. It
 * hands over to the running copy, which comes to the front, and quits.
 */
const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance) app.quit();

app.on("second-instance", () => {
  const window = mainWindow;
  if (!window) {
    if (app.isReady()) void createWindow();
    return;
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});

/**
 * Height of the window buttons drawn over the title bar. The bar is 48px
 * (--toolbar-height) including its 1px bottom border, which must stay
 * visible under the buttons.
 */
const TITLE_BAR_BUTTONS_HEIGHT = 47;

/**
 * The app draws its own title bar. Windows and Linux keep the system
 * window buttons, drawn over the bar in the bar's colours.
 */
function titleBarOverlay(): Electron.TitleBarOverlayOptions {
  const dark = nativeTheme.shouldUseDarkColors;
  return {
    color: dark ? "#202020" : "#f7f7f5",
    symbolColor: dark ? "#e3e2e0" : "#37352f",
    height: TITLE_BAR_BUTTONS_HEIGHT,
  };
}

async function createWindow(): Promise<void> {
  const settings = await loadSettings();
  nativeTheme.themeSource = settings.theme;
  setLocale(resolveLocale(settings.language, app.getLocale()));
  const window = new BrowserWindow({
    title: "resit",
    width: 1360,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#191919" : "#ffffff",
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { titleBarOverlay: true, trafficLightPosition: { x: 18, y: 18 } }
      : { titleBarOverlay: titleBarOverlay() }),
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
  // With titleBarOverlay, Windows never sends ready-to-show for the first
  // window, so the finished page load also shows it.
  const show = () => {
    if (!app.commandLine.hasSwitch("hidden") && !window.isVisible())
      window.show();
  };
  window.once("ready-to-show", show);
  window.webContents.once("did-finish-load", show);
  await window.loadURL(rendererUrl);
}

registerFileScheme();

void app
  .whenReady()
  .then(async () => {
    if (!firstInstance) return;
    // Only writing to the clipboard (the Copy buttons) is allowed.
    session.defaultSession.setPermissionCheckHandler(
      (_contents, permission) => permission === "clipboard-sanitized-write",
    );
    session.defaultSession.setPermissionRequestHandler(
      (_contents, permission, callback) => {
        callback(permission === "clipboard-sanitized-write");
      },
    );

    // Moodle is reached through Chromium, so system proxies and certificates
    // that a university network relies on apply.
    useNetworkFetch(net.fetch);
    handleFileScheme(() => (hasWorkspace() ? currentWorkspace() : null));

    setIpcContext({ window: () => mainWindow, rendererUrl });
    setEventSink((event) => {
      mainWindow?.webContents.send(EVENT_CHANNEL, event);
    });
    // Windows names a notification's app by this ID; the installer's
    // shortcut carries the same one.
    if (process.platform === "win32") app.setAppUserModelId("study.resit");
    startReminders({
      workspace: () => (hasWorkspace() ? currentWorkspace() : null),
      onOpen: () => {
        const window = mainWindow;
        if (!window) return;
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
        window.webContents.send(EVENT_CHANNEL, { type: "show-schedule" });
      },
    });
    nativeTheme.on("updated", () => {
      if (process.platform !== "darwin")
        mainWindow?.setTitleBarOverlay(titleBarOverlay());
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
app.on("will-quit", releaseWorkspaceSync);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
