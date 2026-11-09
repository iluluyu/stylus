import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../agents/gen-pptx/node_modules/playwright/index.mjs";
import JSZip from "../agents/gen-pptx/node_modules/jszip/lib/index.js";
import { serve } from "../scripts/serve.mjs";
import { standalone } from "../scripts/standalone.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = resolve(root, "artifacts");
await mkdir(artifacts, { recursive: true });
const server = await serve(root);
const url = server.url + "/examples/research-deck/index.html";
const browser = await chromium.launch({ headless: true });
const evidence = { checks: [], exports: {} };
const check = message => { evidence.checks.push(message); console.log("ok - " + message); };
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", req => errors.push(req.url() + ": " + req.failure()?.errorText));
  page.on("response", response => { if (response.status() >= 400) errors.push(response.url()); });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const ds = document.querySelector("deck-stage");
    return ds?.shadowRoot && ds.children.length === 3 && !ds.hasAttribute("data-fonts-pending");
  });
  const geometry = await page.evaluate(() => {
    const ds = document.querySelector("deck-stage");
    const rect = ds.shadowRoot.querySelector(".canvas").getBoundingClientRect();
    const slide = ds.querySelector("[data-deck-active]");
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      active: slide?.dataset.label, visible: getComputedStyle(slide).visibility };
  });
  assert.ok(geometry.width <= 390.1 && geometry.height <= 844.1);
  assert.ok(geometry.width > 380 && geometry.x >= -0.1 && geometry.y >= 0);
  assert.ok(Math.abs(geometry.width / geometry.height - 16 / 9) < 0.001);
  assert.equal(geometry.active, "Question");
  assert.equal(geometry.visible, "visible");
  evidence.smallViewport = geometry;
  await page.screenshot({ path: resolve(artifacts, "small-viewport.png") });
  check("390×844 viewport scales the full 16:9 slide without clipping");

  const active = () => page.locator("deck-stage > [data-deck-active]").getAttribute("data-label");
  await page.keyboard.press("ArrowRight");
  assert.equal(await active(), "Illustrative comparison");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await active(), "Question");
  await page.keyboard.press("End");
  assert.equal(await active(), "Next experiment");
  const hidden = () => page.locator(".claim").evaluate(el => getComputedStyle(el).visibility);
  assert.equal(await hidden(), "hidden");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".claim")).visibility === "visible");
  assert.equal(await active(), "Next experiment");
  await page.keyboard.press("Home");
  assert.equal(await active(), "Question");
  check("keyboard navigation, first/last jumps, and click-gated build work");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => document.querySelector("deck-stage").goTo(2));
  assert.equal(await hidden(), "hidden");
  await page.emulateMedia({ media: "print" });
  const print = await page.evaluate(() => {
    const ds = document.querySelector("deck-stage");
    return {
      slides: [...ds.children].map(el => {
        const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height, visibility: cs.visibility,
          position: cs.position, breakAfter: cs.breakAfter };
      }),
      chrome: getComputedStyle(ds.shadowRoot.querySelector(".overlay")).display,
      pageRule: document.getElementById("deck-stage-print-page")?.textContent
    };
  });
  assert.equal(print.chrome, "none");
  assert.equal(print.slides.length, 3);
  for (const slide of print.slides) {
    assert.equal(slide.width, 1920); assert.equal(slide.height, 1080);
    assert.equal(slide.visibility, "visible"); assert.equal(slide.position, "relative");
  }
  assert.equal(print.slides[0].breakAfter, "page");
  assert.equal(print.slides[1].breakAfter, "page");
  assert.equal(print.slides[2].breakAfter, "auto");
  assert.match(print.pageRule, /1920px 1080px/);
  const pdf = resolve(artifacts, "research-deck.pdf");
  await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  const info = (await exec("pdfinfo", [pdf])).stdout;
  assert.match(info, /Pages:\s+3\b/);
  assert.match(info, /Page size:\s+1440 x 810 pts/);
  const pdfText = (await exec("pdftotext", ["-layout", pdf, "-"])).stdout;
  const pages = pdfText.split("\f").filter(text => text.trim());
  assert.equal(pages.length, 3);
  assert.match(pages[0], /Can retrieval practice/);
  assert.match(pages[1], /toy comparison/);
  assert.match(pages[2], /Next decision: agree on the protocol/);
  evidence.print = print;
  evidence.pdfInfo = info;
  check("actual PDF has three 1440×810 pt pages with final-state build text");

  // A skipped trailing section must not leave a blank print sheet.
  await page.evaluate(() => document.querySelector("deck-stage").lastElementChild.setAttribute("data-deck-skip", ""));
  const skippedPdf = resolve(artifacts, "research-deck-skipped.pdf");
  await page.pdf({ path: skippedPdf, preferCSSPageSize: true, printBackground: true });
  assert.match((await exec("pdfinfo", [skippedPdf])).stdout, /Pages:\s+2\b/);
  assert.equal(await page.locator("deck-stage > section").nth(1).getAttribute("data-deck-last-visible"), "");
  await page.evaluate(() => document.querySelector("deck-stage").lastElementChild.removeAttribute("data-deck-skip"));
  check("skipped trailing slide prints two pages, no blank extra page");

  const titles = ["Can retrieval practice improve next-day recall?",
    "A toy comparison defines the planned contrast", "Preregister the comparison before collecting data"];
  for (const mode of ["editable", "screenshots"]) {
    const config = resolve(root, "examples/research-deck/pptx" + (mode === "screenshots" ? "-screenshots" : "") + ".json");
    const { stdout } = await exec(process.execPath, [resolve(root, "agents/gen-pptx/dist/cli.mjs"),
      "--url", url, "--config", config, "--out", artifacts], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.ok, true); assert.equal(result.slides, 3);
    assert.equal(result.animations, mode === "editable" ? 1 : 0);
    assert.deepEqual(result.warnings, []);
    const allowed = mode === "screenshots" ? ["animations_ignored_screenshots"] : [];
    assert.deepEqual(result.flags.map(flag => flag.code), allowed);
    assert.equal(result.speakerNotes.length, 3);
    assert.equal(new Set(result.speakerNotes).size, 3);
    const buffer = await readFile(result.file);
    assert.equal(buffer.length, result.bytes);
    const zip = await JSZip.loadAsync(buffer);
    const slides = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));
    assert.equal(slides.length, 3);
    const presentation = await zip.file("ppt/presentation.xml").async("string");
    assert.match(presentation, /<p:sldSz cx="18288000" cy="10287000"/);
    let allXml = "";
    for (let i = 1; i <= 3; i++) {
      const xml = await zip.file(`ppt/slides/slide${i}.xml`).async("string");
      const notes = await zip.file(`ppt/notesSlides/notesSlide${i}.xml`).async("string");
      assert.match(notes, new RegExp(result.speakerNotes[i - 1].slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      if (mode === "editable") {
        assert.ok(xml.includes(titles[i - 1]), "slide title must be real native editable text");
        assert.match(xml, /<p:sp>/);
        assert.doesNotMatch(xml, /<p:pic>/, "asset-free example must not become a full-slide image");
      } else {
        assert.match(xml, /<p:pic>/);
        assert.doesNotMatch(xml, /<a:t>/);
      }
      allXml += xml;
    }
    if (mode === "editable") {
      assert.match(allXml, /研究问题/);
      assert.match(allXml, /<a:ea typeface="Microsoft YaHei"/);
      assert.match(allXml, /<p:timing>/);
      assert.match(allXml, /Next decision: agree on the protocol/);
    } else {
      // Compare every exported PNG against a separately rendered base-state
      // reference. This catches hidden click builds AND shadow toolbar/rail.
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
      const reference = await context.newPage();
      await reference.goto(url, { waitUntil: "networkidle" });
      await reference.evaluate(async () => {
        await document.fonts.ready;
        const ds = document.querySelector("deck-stage");
        ds.setAttribute("noscale", "");
        const style = document.createElement("style");
        style.textContent = ".overlay,.rail,.rail-resize,.ctxmenu,.confirm-backdrop{display:none!important}";
        ds.shadowRoot.appendChild(style);
      });
      for (let i = 1; i <= 3; i++) {
        await reference.evaluate(index => document.querySelector("deck-stage").goTo(index), i - 1);
        await reference.waitForTimeout(650);
        const expected = await reference.screenshot({ path: resolve(artifacts, `slide-${i}.png`) });
        const rel = await zip.file(`ppt/slides/_rels/slide${i}.xml.rels`).async("string");
        const media = rel.match(/Target="\.\.\/media\/([^"]+)"/)[1];
        const actual = await zip.file("ppt/media/" + media).async("nodebuffer");
        assert.equal(actual.readUInt32BE(16), 3840);
        assert.equal(actual.readUInt32BE(20), 2160);
        assert.deepEqual(actual, expected, `screenshot slide ${i} differs from clean, fully visible base state`);
      }
      await context.close();
    }
    evidence.exports[mode] = result;
    check(`${mode} CLI export: 3 real slides, correct notes, dimensions and object contract`);
  }

  await standalone(resolve(artifacts, "research-deck.html"));
  const standalonePage = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const requests = [];
  standalonePage.on("request", req => requests.push(req.url()));
  await standalonePage.goto(server.url + "/artifacts/research-deck.html", { waitUntil: "networkidle" });
  await standalonePage.waitForFunction(() => !!document.querySelector("deck-stage")?.shadowRoot);
  assert.equal(requests.length, 1, "inlined HTML must load no scripts, fonts, CDN or assets");
  await standalonePage.keyboard.press("ArrowRight");
  assert.equal(await standalonePage.locator("deck-stage > [data-deck-active]").getAttribute("data-label"), "Illustrative comparison");
  check("single-file HTML works without runtime or external asset requests");
  assert.deepEqual(errors, []);
  check("no page errors, missing resources, or failed requests");
  await writeFile(resolve(artifacts, "smoke-result.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log("Artifacts: " + artifacts);
} finally {
  await browser.close();
  await server.close();
}
