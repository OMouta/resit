import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron, type ElectronApplication, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { samplePdf } from "../tools/sample-pdf.mjs";

const desktopDirectory = fileURLToPath(
  new URL("../../apps/desktop", import.meta.url),
);
const require = createRequire(join(desktopDirectory, "package.json"));
const executablePath: unknown = require("electron");

let directory: string;
let profile: string;
let folder: string;
let pdfSource: string;
let application: ElectronApplication | undefined;
let page: Page;

/**
 * Starts the app with its own profile. The window is shown without focus,
 * off screen and out of the taskbar, so it renders without taking input.
 */
async function launch(): Promise<void> {
  if (typeof executablePath !== "string")
    throw new Error("Electron executable not found");
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.ELECTRON_RENDERER_URL;
  application = await _electron.launch({
    executablePath,
    args: [desktopDirectory, "--hidden", `--user-data-dir=${profile}`],
    env: environment,
  });
  page = await application.firstWindow();
  await application.evaluate(
    ({ BrowserWindow, dialog }, paths) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window) throw new Error("No window");
      window.setSkipTaskbar(true);
      window.setBounds({ x: -4000, y: -4000, width: 1280, height: 800 });
      window.showInactive();
      // Stand-in for the native pickers.
      dialog.showOpenDialog = (async (...args: unknown[]) => {
        const options = args.at(-1) as { properties?: string[] };
        return {
          canceled: false,
          filePaths: options.properties?.includes("openDirectory")
            ? [paths.folder]
            : [paths.pdf],
        };
      }) as typeof dialog.showOpenDialog;
    },
    { folder, pdf: pdfSource },
  );
  await page.waitForSelector("main");
}

async function close(): Promise<void> {
  await application?.close();
  application = undefined;
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "resit-e2e-"));
  profile = join(directory, "profile");
  folder = join(directory, "Estudo Área");
  pdfSource = join(directory, "Folha 1 – Limites.pdf");
  await writeFile(
    pdfSource,
    samplePdf([
      { title: "Limits", lines: ["1. Compute sin(x)/x as x approaches 0."] },
      { title: "Continuity", lines: ["2. Where is 1/(x - 2) continuous?"] },
    ]),
  );
  await launch();
});

afterAll(async () => {
  await close();
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
});

async function noteFile(): Promise<string> {
  const subjects = join(folder, "subjects");
  const [subject] = await readdir(subjects);
  const notes = join(subjects, subject!, "notes");
  const [note] = await readdir(notes);
  return readFile(join(notes, note!), "utf8");
}

describe("desktop workspace", () => {
  it("creates a workspace from the start screen", async () => {
    await page.getByRole("button", { name: /Create workspace/ }).click();
    await page.getByLabel("Workspace name").fill("ISEP 2026/27");
    await page.getByRole("button", { name: /Choose/ }).click();
    await expect
      .poll(() => page.getByLabel("Folder").inputValue())
      .toBe(folder);
    await page.getByLabel("First subject").fill("Análise Matemática");
    await page.getByRole("button", { name: /Create and open/ }).click();
    await page.getByRole("treeitem", { name: /Análise Matemática/ }).waitFor();
    expect(
      JSON.parse(await readFile(join(folder, "workspace.json"), "utf8")),
    ).toMatchObject({ format: "resit-workspace", name: "ISEP 2026/27" });
  });

  it("saves typed notes as Markdown with math", async () => {
    await page.getByRole("treeitem", { name: /Análise Matemática/ }).hover();
    await page.getByRole("button", { name: "New note" }).first().click();
    await page.getByLabel("Title").fill("Limites");
    await page.getByRole("button", { name: "Create note" }).click();
    await page.locator(".note-content").click();
    await page.keyboard.type("The limit of $x^2$ at 3 is 9.");
    await page.getByText("Saved", { exact: true }).waitFor();
    await expect.poll(noteFile).toContain("The limit of $x^2$ at 3 is 9.");
    expect(await page.locator(".note-content .katex").count()).toBe(1);
  });

  it("keeps unsaved text when the file changes on disk", async () => {
    await page.locator(".note-content p").first().click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Mine.");
    const subjects = join(folder, "subjects");
    const [subject] = await readdir(subjects);
    const path = join(subjects, subject!, "notes", "limites.md");
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace("is 9.", "is nine."),
    );
    await page.getByText("This note changed on disk").waitFor();
    await page.getByRole("button", { name: "Keep my version" }).click();
    await expect.poll(noteFile).toContain("is 9. Mine.");
  });

  it("imports a PDF and finds text inside it", async () => {
    await page.getByRole("treeitem", { name: /Análise Matemática/ }).hover();
    await page.getByRole("button", { name: "Subject actions" }).click();
    await page.getByRole("menuitem", { name: /Import files/ }).click();
    await page.getByRole("tab", { name: /Folha 1/ }).waitFor();
    await page.keyboard.press("Control+k");
    await page.keyboard.type("continuous");
    await page.getByRole("option", { name: /p\. 2/ }).click();
    await expect
      .poll(() => page.getByLabel("Page number").inputValue())
      .toBe("2");
  });

  it("reopens the workspace with its tabs after a restart", async () => {
    await page.waitForTimeout(600);
    await close();
    await launch();
    await page.getByRole("tab", { name: "Limites", exact: true }).waitFor();
    await page.getByRole("tab", { name: /Folha 1/ }).waitFor();
  });

  it("explains when Claude Code cannot be found", async () => {
    await page.evaluate(() =>
      window.resit.updateSettings({
        claude: { executablePath: "Z:/missing/claude.exe" },
      }),
    );
    await page.reload();
    await page.keyboard.press("Control+j");
    await page
      .getByPlaceholder("Connect Claude Code in Settings to ask questions")
      .waitFor();
    await page.evaluate(() =>
      window.resit.updateSettings({ claude: { executablePath: "" } }),
    );
  });
});
