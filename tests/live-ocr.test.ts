import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright";
import { expect, it } from "vitest";

import { imagePdf } from "./tools/image-pdf.mjs";

/**
 * Downloads Tesseract's English data from the internet, so it only runs
 * when asked:
 *   RESIT_LIVE=1 npx vitest run tests/live-ocr.test.ts
 */
const live = process.env.RESIT_LIVE === "1";

const desktopDirectory = fileURLToPath(
  new URL("../apps/desktop", import.meta.url),
);
const executablePath: unknown = createRequire(
  join(desktopDirectory, "package.json"),
)("electron");

it.skipIf(!live)(
  "reads a scanned page and finds its words in search",
  { timeout: 300_000 },
  async () => {
    if (typeof executablePath !== "string")
      throw new Error("Electron executable not found");
    const directory = await mkdtemp(join(tmpdir(), "resit-live-ocr-"));
    const folder = join(directory, "Studies");
    const scan = join(directory, "Scanned worksheet.pdf");
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined &&
          entry[0] !== "ELECTRON_RUN_AS_NODE" &&
          entry[0] !== "ELECTRON_RENDERER_URL",
      ),
    );
    const application = await _electron.launch({
      executablePath,
      args: [
        desktopDirectory,
        "--hidden",
        `--user-data-dir=${join(directory, "profile")}`,
      ],
      env: environment,
    });
    try {
      const page = await application.firstWindow();
      // A line of text drawn as a picture, then put in a PDF as a scan.
      const picture = await application.evaluate(async ({ BrowserWindow }) => {
        const window = new BrowserWindow({
          show: false,
          width: 1240,
          height: 400,
          webPreferences: { offscreen: true },
        });
        await window.loadURL(
          "data:text/html,<body style='margin:60px;font:40px serif;background:white'>Integration by substitution reverses the chain rule.</body>",
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        const image = await window.webContents.capturePage();
        window.destroy();
        const { width, height } = image.getSize();
        return { width, height, bgra: image.toBitmap().toString("base64") };
      });
      const bgra = Buffer.from(picture.bgra, "base64");
      const rgb = Buffer.alloc(picture.width * picture.height * 3);
      for (let pixel = 0; pixel < picture.width * picture.height; pixel += 1) {
        rgb[pixel * 3] = bgra[pixel * 4 + 2]!;
        rgb[pixel * 3 + 1] = bgra[pixel * 4 + 1]!;
        rgb[pixel * 3 + 2] = bgra[pixel * 4]!;
      }
      await writeFile(scan, imagePdf([{ ...picture, rgb }]));

      await application.evaluate(({ BrowserWindow, dialog }, path) => {
        const window = BrowserWindow.getAllWindows()[0];
        window?.setBounds({ x: -4000, y: -4000, width: 1280, height: 800 });
        window?.showInactive();
        dialog.showOpenDialog = (async () => ({
          canceled: false,
          filePaths: [path],
        })) as typeof dialog.showOpenDialog;
      }, scan);
      await page.waitForSelector("main");
      await page.evaluate(
        (path) =>
          window.resit
            .updateSettings({ pdf: { ocrLanguages: ["eng"] } })
            .then(() =>
              window.resit.createWorkspace({
                folder: path,
                name: "Studies",
                subject: { name: "Mathematics", color: "blue" },
              }),
            ),
        folder,
      );
      await page.reload();
      await page.getByRole("treeitem", { name: /Mathematics/ }).hover();
      await page.getByRole("button", { name: "Subject actions" }).click();
      await page.getByRole("menuitem", { name: /Import files/ }).click();
      await page.getByRole("tab", { name: /Scanned worksheet/ }).waitFor();

      await page.getByRole("button", { name: /Recognize text/ }).click();
      await page
        .getByText("Recognized the text on 1 page")
        .waitFor({ timeout: 240_000 });
      const hits = await page.evaluate(() =>
        window.resit.search("substitution"),
      );
      expect(hits).toMatchObject([
        { title: "Scanned worksheet", kind: "pdf", page: 1 },
      ]);
    } finally {
      await application.close();
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    }
  },
);
