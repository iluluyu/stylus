import { test } from "node:test";
import assert from "node:assert/strict";
import fs, { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inlineLocalImages, renderMarkdown } from "../scripts/render.mjs";
import { exportStandaloneHtml, startPreviewServer } from "../scripts/preview.mjs";
import { annotationDirectory, createAnnotationStore, collectAnnotations } from "../scripts/annotation-store.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const exampleMd = resolve(root, "examples/research-report.md");
const cli = resolve(root, "scripts/preview.mjs");

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
    assert.match(bundled, /class="toc-title">目录</);
    assert.match(bundled, /id="documents-title">文档</);
    assert.match(bundled, /id="documents-list"/);
    assert.match(bundled, /id="doc-picker-trigger"/);
    assert.doesNotMatch(bundled, /id="workspace-rail"/);
    assert.match(bundled, /id="page-indicator"[^>]*>1\/3</);
    assert.match(bundled, /href="#p=2#results"/);
    assert.match(bundled, /window\.__MD_PAGES__=/);
    assert.match(bundled, /data-page-tpl="0"/);
    assert.match(bundled, /data-page-tpl="2"/);
    assert.match(bundled, /data-page-idx="2"/);

    const server = await startPreviewServer(temp, { port: 0 });
    try {
      const p0 = await (await fetch(server.url + "/?p=0")).text();
      assert.match(p0, /Overview/);
      assert.match(p0, /aria-label="切换文档：Overview"/);
      const p2 = await (await fetch(server.url + "/?p=2")).text();
      assert.match(p2, /Details/);
      assert.match(p2, /aria-label="切换文档：Details"/);
      assert.match(p2, /id="page-indicator"[^>]*>3\/3</);
    } finally {
      await server.close();
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("CLI export uses the explicit root for wiki links and document paths", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "md-root-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const docs = join(temp, "docs");
  await mkdir(docs);
  await writeFile(join(docs, "README.md"), "# A\n\n[[docs/target#Results|Root link]]\n");
  await writeFile(join(docs, "target.md"), "# B\n\n## Results\n");
  const out = join(temp, "export.html");
  const result = spawnSync(process.execPath, [cli, docs, "--root", temp, "--out", out], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const html = await readFile(out, "utf8");
  assert.match(html, /<a class="wiki-link" href="#p=1#results" data-page-idx="1">Root link<\/a>/);
  assert.match(html, /<span class="doc-path">docs\/target\.md<\/span>/);
});

test("inlined images preserve dollar sequences in attributes", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "md-inline-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  await writeFile(join(temp, "figure.svg"), svg);
  const tag = '<img title="$$ $&" src="figure.svg" alt="$$ $& $\' $`">';
  const expected = tag.replace("figure.svg", `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  assert.equal(await inlineLocalImages(`${tag}\n${tag}`, temp), `${expected}\n${expected}`);
});

test("CLI rejects invalid or missing option values with specific diagnostics", () => {
  for (const [flags, message] of [
    [["--annotations", "--since", "nope"], /--since must be a valid date/],
    [["--annotations", "--since"], /Expected --since/],
    [["--port", "NaN"], /--port must be an integer/],
    [["--port", "65536"], /--port must be an integer/],
    [["--port", "-1"], /--port must be an integer/],
    [["--port", "1.5"], /--port must be an integer/],
    [["--port", "--detach"], /Expected --port/],
    [["--reply", "some-id"], /Expected --reply <annotation-id> <text>/],
    [["--reply", "some-id", "   "], /Expected --reply <annotation-id> <text>/],
    [["--root"], /Expected --root/],
  ]) {
    const result = spawnSync(process.execPath, [cli, exampleMd, ...flags], { encoding: "utf8", timeout: 2000 });
    assert.equal(result.status, 1, flags.join(" "));
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /RangeError|\n\s+at /);
  }
});

test("live preview shares a render, invalidates on changes, and checks only the POST target", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "md-cache-"));
  const docs = join(temp, "notes");
  await mkdir(docs);
  const a = join(docs, "README.md");
  const b = join(docs, "other.md");
  await writeFile(a, "# First\n\nParagraph\n");
  await writeFile(b, "# Second\n");
  const reads = [];
  const original = fs.readFile;
  fs.readFile = (path, ...args) => {
    if (path === a || path === b) reads.push(path);
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  const controller = new AbortController();
  let server;
  t.after(async () => {
    controller.abort();
    fs.readFile = original;
    syncBuiltinESMExports();
    await server?.close();
    await rm(temp, { recursive: true, force: true });
  });
  server = await startPreviewServer(docs, { annotationsDir: join(temp, "review") });
  assert.deepEqual(reads.splice(0), [a, b]);
  const get = async (query = "") => {
    const response = await fetch(server.url + "/" + query);
    assert.equal(response.status, 200);
    return response.text();
  };
  const [first, second] = await Promise.all([get(), get("?p=1")]);
  assert.match(first, /<title>First<\/title>/);
  assert.match(second, /<title>Second<\/title>/);
  assert.deepEqual(reads, []);
  const meta = JSON.parse(first.match(/id="review-data">([^<]+)/)[1]);
  const post = () => fetch(server.url + "/_annotations?doc=README.md", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: server.url },
    body: JSON.stringify({ kind: "point", block: meta.blocks[0].id, revision: meta.revision, body: "Note" }),
  });
  assert.equal((await post()).status, 201);
  assert.deepEqual(reads.splice(0), [a]);

  const reader = (await fetch(server.url + "/_events", { signal: controller.signal })).body.getReader();
  await reader.read();
  async function waitForReload() {
    const timeout = setTimeout(() => controller.abort(new Error("Timed out waiting for cache invalidation")), 3000);
    try {
      let message = "";
      while (!message.includes("event: reload")) {
        const { done, value } = await reader.read();
        if (done) throw new Error("Unexpected end of event stream");
        message += Buffer.from(value).toString();
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  await writeFile(a, "# Edited\n\nParagraph\n");
  await waitForReload();
  const rebuilt = await Promise.all([get(), get("?p=1"), get()]);
  assert.match(rebuilt[0], /<title>Edited<\/title>/);
  assert.match(rebuilt[2], /<title>Edited<\/title>/);
  assert.deepEqual(reads.splice(0), [a, b]);
  assert.equal((await post()).status, 409);
  assert.deepEqual(reads, []);

  const added = join(docs, "third.md");
  await writeFile(added, "# Third\n");
  await waitForReload();
  assert.match(await get("?p=2"), /<title>Third<\/title>/);
  await rm(added);
  await waitForReload();
  assert.match(await get("?p=2"), /<title>Second<\/title>/);
});

test("project-local review stays with the repository and is private to the review API", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "md-project-review-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const project = join(temp, "project");
  const docs = join(project, "docs");
  const state = join(project, "design", "review-state");
  await mkdir(docs, { recursive: true });
  await mkdir(join(project, ".git"));
  await writeFile(join(docs, "review.md"), "# Review\n\nA target.\n");
  await mkdir(join(state, "tex"), { recursive: true });
  await writeFile(join(state, "tex", "sources.json"), "{}");
  const server = await startPreviewServer(docs, { root: project });
  try {
    assert.ok(server.annotationsDir.startsWith(join(state, "markdown") + "/"));
    assert.equal((await fetch(server.url + "/_file/design/review-state/tex/sources.json")).status, 403);
    assert.equal((await fetch(server.url + "/_file/docs/review.md")).status, 200);
  } finally {
    await server.close();
  }
  const relocated = join(temp, "relocated");
  await rename(project, relocated);
  assert.equal(annotationDirectory(relocated), server.annotationsDir.replace(project, relocated));
});

test("annotation API validates origin and revision; line anchors survive moved blocks and flag edits", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "md-review-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const file = join(temp, "test.md");
  const source = "---\ntitle: A note\n---\n# Heading\n\nTarget paragraph.\n";
  await writeFile(file, source);
  const storeDir = join(temp, "private");
  const server = await startPreviewServer(file, { annotationsDir: storeDir });
  t.after(() => server.close());
  const html = await (await fetch(server.url)).text();
  const meta = JSON.parse(html.match(/id="review-data">([^<]+)/)[1]);
  const target = meta.blocks.find((b) => b.start === 6);
  assert.equal(target.end, 6);
  const endpoint = server.url + "/_annotations?doc=test.md";
  const payload = { kind: "point", block: target.id, revision: meta.revision, body: "Add a figure" };
  const post = (origin, body) => fetch(endpoint, { method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
  assert.equal((await post("https://another-origin.invalid", payload)).status, 403);
  assert.equal((await post(server.url, { ...payload, revision: "stale" })).status, 409);
  assert.equal((await post(server.url, { ...payload, block: 9999 })).status, 409);
  assert.equal((await post(server.url, { ...payload, body: " " })).status, 400);
  assert.equal((await post(server.url, { ...payload, caret: { offset: -1, before: "", after: "x" } })).status, 400);
  const response = await post(server.url, payload);
  assert.equal(response.status, 201);
  const note = await response.json();
  const store = createAnnotationStore(storeDir);
  assert.equal((await store.list(meta.doc)).length, 1);
  await store.reply(meta.doc, note.id, "Added.");
  const moved = source.replace("Target", "New paragraph.\n\nTarget");
  await writeFile(file, moved);
  assert.equal((await post(server.url, payload)).status, 409);
  const indexed = async (text) => (await collectAnnotations([{ doc: meta.doc, ...renderMarkdown(text, { annotate: true }) }], store))[0];
  assert.equal((await indexed(moved)).location.insertAfterLine, 8);
  const rewritten = await indexed(moved.replace("Target paragraph.", "Rewritten."));
  assert.equal(rewritten.location, null);
  assert.equal(rewritten.original.from, 6);
  assert.equal(rewritten.replies[0].body, "Added.");
  assert.equal((await indexed(moved + "\nTarget paragraph.\n")).location, null);
  assert.equal((await indexed(source.replace("Target paragraph.", "Changed.\n\n## Another section\n\nTarget paragraph."))).location, null);

  const repeated = source + "\nTarget paragraph.\n";
  const page = { doc: "repeated.md", ...renderMarkdown(repeated, { annotate: true }) };
  const repeatedNote = await store.add(page, { ...payload, revision: page.revision });
  assert.equal(repeatedNote.anchor.ambiguous, true);
  const [remaining] = await collectAnnotations([{ doc: page.doc, ...renderMarkdown(source, { annotate: true }) }], store);
  assert.equal(remaining.location, null);
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
