// CJK East-Asian font slot (vendor Patch 3 + core/fonts helper).
//
// PowerPoint has no font stack: a run's <a:ea> face was always its Latin face
// (vendored pptxgenjs copies fontFace into all three slots). On a reader that
// lacks that font — or when the font holds no CJK glyphs at all (Arial) —
// Chinese/Japanese/Korean text shows as boxes (upstream issue #29, fixed in
// JimLiu/baoyu-design v2.8.2 for claude-slides; ported here for our gen-pptx,
// which embeds no fonts, so every CJK run gets a Windows/Office-safe fallback
// named in the ea slot).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { eaFontFaceFor } from "../src/core/fonts.ts";

const here = dirname(fileURLToPath(import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PptxGenJS: any = (await import(pathToFileURL(join(here, "..", "dist", "vendor-bundle.test.mjs")).href)).default;

// --- helper: script-aware fallback selection -------------------------------

test("eaFontFaceFor: Han text with a Latin face names Microsoft YaHei", () => {
  assert.equal(eaFontFaceFor("Arial", "方法总览 Figure 1"), "Microsoft YaHei");
  assert.equal(eaFontFaceFor("Inter", "中文测试"), "Microsoft YaHei");
});

test("eaFontFaceFor: Japanese kana or a JP-named face names Yu Gothic", () => {
  assert.equal(eaFontFaceFor("Arial", "回路の概要 ひらがな カタカナ"), "Yu Gothic");
  assert.equal(eaFontFaceFor("Zen Kaku JP", "漢字のみ"), "Yu Gothic");
});

test("eaFontFaceFor: Hangul or a KR-named face names Malgun Gothic", () => {
  assert.equal(eaFontFaceFor("Arial", "방법 개요"), "Malgun Gothic");
  assert.equal(eaFontFaceFor("Nanum KR", "개요"), "Malgun Gothic");
});

test("eaFontFaceFor: a TC/HK-named face names Microsoft JhengHei", () => {
  assert.equal(eaFontFaceFor("Noto Serif TC", "方法概述"), "Microsoft JhengHei");
  assert.equal(eaFontFaceFor("Some HK Font", "概述"), "Microsoft JhengHei");
});

test("eaFontFaceFor: text without CJK gets no override", () => {
  assert.equal(eaFontFaceFor("Arial", "plain latin text 123"), undefined);
  assert.equal(eaFontFaceFor("Arial", ""), undefined);
});

// --- vendor emission: eaFontFace reaches <a:ea> in the slide XML ------------

async function slideXmlFor(runs: { text: string; options: Record<string, unknown> }[]): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "T", width: 10, height: 5.625 });
  pptx.layout = "T";
  const slide = pptx.addSlide();
  slide.addText(runs, { x: 1, y: 1, w: 8, h: 1 });
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("ppt/slides/slide1.xml")!.async("string");
}

test("vendor: a CJK run with eaFontFace emits the fallback in the ea slot", async () => {
  const xml = await slideXmlFor([
    { text: "中文标题", options: { fontFace: "Arial", eaFontFace: "Microsoft YaHei" } },
  ]);
  assert.match(xml, /<a:latin typeface="Arial"/);
  assert.match(
    xml,
    /<a:ea typeface="Microsoft YaHei"/,
    "ea slot must name the East-Asian fallback, not the Latin face (vendor Patch 3)",
  );
  assert.doesNotMatch(xml, /<a:ea typeface="Arial"/);
});

test("vendor: a mixed Latin+CJK box keeps each run's slots separate", async () => {
  const xml = await slideXmlFor([
    { text: "Method Overview: ", options: { fontFace: "Inter" } },
    { text: "方法总览", options: { fontFace: "Inter", eaFontFace: "Microsoft YaHei" } },
  ]);
  assert.match(xml, /<a:ea typeface="Microsoft YaHei"/);
});

test("vendor: without eaFontFace the old three-slot behaviour is unchanged", async () => {
  const xml = await slideXmlFor([
    { text: "latin only", options: { fontFace: "Georgia" } },
  ]);
  assert.match(xml, /<a:latin typeface="Georgia"/);
  assert.match(xml, /<a:ea typeface="Georgia"/); // legacy behaviour preserved
});

// --- wiring guard (source-level, same convention as vendor.test.ts) --------

test("render-node wires eaFontFaceFor at the addText call sites", () => {
  const src = readFileSync(join(here, "..", "src", "render", "render-node.ts"), "utf8");
  const uses = src.match(/eaFontFaceFor\(/g)?.length ?? 0;
  assert.ok(uses >= 4, `render-node.ts must compute eaFontFace at its 4 addText sites (found ${uses})`);
  assert.match(src, /import \{[^}]*eaFontFaceFor[^}]*\} from "\.\.\/core\/fonts\.ts"/);
});
