import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { renderMarkdown } from "../scripts/render.mjs";
import { exportStandaloneHtml, startPreviewServer } from "../scripts/preview.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const exampleMd = resolve(root, "examples/research-report.md");

test("protects math underscores, renders KaTeX, preserves currency and code blocks", () => {
  const md = [
    "# 标题 $O(n^2)$",
    "",
    "行内公式 $a_i + b_j = c_{i,j}$ 与价格 $5 和 $10。",
    "",
    "```bash",
    "echo $HOME $a_b",
    "```",
    "",
    "$$",
    "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}",
    "$$",
    "",
    "\\begin{align}",
    "x_1 &= y_1 \\\\",
    "x_2 &= y_2",
    "\\end{align}",
  ].join("\n");

  const res = renderMarkdown(md);
  assert.match(res.html, /class="katex"/);
  assert.match(res.html, /class="math-display"/);
  assert.doesNotMatch(res.html, /<em>i<\/em>/);
  assert.match(res.html, /价格 \$5 和 \$10/);
  assert.match(res.html, /\$HOME/);
  assert.match(res.html, /\$a_b/);
  assert.equal(res.toc.length, 1);
  assert.equal(res.toc[0].level, 1);
});

test("builds unique TOC slugs, booktabs tables, Mermaid blocks, and Chart configs", async () => {
  const source = await readFile(exampleMd, "utf8");
  const res = renderMarkdown(source);
  assert.ok(res.toc.length >= 5);
  assert.equal(res.hasMermaid, true);
  assert.equal(res.hasChart, true);
  assert.match(res.html, /<div class="table-wrap">\s*<table>/);
  assert.match(res.html, /<pre class="mermaid">[\s\S]*A\[&quot;初态制备 \|0⟩⊗n&quot;\] --&gt; B\[&quot;参数化线路 U\(θ\)&quot;\]/);
  assert.match(res.html, /<canvas class="md-chart" data-chart=/);
});

test("exports 100% offline standalone HTML with inlined fonts, scripts, and local images", async () => {
  const temp = await mkdtemp(join(tmpdir(), "md-preview-"));
  try {
    const svgPath = join(temp, "fig.svg");
    const mdPath = join(temp, "note.md");
    const outPath = join(temp, "note.html");
    await writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>', "utf8");
    await writeFile(
      mdPath,
      [
        "# Offline Note",
        "",
        "Inline $x_1 + x_2$ and table:",
        "",
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "![fig](./fig.svg)",
        "",
        "```mermaid",
        "flowchart LR",
        "  A --> B",
        "```",
        "",
        "```chart",
        '{"type":"line","labels":["0","1"],"series":[{"name":"Ours","data":[1,0.2]}]}',
        "```",
      ].join("\n"),
      "utf8"
    );

    await exportStandaloneHtml(mdPath, outPath);
    const html = await readFile(outPath, "utf8");

    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /border-top:\s*1\.6px solid var\(--border-rule\)/);
    assert.match(html, /data:font\/woff2;base64,/);
    assert.match(html, /data:image\/svg\+xml;base64,/);
    assert.match(html, /<script data-asset="mermaid">/);
    assert.match(html, /<script data-asset="chartjs">/);
    assert.match(html, /corner-shape:\s*squircle/);
    assert.match(html, /shortcuts-popover/);
    // Zero external stylesheet/script links
    assert.doesNotMatch(html, /<(?:script|link)\b[^>]+(?:src|href)=["']https?:\/\//i);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("preview server serves rendered HTML, local assets, and blocks path traversal", async () => {
  const server = await startPreviewServer(exampleMd, { port: 0 });
  try {
    const page = await fetch(server.url + "/");
    assert.equal(page.status, 200);
    const body = await page.text();
    assert.match(body, /变分量子优化收敛性实验简报/);
    assert.match(body, /\/_preview-assets\/katex\/katex\.min\.css/);

    for (const asset of [
      "/_preview-assets/katex/katex.min.css",
      "/_preview-assets/katex/fonts/KaTeX_Main-Regular.woff2",
      "/_preview-assets/hljs.css",
      "/_preview-assets/mermaid.min.js",
      "/_preview-assets/chart.umd.min.js",
    ]) {
      const r = await fetch(server.url + asset);
      assert.equal(r.status, 200, asset);
    }

    const forbidden = await fetch(server.url + "/%2e%2e%2fpackage.json");
    assert.equal(forbidden.status, 403);
  } finally {
    await server.close();
  }
});

test("--detach launches background preview server and returns reachable url + pid", async () => {
  const cli = resolve(root, "scripts/preview.mjs");
  const result = spawnSync(process.execPath, [cli, exampleMd, "--detach", "--port", "0"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const info = JSON.parse(result.stdout.trim());
  assert.match(info.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(typeof info.pid, "number");
  try {
    const res = await fetch(info.url + "/");
    assert.equal(res.status, 200);
    assert.match(await res.text(), /变分量子优化收敛性实验简报/);
  } finally {
    process.kill(info.pid);
  }
});

test("multi-page directory preview and standalone bundle support page switcher and cross-links", async () => {
  const temp = await mkdtemp(join(tmpdir(), "md-multipage-"));
  try {
    await mkdir(join(temp, "sub"));
    await writeFile(join(temp, "README.md"), "# Overview\n\nSee [Details](sub/02-details.md#results).\n", "utf8");
    await writeFile(join(temp, "01-method.md"), "# Method\n\nFormula $a_i$.\n", "utf8");
    await writeFile(join(temp, "sub/02-details.md"), "# Details\n\n## Results\n\n| A | B |\n|---|---|\n| 1 | 2 |\n", "utf8");

    const outPath = join(temp, "bundle.html");
    await exportStandaloneHtml(temp, outPath);
    const bundled = await readFile(outPath, "utf8");
    assert.match(bundled, /页面 · Pages \(3\)/);
    assert.match(bundled, /window\.__MD_PAGES__=/);
    assert.match(bundled, /data-page-tpl="0"/);
    assert.match(bundled, /data-page-tpl="2"/);
    assert.match(bundled, /data-page-idx="2"/);

    const server = await startPreviewServer(temp, { port: 0 });
    try {
      const p0 = await (await fetch(server.url + "/?p=0")).text();
      assert.match(p0, /Overview/);
      assert.match(p0, /1 \/ 3/);
      const p2 = await (await fetch(server.url + "/?p=2")).text();
      assert.match(p2, /Details/);
      assert.match(p2, /3 \/ 3/);
    } finally {
      await server.close();
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("supports image directory preview and triggers SSE reload when referenced image updates", async () => {
  const temp = await mkdtemp(join(tmpdir(), "md-figures-"));
  try {
    const svgPath = join(temp, "fig1.svg");
    const mdPath = join(temp, "notes.md");
    await writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="blue"/></svg>', "utf8");

    // 1. Direct image directory preview + standalone export
    const galleryOut = join(temp, "gallery.html");
    await exportStandaloneHtml(temp, galleryOut);
    const galleryHtml = await readFile(galleryOut, "utf8");
    assert.match(galleryHtml, /fig1\.svg/);
    assert.match(galleryHtml, /data:image\/svg\+xml;base64,/);

    // 2. Markdown referencing local image -> watches image + sends SSE reload + Cache-Control: no-store
    await writeFile(mdPath, "# Figures\n\n![fig1](./fig1.svg)\n", "utf8");
    const server = await startPreviewServer(mdPath, { port: 0 });
    try {
      const pageHtml = await (await fetch(server.url + "/")).text();
      assert.match(pageHtml, /\/_file\/fig1\.svg/);

      const imgRes = await fetch(server.url + "/_file/fig1.svg");
      assert.equal(imgRes.status, 200);
      assert.equal(imgRes.headers.get("cache-control"), "no-store");

      const controller = new AbortController();
      const sseRes = await fetch(server.url + "/_events", { signal: controller.signal });
      const reader = sseRes.body.getReader();
      await reader.read(); // initial ": connected"

      // Modify referenced SVG and expect reload event
      await writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="red"/></svg>', "utf8");
      const nextChunk = await Promise.race([
        reader.read().then(({ value }) => Buffer.from(value || []).toString("utf8")),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for image reload event")), 3000)),
      ]);
      assert.match(nextChunk, /event: reload/);
      controller.abort();
    } finally {
      await server.close();
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
