import { chromium } from "playwright";
const [url, expression] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: "networkidle" });
console.log(JSON.stringify(await page.evaluate(expression), null, 1));
await browser.close();
