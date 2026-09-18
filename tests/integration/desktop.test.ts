import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, type ElectronApplication, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const desktopDirectory = fileURLToPath(
  new URL("../../apps/desktop", import.meta.url),
);
const require = createRequire(join(desktopDirectory, "package.json"));
const executablePath: unknown = require("electron");
let application: ElectronApplication;
let page: Page;
let userDataDirectory: string;

beforeAll(async () => {
  if (typeof executablePath !== "string")
    throw new Error("Electron executable not found");
  userDataDirectory = await mkdtemp(join(tmpdir(), "resit-test-"));
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.ELECTRON_RENDERER_URL;

  application = await _electron.launch({
    executablePath,
    args: [
      desktopDirectory,
      "--hidden",
      `--user-data-dir=${userDataDirectory}`,
    ],
    env: environment,
  });
  page = await application.firstWindow();
  await page.waitForSelector("main", { state: "attached" });
});

afterAll(async () => {
  if (application) await application.close();
  if (userDataDirectory) {
    await rm(userDataDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
});

describe("desktop process boundary", () => {
  it("loads the renderer and completes a health check through preload, main, and worker", async () => {
    expect(await page.title()).toBe("resit");
    expect(await page.evaluate(() => window.resit.healthCheck())).toEqual({
      status: "ok",
    });
  });

  it("keeps Node and generic IPC out of the renderer", async () => {
    const exposed = await page.evaluate(() => ({
      require: typeof Reflect.get(window, "require"),
      process: typeof Reflect.get(window, "process"),
      ipcRenderer: typeof Reflect.get(window, "ipcRenderer"),
      invoke: typeof Reflect.get(window.resit, "invoke"),
      send: typeof Reflect.get(window.resit, "send"),
    }));
    expect(exposed).toEqual({
      require: "undefined",
      process: "undefined",
      ipcRenderer: "undefined",
      invoke: "undefined",
      send: "undefined",
    });

    const devtools = await page.context().newCDPSession(page);
    const contexts: { id: number; name: string }[] = [];
    devtools.on("Runtime.executionContextCreated", ({ context }) =>
      contexts.push(context),
    );
    await devtools.send("Runtime.enable");
    const isolated = contexts.find(
      (context) => context.name === "Electron Isolated Context",
    );
    expect(isolated).toBeDefined();
    await devtools.detach();
    expect(
      await application.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        // Present at runtime, missing from Electron's type definitions.
        const contents = window?.webContents as
          | { getLastWebPreferences(): Electron.WebPreferences | null }
          | undefined;
        const preferences = contents?.getLastWebPreferences();
        return {
          visible: window?.isVisible(),
          sandbox: preferences?.sandbox,
          contextIsolation: preferences?.contextIsolation,
          nodeIntegration: preferences?.nodeIntegration,
        };
      }),
    ).toEqual({
      visible: false,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    });
  });

  it("rejects health requests from another window even with the same preload", async () => {
    const error = await application.evaluate(
      async ({ BrowserWindow }, preload) => {
        const untrusted = new BrowserWindow({
          show: false,
          webPreferences: {
            preload,
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        });
        try {
          await untrusted.loadURL("data:text/html,<html lang='en'></html>");
          return await untrusted.webContents.executeJavaScript(
            "window.resit.healthCheck().then(() => null, error => error.message)",
          );
        } finally {
          untrusted.destroy();
        }
      },
      join(desktopDirectory, "out/preload/index.cjs"),
    );
    expect(error).toContain("Unauthorized request");
  });

  it("does not open child windows or allow renderer navigation", async () => {
    const currentUrl = page.url();
    expect(await page.evaluate(() => window.open("about:blank"))).toBeNull();
    // Chromium does not report about:blank to will-navigate; such a page
    // still cannot call IPC because its URL is not the app's.
    await page.evaluate(() => {
      window.location.href = "https://example.com/";
    });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.location.href)).toBe(currentUrl);
    expect(
      await application.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      ),
    ).toBe(1);
  });
});
