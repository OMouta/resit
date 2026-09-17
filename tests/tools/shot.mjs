import { chromium } from "playwright";
const [url, out, width = "1280", height = "800", scheme = "light"] =
  process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  colorScheme: scheme,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: process.env.FULL === "1" });
console.log(
  JSON.stringify({
    errors,
    text: (await page.innerText("body")).slice(0, 120),
  }),
);
await browser.close();
