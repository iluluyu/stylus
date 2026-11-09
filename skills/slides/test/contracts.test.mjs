import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { standalone } from "../scripts/standalone.mjs";
import { serve } from "../scripts/serve.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = path => readFile(resolve(root, path), "utf8");

async function walk(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "artifacts"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}

test("single concise model-neutral entry, explicit notes opt-in, local references", async () => {
  const entry = await read("SKILL.md");
  assert.match(entry, /^---\nname: slides\ndescription: ([^\n]+)\n---\n/);
  assert.ok(entry.match(/description: ([^\n]+)/)[1].length < 1024);
  const lines = entry.trimEnd().split("\n").length;
  assert.ok(lines >= 100 && lines <= 160, `entry has ${lines} lines`);
  assert.doesNotMatch(entry, /gpt-|claude-|built-in-skills|system-prompt|must (?:first )?read/i);
  assert.match(entry, /only when the user explicitly requests/);
  assert.match(entry, /editable native text and shapes by default/);
  assert.match(entry, /only on explicit request/);
  assert.match(entry, /never promise arbitrary HTML conversion/);
  assert.match(entry, /Never invent measurements/);
  await assert.rejects(stat(resolve(root, "built-in-skills")), { code: "ENOENT" });
});

test("markdown links resolve entirely inside the standalone skill", async () => {
  for (const file of (await walk(root)).filter(p => p.endsWith(".md"))) {
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1].split("#")[0];
      if (!href || /^(?:https?:|mailto:)/.test(href)) continue;
      const target = resolve(dirname(file), href);
      assert.ok(target.startsWith(root), `${file}: outside-skill link ${href}`);
      await stat(target);
    }
    if (!file.endsWith("PROVENANCE.md")) {
      assert.doesNotMatch(text, /\.\.\/design\//, file);
    }
    if (!file.endsWith("SKILL.md")) assert.doesNotMatch(text, /^---\nname:/, file);
  }
});

test("offline research example and both export configs describe three real slides", async () => {
  const html = await read("examples/research-deck/index.html");
  assert.match(html, /<deck-stage width="1920" height="1080" no-rail>/);
  assert.equal([...html.matchAll(/<section\b/g)].length, 3);
  assert.doesNotMatch(html, /https?:\/\/|react|text\/babel|cdn/i);
  assert.match(html, /ILLUSTRATIVE VALUES ONLY/);
  assert.match(html, /研究问题/);
  assert.match(html, /height: 100%; box-sizing: border-box/);
  for (const mode of ["editable", "screenshots"]) {
    const path = `examples/research-deck/pptx${mode === "screenshots" ? "-screenshots" : ""}.json`;
    const input = JSON.parse(await read(path));
    assert.equal(input.mode, mode);
    assert.equal(input.width / input.height, 16 / 9);
    assert.equal(input.resetTransformSelector, "deck-stage");
    assert.equal(input.slides.length, 3);
    input.slides.forEach((slide, i) => {
      assert.equal(slide.showJs, `document.querySelector('deck-stage').goTo(${i})`);
      assert.equal(slide.selector, "deck-stage > [data-deck-active]");
    });
  }
});

test("toolchain installs only its own dependencies and retains vendor/CJK patches", async () => {
  const pkg = JSON.parse(await read("agents/gen-pptx/package.json"));
  const lock = JSON.parse(await read("agents/gen-pptx/package-lock.json"));
  assert.ok(pkg.dependencies.playwright);
  assert.ok(pkg.dependencies.jszip);
  for (const name of Object.keys(lock.packages)) assert.doesNotMatch(name, /(?:^|\/)design(?:\/|$)/);
  for (const file of ["test/cjk-ea-font.test.ts", "test/vendor.test.ts", "test/anim.test.ts",
    "test/anim-render.test.ts", "test/core.test.ts", "test/gradient.test.ts", "test/timing.test.ts",
    "vendor/pptxgenjs/LICENSE", "vendor/pptxgenjs/VENDOR.md", "LICENSE"]) {
    await stat(resolve(root, "agents/gen-pptx", file));
  }
  assert.match(await read("agents/gen-pptx/src/core/fonts.ts"), /eaFontFaceFor/);
  const provenance = await read("PROVENANCE.md");
  assert.match(provenance, /6530033592bf7fa58bc1a5a2a2ad278da45213a9/);
  assert.match(provenance, /Anthropic, PBC/);
  assert.match(provenance, /not MIT/);
});

test("standalone bundler creates a single-file deck and loopback server serves its runtime", async () => {
  const temp = await mkdtemp(join(tmpdir(), "slides-contract-"));
  const server = await serve(root);
  try {
    const path = await standalone(join(temp, "deck.html"));
    const html = await readFile(path, "utf8");
    const markup = html.replace(/<script>[\s\S]*?<\/script>/g, "");
    assert.doesNotMatch(markup, /<script\s+src=/);
    assert.match(html, /customElements\.define\('deck-stage'/);
    assert.equal([...markup.matchAll(/<section\b/g)].length, 3);
    const response = await fetch(server.url + "/examples/research-deck/index.html");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const runtime = await fetch(server.url + "/starter-components/deck-stage.js");
    assert.equal(runtime.status, 200);
    assert.match(await runtime.text(), /class DeckStage/);
    assert.equal((await fetch(server.url + "/missing-file")).status, 404);
    assert.equal((await fetch(server.url + "/%2e%2e%2foutside")).status, 403);
  } finally {
    await server.close();
    await rm(temp, { recursive: true, force: true });
  }
});
