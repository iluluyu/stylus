import http from "node:http";
import { watch } from "node:fs";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat, readdir, realpath } from "node:fs/promises";
import { resolve, dirname, extname, basename, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown, inlineLocalImages, rewritePageLinks, collectLocalImagePaths } from "./render.mjs";
import { buildHtmlDocument, ASSET_PATHS } from "./template.mjs";
import { reviewClient } from "./workspace.mjs";
import { annotationDirectory, createAnnotationStore, collectAnnotations } from "./annotation-store.mjs";

const within = (dir, path) => path === dir || path.startsWith(dir.endsWith(sep) ? dir : dir + sep);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
};

const IGNORED_DIRS = new Set(["node_modules", ".git", "artifacts", "dist", "__pycache__", "review-state"]);
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

async function collectFiles(dir, extRe, prioritizeReadme, scannedDirs, out = []) {
  scannedDirs?.add(dir);
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => {
    const rank = (e) => {
      if (!e.isDirectory() && prioritizeReadme) {
        const lower = e.name.toLowerCase();
        if (lower === "readme.md" || lower === "index.md") return 0;
      }
      return e.isDirectory() ? 2 : 1;
    };
    const r = rank(a) - rank(b);
    return r !== 0 ? r : a.name.localeCompare(b.name, undefined, { numeric: true });
  });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(full, extRe, prioritizeReadme, scannedDirs, out);
    } else if (extRe.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function commonAncestorDir(paths) {
  if (!paths.length) return process.cwd();
  const dirs = paths.map((p) => dirname(resolve(p)).split(sep));
  const first = dirs[0];
  let len = first.length;
  for (const d of dirs.slice(1)) {
    let i = 0;
    while (i < len && i < d.length && first[i] === d[i]) i++;
    len = i;
  }
  return first.slice(0, len).join(sep) || sep;
}

export async function resolveInputPages(inputs, scannedDirs) {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  const entries = [];
  const seenMd = new Set();
  const explicitImages = [];
  const seenImg = new Set();

  for (const item of list) {
    const abs = resolve(item);
    const info = await stat(abs);
    if (info.isDirectory()) {
      const mdFiles = await collectFiles(abs, /\.md$/i, true, scannedDirs);
      if (mdFiles.length) {
        for (const f of mdFiles) {
          if (!seenMd.has(f)) {
            seenMd.add(f);
            entries.push({ type: "markdown", absPath: f });
          }
        }
      } else {
        const imgFiles = await collectFiles(abs, IMAGE_EXT_RE, false, scannedDirs);
        if (imgFiles.length) {
          entries.push({
            type: "gallery",
            baseDir: abs,
            title: basename(abs) || "Figures Preview",
            imagePaths: imgFiles,
          });
        }
      }
    } else if (IMAGE_EXT_RE.test(abs)) {
      if (!seenImg.has(abs)) {
        seenImg.add(abs);
        explicitImages.push(abs);
      }
    } else {
      if (!seenMd.has(abs)) {
        seenMd.add(abs);
        entries.push({ type: "markdown", absPath: abs });
      }
    }
  }

  if (explicitImages.length) {
    entries.push({
      type: "gallery",
      baseDir: commonAncestorDir(explicitImages),
      title: explicitImages.length === 1 ? basename(explicitImages[0]) : "Figures Preview",
      imagePaths: explicitImages,
    });
  }

  if (!entries.length) {
    throw new Error(`No Markdown or image files found in: ${list.join(", ")}`);
  }
  return entries;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function buildGalleryMarkdown(entry) {
  const lines = [`# ${entry.title}`, ""];
  for (const absImg of entry.imagePaths) {
    const rel = relative(entry.baseDir, absImg).split(sep).join("/");
    let meta = extname(absImg).slice(1).toUpperCase();
    try {
      const st = await stat(absImg);
      meta += ` · ${formatBytes(st.size)}`;
    } catch {
      // ignore stat failure
    }
    const encodedSrc = rel.split("/").map(encodeURIComponent).join("/");
    lines.push(`## ${rel}`, "");
    lines.push(`<div class="fig-meta">${meta}</div>`);
    lines.push(`<div class="fig-card"><img src="${encodedSrc}" alt="${rel}"></div>`, "");
  }
  return lines.join("\n");
}

function rewriteServerImages(html, pageDir, serveRoot) {
  return html.replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (full, prefix, src, suffix) => {
    if (/^(?:https?:|data:|blob:|\/)/i.test(src)) return full;
    const [rawPath, rest = ""] = src.split(/([?#].*)/);
    let absTarget;
    try { absTarget = resolve(pageDir, decodeURIComponent(rawPath)); } catch { return full; }
    if (!within(serveRoot, absTarget)) return full;
    const relFromRoot = relative(serveRoot, absTarget).split(sep).map(encodeURIComponent).join("/");
    return `${prefix}/_file/${relFromRoot}${rest}${suffix}`;
  });
}

async function renderPages(inputs, opts = {}) {
  const scannedDirs = new Set();
  const entries = await resolveInputPages(inputs, scannedDirs);
  const standalone = Boolean(opts.standalone);

  const allDirs = entries.map((e) => (e.type === "markdown" ? dirname(e.absPath) : e.baseDir));
  const rootCandidate = allDirs.reduce((acc, d) => {
    const a = acc.split(sep);
    const b = d.split(sep);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return a.slice(0, i).join(sep) || sep;
  });
  const serveRoot = resolve(opts.root || rootCandidate);

  const hrefFor = (index) => standalone ? `#p=${index}` : `/?p=${index}`;
  const pagesByPath = new Map();

  const watchedFiles = new Set();
  const pages = [];

  for (const entry of entries) {
    const baseDir = entry.type === "markdown" ? dirname(entry.absPath) : entry.baseDir;
    const source = entry.type === "markdown"
      ? await readFile(entry.absPath, "utf8")
      : await buildGalleryMarkdown(entry);

    if (entry.type === "markdown") watchedFiles.add(entry.absPath);
    else entry.imagePaths.forEach((p) => watchedFiles.add(p));

    const fallbackTitle = entry.type === "markdown"
      ? basename(entry.absPath, extname(entry.absPath))
      : entry.title;

    const rendered = renderMarkdown(source, { fallbackTitle, annotate: !standalone && entry.type === "markdown" });
    rendered.path = relative(serveRoot, entry.absPath || entry.baseDir).split(sep).join("/") || entry.title;
    rendered.links = [];
    if (entry.type === "markdown") {
      rendered.doc = rendered.path;
      pagesByPath.set(entry.absPath, { index: pages.length, page: rendered, file: entry.absPath });
    }
    for (const imgPath of collectLocalImagePaths(rendered.html, baseDir)) {
      watchedFiles.add(imgPath);
    }

    if (standalone) {
      rendered.html = await inlineLocalImages(rendered.html, baseDir);
    } else {
      rendered.html = rewriteServerImages(rendered.html, baseDir, serveRoot);
    }
    pages.push(rendered);
  }

  const aliases = new Map();
  for (const target of pagesByPath.values()) {
    for (const name of new Set([target.page.title, basename(target.file, extname(target.file))].map((s) => s.toLowerCase()))) {
      aliases.set(name, aliases.has(name) ? null : target);
    }
  }
  pages.forEach((page, index) => {
    const file = entries[index].absPath;
    if (!file) return;
    const resolveWiki = (name) => {
      if (!name) return pagesByPath.get(file);
      const withExt = /\.md$/i.test(name) ? name : `${name}.md`;
      const relativeTarget = pagesByPath.get(resolve(dirname(file), withExt));
      if (relativeTarget) return relativeTarget;
      const rootTarget = pagesByPath.get(resolve(serveRoot, withExt));
      if (rootTarget) return rootTarget;
      return aliases.get(name.replace(/\.md$/i, "").toLowerCase());
    };
    const links = new Set();
    page.html = rewritePageLinks(page.html, { file, pagesByPath, resolveWiki, hrefFor,
      addLink: (target) => { if (target !== index) links.add(target); } });
    page.links = [...links];
  });
  return { entries, pages, serveRoot, watchedFiles, scannedDirs };
}

export async function renderFileToHtml(inputs, opts = {}) {
  const { pages } = await renderPages(inputs, opts);
  return buildHtmlDocument({ pages }, opts);
}

export async function exportStandaloneHtml(inputs, outPath, opts = {}) {
  const absOut = resolve(outPath);
  const html = await renderFileToHtml(inputs, { standalone: true, liveReload: false, root: opts.root });
  await mkdir(dirname(absOut), { recursive: true });
  await writeFile(absOut, html, "utf8");
  return absOut;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 64 * 1024) {
      req.resume();
      throw Object.assign(new Error("批注请求过大。"), { status: 413 });
    }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw Object.assign(new Error("无效的批注请求。"), { status: 400 }); }
}

export async function startPreviewServer(inputs, opts = {}) {
  const initial = await renderPages(inputs, { standalone: false, root: opts.root });
  const serveRoot = initial.serveRoot;
  const canonicalRoot = await realpath(serveRoot);
  const annotationsDir = annotationDirectory(canonicalRoot, opts.annotationsDir);
  const store = createAnnotationStore(annotationsDir);
  const port = opts.port ?? 0;
  const clients = new Set();
  const dirWatchers = new Map();
  let watchedFiles, scannedDirs;
  let generation = 0;
  let cached, pending;
  let closing = false;

  let debounceTimer = null;
  const invalidate = () => {
    if (closing) return;
    generation++;
    cached = null;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      for (const res of clients) {
        res.write("event: reload\ndata: 1\n\n");
      }
    }, 80);
  };

  function publish(result) {
    ({ watchedFiles, scannedDirs } = result);
    const dirs = new Set([...scannedDirs, ...[...watchedFiles].map((p) => dirname(p))]);
    for (const [dir, watcher] of dirWatchers) {
      if (dirs.has(dir)) continue;
      watcher.close();
      dirWatchers.delete(dir);
    }
    for (const dir of dirs) {
      if (closing || dirWatchers.has(dir)) continue;
      try {
        const watcher = watch(dir, (event, filename) => {
          const name = filename?.toString();
          // Directory inputs can gain or lose Markdown, figures, or entire subdirectories.
          const membershipChange = event === "rename" && scannedDirs.has(dir) &&
            name && !name.startsWith(".") && !IGNORED_DIRS.has(name);
          if (!name || membershipChange || watchedFiles.has(resolve(dir, name))) invalidate();
        });
        watcher.on("error", () => {
          watcher.close();
          dirWatchers.delete(dir);
          invalidate();
        });
        dirWatchers.set(dir, watcher);
      } catch {
        // Best-effort watch (e.g. a referenced image directory does not exist yet).
      }
    }
    const documents = new Map();
    result.pages.forEach((page, i) => {
      if (page.doc) documents.set(page.doc, { page, file: result.entries[i].absPath });
    });
    cached = { pages: result.pages, documents };
    return cached;
  }

  function snapshot() {
    if (cached) return cached;
    // Share a rebuild among concurrent requests and don't publish a render
    // superseded by a watch event while its files were being read.
    pending ??= (async () => {
      while (true) {
        const before = generation;
        const result = await renderPages(inputs, { root: serveRoot });
        if (before === generation) return publish(result);
      }
    })().finally(() => { pending = null; });
    return pending;
  }

  publish(initial);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === "/favicon.ico") {
        res.writeHead(204).end();
        return;
      }

      if (pathname === "/" || pathname === "/index.html") {
        const pageParam = Number(url.searchParams.get("p") || 0);
        const activeIndex = Number.isFinite(pageParam) ? Math.max(0, Math.floor(pageParam)) : 0;
        const { pages } = await snapshot();
        const html = await buildHtmlDocument({ pages }, {
          standalone: false,
          liveReload: true,
          activeIndex,
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
        return;
      }

      if (pathname === "/_annotations") {
        const host = `127.0.0.1:${server.address().port}`;
        if (req.headers.host !== host && req.headers.host !== `localhost:${server.address().port}`) {
          return sendJson(res, 403, { error: "请使用本地预览地址。" });
        }
        const doc = url.searchParams.get("doc");
        try {
          if (req.method === "GET") {
            if (!(await snapshot()).documents.has(doc)) return sendJson(res, 404, { error: "文档不在预览范围内。" });
            return sendJson(res, 200, await store.list(doc));
          }
          if (req.method !== "POST") return sendJson(res, 405, { error: "不支持此方法。" });
          if (req.headers.origin !== `http://${req.headers.host}` || !/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] || "")) {
            return sendJson(res, 403, { error: "只允许预览页面提交批注。" });
          }
          const input = await readJson(req);
          const target = (await snapshot()).documents.get(doc);
          if (!target) return sendJson(res, 404, { error: "文档不在预览范围内。" });
          if (target.page.revision === input.revision) {
            // fs.watch can deliver its event after the POST. Verify only the
            // target source, without rendering or reading any other document.
            const source = await readFile(target.file, "utf8").catch((err) => {
              if (err.code === "ENOENT") return null;
              throw err;
            });
            if (source === null || createHash("sha256").update(source).digest("hex") !== input.revision) {
              invalidate();
              return sendJson(res, 409, { error: "源文件已改变，请刷新后重新选取位置；草稿仍会保留。" });
            }
          }
          const saved = await store.add(target.page, input);
          return sendJson(res, 201, saved);
        } catch (err) {
          return sendJson(res, err.status || 500, { error: err.status ? err.message : "无法读写本地批注，请检查存储路径和权限。" });
        }
      }

      if (pathname === "/_events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(": connected\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }

      if (pathname === "/_preview-assets/review-client.js") {
        const script = await readFile(reviewClient);
        res.writeHead(200, { "Content-Type": MIME[".js"], "Cache-Control": "no-store" });
        return res.end(script);
      }
      if (pathname === "/_preview-assets/katex/katex.min.css") {
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        res.end(await readFile(ASSET_PATHS.katexCss));
        return;
      }
      if (pathname.startsWith("/_preview-assets/katex/fonts/")) {
        const fontName = pathname.slice("/_preview-assets/katex/fonts/".length);
        const fontPath = resolve(ASSET_PATHS.katexFontsDir, fontName);
        if (!fontPath.startsWith(ASSET_PATHS.katexFontsDir + sep)) {
          res.writeHead(403).end("Forbidden");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[extname(fontPath)] || "application/octet-stream" });
        res.end(await readFile(fontPath));
        return;
      }
      if (pathname === "/_preview-assets/hljs.css") {
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        res.end(await readFile(ASSET_PATHS.hljsCss));
        return;
      }
      if (pathname === "/_preview-assets/mermaid.min.js") {
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        res.end(await readFile(ASSET_PATHS.mermaidJs));
        return;
      }
      if (pathname === "/_preview-assets/chart.umd.min.js") {
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        res.end(await readFile(ASSET_PATHS.chartJs));
        return;
      }

      const rel = pathname.startsWith("/_file/") ? pathname.slice("/_file/".length) : pathname.replace(/^\/+/, "");
      const candidate = resolve(serveRoot, rel);
      if (!within(serveRoot, candidate)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const realCandidate = await realpath(candidate);
      const realStore = await realpath(annotationsDir).catch(() => annotationsDir);
      const inReviewState = [relative(serveRoot, candidate), relative(canonicalRoot, realCandidate)]
        .some((file) => file.split(sep).includes("review-state"));
      if (!within(canonicalRoot, realCandidate) || within(annotationsDir, candidate) || within(realStore, realCandidate) || inReviewState) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const info = await stat(realCandidate);
      if (!info.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[extname(candidate).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(await readFile(realCandidate));
    } catch {
      res.writeHead(404).end("Not found");
    }
  });

  await new Promise((ok, fail) => {
    const onError = (err) => {
      if (err.code === "EADDRINUSE" && port !== 0) {
        server.listen(0, "127.0.0.1");
        return;
      }
      fail(err);
    };
    server.on("error", onError);
    server.once("listening", () => {
      server.off("error", onError);
      ok();
    });
    server.listen(port, "127.0.0.1");
  });

  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    files: [...watchedFiles],
    root: serveRoot,
    annotationsDir,
    close: async () => {
      closing = true;
      clearTimeout(debounceTimer);
      for (const w of dirWatchers.values()) w.close();
      dirWatchers.clear();
      for (const client of clients) client.end();
      clients.clear();
      await new Promise((ok, fail) => server.close((err) => (err ? fail(err) : ok())));
    },
  };
}

function parseArgs(argv) {
  const args = { files: [], out: null, port: 4321, root: null, serve: false, detach: false, help: false };
  let i = 0;
  const take = (usage) => {
    const value = argv[++i];
    if (!value?.trim() || value.startsWith("--") || /^-[hdop]$/.test(value)) {
      throw new Error(`Expected ${usage}.`);
    }
    return value;
  };
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      args.files.push(...argv.slice(i + 1));
      break;
    }
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "-o" || a === "--out") args.out = take(`${a} <output.html>`);
    else if (a === "-p" || a === "--port") {
      const value = take(`${a} <port>`);
      if (!/^\d+$/.test(value) || Number(value) > 65535) throw new Error(`${a} must be an integer from 0 to 65535.`);
      args.port = Number(value);
    } else if (a === "--root") args.root = take("--root <dir>");
    else if (a === "--annotations-dir") args.annotationsDir = take("--annotations-dir <dir>");
    else if (a === "--annotations") args.annotations = true;
    else if (a === "--since") {
      const date = new Date(take("--since <ISO date>"));
      if (!Number.isFinite(date.getTime())) throw new Error("--since must be a valid date (e.g. 2026-01-01T00:00:00Z).");
      args.since = date.toISOString();
    } else if (a === "--reply") {
      const usage = "--reply <annotation-id> <text>";
      const id = take(usage);
      const message = take(usage);
      if (message.length > 4000) throw new Error("--reply text must be at most 4000 characters.");
      args.reply = [id, message];
    } else if (a === "--serve") args.serve = true;
    else if (a === "--detach" || a === "-d") args.detach = true;
    else if (a.startsWith("-")) throw new Error(`Unknown option: ${a}.`);
    else args.files.push(a);
  }
  return args;
}

async function spawnDetached(args) {
  const { spawn } = await import("node:child_process");
  const childArgs = [fileURLToPath(import.meta.url), ...args.files.map((f) => resolve(f)), "--port", String(args.port)];
  if (args.root) childArgs.push("--root", resolve(args.root));
  if (args.annotationsDir) childArgs.push("--annotations-dir", resolve(args.annotationsDir));
  if (args.out) childArgs.push("--out", resolve(args.out), "--serve");

  const child = spawn(process.execPath, childArgs, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const info = await new Promise((resolveReady, rejectReady) => {
    let buf = "";
    let errBuf = "";
    const timer = setTimeout(() => rejectReady(new Error(`Timed out waiting for preview server: ${errBuf}`)), 10000);
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      const line = buf.split("\n").find((l) => l.trim().startsWith("{"));
      if (line) {
        clearTimeout(timer);
        resolveReady(JSON.parse(line));
      }
    });
    child.stderr.on("data", (chunk) => { errBuf += chunk.toString("utf8"); });
    child.once("exit", (code) => {
      clearTimeout(timer);
      rejectReady(new Error(`Preview server exited early (${code}): ${errBuf}`));
    });
  });

  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
  return info;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`markdown-preview: ${err.message} See --help.`);
    process.exit(1);
  }
  if (args.help || !args.files.length) {
    console.log(
      "Usage: node scripts/preview.mjs <file.md | image | dir>... [--out <output.html>] [--serve] [--detach] [--port 4321] [--root <dir>] [--annotations-dir <dir>]\n" +
      "Read annotations: same inputs and root/store flags plus --annotations [--since <ISO date>]\n" +
      "Reply: same inputs and root/store flags plus --reply <annotation-id> <text>"
    );
    process.exit(args.help ? 0 : 1);
  }

  if (args.annotations || args.reply) {
    const { pages, serveRoot } = await renderPages(args.files, { root: args.root });
    const dir = annotationDirectory(await realpath(serveRoot), args.annotationsDir);
    const store = createAnnotationStore(dir);
    const annotations = await collectAnnotations(pages, store, args.reply ? undefined : args.since);
    if (args.reply) {
      const [id, message] = args.reply;
      const note = annotations.find((item) => item.id === id);
      if (!note) throw new Error(`Annotation not found in supplied documents: ${id}`);
      console.log(JSON.stringify(await store.reply(note.file, id, message)));
    } else {
      console.log(JSON.stringify({ root: serveRoot, annotationsDir: dir, annotations }, null, 2));
    }
    process.exit(0);
  }

  if (args.detach) {
    const info = await spawnDetached(args);
    console.log(JSON.stringify(info));
    process.exit(0);
  }

  if (args.out) {
    const out = await exportStandaloneHtml(args.files, args.out, { root: args.root });
    if (!args.serve) {
      console.log(JSON.stringify({ out }));
    }
  }

  if (!args.out || args.serve) {
    const server = await startPreviewServer(args.files, { port: args.port, root: args.root, annotationsDir: args.annotationsDir });
    console.log(JSON.stringify({ url: server.url, pid: process.pid, files: server.files, root: server.root, annotationsDir: server.annotationsDir }));
  }
}
