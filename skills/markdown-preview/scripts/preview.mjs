import http from "node:http";
import { watch } from "node:fs";
import { readFile, writeFile, mkdir, stat, readdir } from "node:fs/promises";
import { resolve, dirname, extname, basename, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown, inlineLocalImages, rewritePageLinks, collectLocalImagePaths } from "./render.mjs";
import { buildHtmlDocument, ASSET_PATHS } from "./template.mjs";

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

const IGNORED_DIRS = new Set(["node_modules", ".git", "artifacts", "dist", "__pycache__"]);
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

async function collectFiles(dir, extRe, prioritizeReadme, out = []) {
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
      await collectFiles(full, extRe, prioritizeReadme, out);
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

export async function resolveInputPages(inputs) {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  const entries = [];
  const seenMd = new Set();
  const explicitImages = [];
  const seenImg = new Set();

  for (const item of list) {
    const abs = resolve(item);
    const info = await stat(abs);
    if (info.isDirectory()) {
      const mdFiles = await collectFiles(abs, /\.md$/i, true);
      if (mdFiles.length) {
        for (const f of mdFiles) {
          if (!seenMd.has(f)) {
            seenMd.add(f);
            entries.push({ type: "markdown", absPath: f });
          }
        }
      } else {
        const imgFiles = await collectFiles(abs, IMAGE_EXT_RE, false);
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
    const absTarget = resolve(pageDir, decodeURIComponent(rawPath));
    if (absTarget !== serveRoot && !absTarget.startsWith(serveRoot + sep)) return full;
    const relFromRoot = relative(serveRoot, absTarget).split(sep).map(encodeURIComponent).join("/");
    return `${prefix}/_file/${relFromRoot}${rest}${suffix}`;
  });
}

async function renderPages(inputs, opts = {}) {
  const entries = await resolveInputPages(inputs);
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

  const pathToPageUrl = new Map();
  entries.forEach((entry, index) => {
    if (entry.type === "markdown") {
      pathToPageUrl.set(entry.absPath, {
        index,
        href: standalone ? `#p=${index}` : `/?p=${index}`,
      });
    }
  });

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

    const rendered = renderMarkdown(source, { fallbackTitle });
    for (const imgPath of collectLocalImagePaths(rendered.html, baseDir)) {
      watchedFiles.add(imgPath);
    }

    rendered.html = rewritePageLinks(rendered.html, baseDir, pathToPageUrl);
    if (standalone) {
      rendered.html = await inlineLocalImages(rendered.html, baseDir);
    } else {
      rendered.html = rewriteServerImages(rendered.html, baseDir, serveRoot);
    }
    pages.push(rendered);
  }

  return { entries, pages, serveRoot, watchedFiles };
}

export async function renderFileToHtml(inputs, opts = {}) {
  const { pages } = await renderPages(inputs, opts);
  return buildHtmlDocument({ pages }, opts);
}

export async function exportStandaloneHtml(inputs, outPath) {
  const absOut = resolve(outPath);
  const html = await renderFileToHtml(inputs, { standalone: true, liveReload: false });
  await mkdir(dirname(absOut), { recursive: true });
  await writeFile(absOut, html, "utf8");
  return absOut;
}

export async function startPreviewServer(inputs, opts = {}) {
  const initial = await renderPages(inputs, { standalone: false, root: opts.root });
  const serveRoot = initial.serveRoot;
  const port = opts.port ?? 0;
  const clients = new Set();
  const watchedFiles = new Set(initial.watchedFiles);
  const dirWatchers = new Map();

  let debounceTimer = null;
  const scheduleReload = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      for (const res of clients) {
        res.write("event: reload\ndata: 1\n\n");
      }
    }, 80);
  };

  const syncWatchers = (paths) => {
    for (const p of paths) watchedFiles.add(p);
    const dirs = new Set([...watchedFiles].map((p) => dirname(p)));
    for (const dir of dirs) {
      if (dirWatchers.has(dir)) continue;
      try {
        const w = watch(dir, (_eventType, filename) => {
          if (!filename) {
            scheduleReload();
            return;
          }
          const changed = resolve(dir, filename.toString());
          if (watchedFiles.has(changed)) {
            scheduleReload();
          }
        });
        dirWatchers.set(dir, w);
      } catch {
        // Best-effort watch
      }
    }
  };

  syncWatchers(initial.watchedFiles);

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
        const { pages, watchedFiles: latestWatched } = await renderPages(inputs, {
          standalone: false,
          root: serveRoot,
        });
        syncWatchers(latestWatched);
        const html = await buildHtmlDocument({ pages }, {
          standalone: false,
          liveReload: true,
          activeIndex,
        });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
        return;
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
      if (candidate !== serveRoot && !candidate.startsWith(serveRoot + sep)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const info = await stat(candidate);
      if (!info.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[extname(candidate).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(await readFile(candidate));
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
    close: async () => {
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
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "-o" || a === "--out") args.out = argv[++i];
    else if (a === "-p" || a === "--port") args.port = Number(argv[++i]);
    else if (a === "--root") args.root = argv[++i];
    else if (a === "--serve") args.serve = true;
    else if (a === "--detach" || a === "-d") args.detach = true;
    else if (!a.startsWith("-")) args.files.push(a);
  }
  return args;
}

async function spawnDetached(args) {
  const { spawn } = await import("node:child_process");
  const childArgs = [fileURLToPath(import.meta.url), ...args.files.map((f) => resolve(f)), "--port", String(args.port)];
  if (args.root) childArgs.push("--root", resolve(args.root));
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
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.files.length) {
    console.log(
      "Usage: node scripts/preview.mjs <file.md | image | dir>... [--out <output.html>] [--serve] [--detach] [--port 4321] [--root <dir>]"
    );
    process.exit(args.help ? 0 : 1);
  }

  if (args.detach) {
    const info = await spawnDetached(args);
    console.log(JSON.stringify(info));
    process.exit(0);
  }

  if (args.out) {
    const out = await exportStandaloneHtml(args.files, args.out);
    if (!args.serve) {
      console.log(JSON.stringify({ out }));
    }
  }

  if (!args.out || args.serve) {
    const server = await startPreviewServer(args.files, { port: args.port, root: args.root });
    console.log(JSON.stringify({ url: server.url, pid: process.pid, files: server.files }));
  }
}
