import { chromium } from "../agents/gen-pptx/node_modules/playwright/index.mjs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function exportPdf(url, output) {
  if (!/^https?:\/\//i.test(url)) throw new Error("Use an HTTP(S) deck URL");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!document.querySelector("deck-stage")?.shadowRoot);
    await page.evaluate(() => document.fonts.ready);
    await mkdir(dirname(output), { recursive: true });
    await page.pdf({ path: output, preferCSSPageSize: true, printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    return output;
  } finally { await browser.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || !process.argv[3]) {
    throw new Error("Usage: node scripts/export-pdf.mjs <http(s)URL> <output.pdf>");
  }
  console.log(await exportPdf(process.argv[2], resolve(process.argv[3])));
}
