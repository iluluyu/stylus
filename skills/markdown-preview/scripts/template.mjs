import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReviewRail, documentPicker, documentsContent, safeJson, workspaceCss } from "./workspace.mjs";

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NODE_MODULES = resolve(SKILL_DIR, "node_modules");

export const ASSET_PATHS = {
  katexCss: resolve(NODE_MODULES, "katex/dist/katex.min.css"),
  katexFontsDir: resolve(NODE_MODULES, "katex/dist/fonts"),
  hljsCss: resolve(NODE_MODULES, "highlight.js/styles/github.min.css"),
  mermaidJs: resolve(NODE_MODULES, "mermaid/dist/mermaid.min.js"),
  chartJs: resolve(NODE_MODULES, "chart.js/dist/chart.umd.min.js"),
};

let cachedInlineKatexCss = null;

export async function getInlinedKatexCss() {
  if (cachedInlineKatexCss) return cachedInlineKatexCss;
  let css = await readFile(ASSET_PATHS.katexCss, "utf8");
  const fontFiles = await readdir(ASSET_PATHS.katexFontsDir);
  const woff2Map = new Map();

  for (const name of fontFiles) {
    if (!name.endsWith(".woff2")) continue;
    const data = await readFile(resolve(ASSET_PATHS.katexFontsDir, name));
    woff2Map.set(name, `data:font/woff2;base64,${data.toString("base64")}`);
  }

  css = css.replace(/src:([^;}]+)([;}])/g, (_full, sources, endChar) => {
    const woff2Match = sources.match(/url\((?:fonts\/)?([^)]+\.woff2)\)\s*format\(["']woff2["']\)/);
    if (!woff2Match) return `src:${sources}${endChar}`;
    const fileName = woff2Match[1];
    const dataUri = woff2Map.get(fileName);
    if (!dataUri) return `src:${sources}${endChar}`;
    return `src:url("${dataUri}") format("woff2")${endChar}`;
  });

  cachedInlineKatexCss = css;
  return css;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildTocLinksHtml(toc) {
  if (!toc.length) return "";
  const minLevel = Math.min(...toc.map((h) => h.level));
  return toc
    .map((item) => {
      const depth = Math.max(0, item.level - minLevel);
      return `<a class="toc-link depth-${depth}" href="#${escapeHtml(item.id)}" data-target="${escapeHtml(item.id)}">${item.html}</a>`;
    })
    .join("\n          ");
}

function buildSidebar(toc, docs) {
  if (!docs && !toc.length) return "";
  return `<aside class="toc-sidebar" id="toc-sidebar" aria-label="文档导航">
    <div class="toc-scroll">
      <div class="toc-header">
        <span class="toc-title">目录</span>
        <button class="toc-close-btn" id="toc-close-btn" type="button" title="收起目录 (t)">✕</button>
      </div>
      <nav class="toc-nav" id="toc-nav" aria-label="目录">${buildTocLinksHtml(toc) || '<span class="toc-link">本篇无章节</span>'}</nav>
      ${docs ? `<section class="sidebar-documents" aria-labelledby="documents-title">
        <h2 id="documents-title">文档</h2>
        <nav id="documents-list" aria-label="所有文档">${docs}</nav>
      </section>` : ''}
    </div>
  </aside>`;
}

const PAGE_CSS = `
:root {
  --bg-desk: #f5f6f8;
  --bg-paper: #ffffff;
  --bg-subtle: #f8fafc;
  --text-main: #181c23;
  --text-muted: #4b5563;
  --text-faint: #6b7280;
  --border-light: #e2e6ec;
  --border-rule: #181c23;
  --accent: #2563eb;
  --accent-soft: #eff6ff;
  --toc-width: 214px;
  --paper-width: 800px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans", Helvetica, Arial, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  overflow-y: scroll;
  scrollbar-gutter: stable;
  font-size: 14px;
}

body {
  margin: 0;
  overflow-x: clip;
  background: var(--bg-desk);
  color: var(--text-main);
  font-family: var(--font-sans);
  line-height: 1.58;
  -webkit-font-smoothing: antialiased;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 40px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid var(--border-light);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.topbar-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar > div > .icon-btn { flex-shrink: 0; white-space: nowrap; }
#help-btn { width: 30px; padding-inline: 0; font-weight: 650; }
#print-btn { display: block; width: 100%; min-height: 32px; margin-bottom: 10px; border: 0; background: var(--bg-subtle); text-align: start; }
#print-btn:hover { background: var(--accent-soft); color: var(--text-main); }

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn {
  position: relative;
  appearance: none;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  corner-shape: squircle;
  background: var(--bg-paper);
  color: var(--text-muted);
  padding: 3px 9px;
  font-size: 0.84rem;
  font-family: inherit;
  cursor: pointer;
  line-height: 1.4;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover:not(:disabled) {
  border-color: #cbd5e1;
  color: var(--text-main);
  background: var(--bg-subtle);
}

.icon-btn:disabled, .icon-btn[aria-disabled="true"] {
  opacity: 0.42;
  pointer-events: none;
}

.layout {
  width: 100%;
  padding: 16px 20px 48px;
}

.toc-sidebar {
  position: fixed;
  top: 54px;
  left: max(14px, calc(50% - var(--paper-width) / 2 - var(--toc-width) - 16px));
  z-index: 40;
  width: var(--toc-width);
  max-height: calc(100vh - 70px);
  background: var(--bg-paper);
  border: 1px solid var(--border-light);
  border-radius: 13px;
  corner-shape: squircle;
  display: flex;
  flex-direction: column;
}

.toc-scroll {
  overflow-y: auto;
  padding: 8px 6px;
  max-height: calc(100vh - 72px);
}

body.toc-collapsed .toc-sidebar {
  display: none;
}

.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 6px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
}

.toc-title {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.toc-close-btn {
  border: none;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 1px 5px;
  border-radius: 4px;
}

.toc-close-btn:hover {
  background: var(--bg-subtle);
  color: var(--text-main);
}

.toc-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.toc-link {
  display: block;
  padding: 3px 8px;
  border-radius: 7px;
  corner-shape: squircle;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.86rem;
  line-height: 1.38;
  word-break: break-word;
}

.toc-link:hover {
  background: var(--bg-subtle);
  color: var(--text-main);
}

.toc-link.active {
  color: var(--accent);
  background: var(--accent-soft);
}

.toc-link.depth-0 { font-weight: 600; color: var(--text-main); }
.toc-link.depth-0.active { color: var(--accent); }
.toc-link.depth-1 { padding-left: 14px; }
.toc-link.depth-2 { padding-left: 22px; font-size: 0.82rem; }
.toc-link.depth-3 { padding-left: 30px; font-size: 0.79rem; color: var(--text-faint); }

.toc-link .katex {
  font-size: 0.92em;
}

.paper {
  position: relative;
  width: 100%;
  max-width: var(--paper-width);
  margin: 0 auto;
  background: var(--bg-paper);
  border: 1px solid var(--border-light);
  border-radius: 13px;
  corner-shape: squircle;
  padding: 26px 34px 38px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.paper > :first-child {
  margin-top: 0;
}

.paper h1, .paper h2, .paper h3, .paper h4 {
  position: relative;
  color: #111827;
  line-height: 1.28;
  font-weight: 650;
  scroll-margin-top: 56px;
}

.paper h1 {
  font-size: 1.54rem;
  margin: 0 0 1rem;
}

.paper h2 {
  font-size: 1.24rem;
  margin: 1.6rem 0 0.5rem;
}

.paper h3 {
  font-size: 1.08rem;
  margin: 1.05rem 0 0.38rem;
}

.paper h4 {
  font-size: 0.98rem;
  margin: 0.85rem 0 0.32rem;
}

.heading-anchor {
  position: absolute;
  left: -1.3rem;
  color: #cbd5e1;
  text-decoration: none;
  font-weight: 400;
  opacity: 0;
  transition: opacity 0.12s ease;
}

h1:hover .heading-anchor,
h2:hover .heading-anchor,
h3:hover .heading-anchor,
h4:hover .heading-anchor {
  opacity: 1;
}

.heading-anchor:hover {
  color: var(--accent);
}

.paper p {
  margin: 0.58rem 0;
}

.paper a {
  color: var(--accent);
  text-decoration: none;
}

.paper a:hover {
  text-decoration: underline;
}

.paper ul, .paper ol {
  margin: 0.55rem 0;
  padding-left: 1.45rem;
}

.paper li + li {
  margin-top: 0.2rem;
}

.paper blockquote {
  margin: 0.85rem 0;
  color: var(--text-faint);
}

.paper blockquote > :first-child { margin-top: 0; }
.paper blockquote > :last-child { margin-bottom: 0; }

.paper hr {
  border: none;
  border-top: 1px solid var(--border-light);
  margin: 1.4rem 0;
}

.paper img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.9rem auto;
}

.fig-card {
  margin: 0.75rem 0 1.25rem;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  corner-shape: squircle;
  text-align: center;
}

.fig-card img {
  margin: 0 auto;
}

.fig-meta {
  font-size: 0.82rem;
  color: var(--text-faint);
  margin: 0.25rem 0 0.5rem;
  font-family: var(--font-mono);
}

/* Booktabs three-line table (学术三线表) */
.table-wrap {
  width: 100%;
  overflow-x: auto;
  margin: 1rem 0;
}

.paper table {
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  border-top: 1.6px solid var(--border-rule);
  border-bottom: 1.6px solid var(--border-rule);
  font-size: 0.92rem;
  line-height: 1.45;
  background: var(--bg-paper);
}

.paper thead th {
  border-top: none;
  border-left: none;
  border-right: none;
  border-bottom: 0.85px solid var(--border-rule);
  padding: 0.42rem 0.78rem;
  font-weight: 600;
  color: #111827;
  background: transparent;
}

.paper tbody td {
  border: none;
  padding: 0.36rem 0.78rem;
  font-variant-numeric: tabular-nums;
  vertical-align: middle;
}

.paper tbody tr:hover {
  background: rgba(15, 23, 42, 0.024);
}

/* Inline & display math */
.math-display {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0.75rem 0;
  padding: 0.2rem 6px;
  text-align: center;
  scrollbar-width: thin;
}

.math-display .katex-display {
  margin: 0;
}

.katex .katex-mathml {
  left: 0;
  top: 0;
}

.math-error {
  color: #b91c1c;
  background: #fef2f2;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

/* Code blocks */
.paper :not(pre) > code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: #f1f5f9;
  color: #0f172a;
  padding: 0.12em 0.34em;
  border-radius: 3px;
}

.code-block {
  position: relative;
  margin: 0.85rem 0;
  border: 1px solid var(--border-light);
  border-radius: 9px;
  corner-shape: squircle;
  background: #f8fafc;
  overflow: hidden;
}

.code-lang {
  position: absolute;
  top: 5px;
  right: 9px;
  font-size: 0.78rem;
  font-family: var(--font-mono);
  color: var(--text-faint);
  text-transform: uppercase;
  pointer-events: none;
}

.code-block pre {
  margin: 0;
  padding: 0.72rem 0.92rem;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.88rem;
  line-height: 1.48;
}

.code-block pre code.hljs {
  background: transparent;
  padding: 0;
}

/* Mermaid & Chart visualizations */
.figure-block {
  position: relative;
  margin: 1rem 0;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  corner-shape: squircle;
  overflow-x: auto;
}

.mermaid-wrap {
  text-align: center;
}

.mermaid-wrap pre.mermaid {
  width: 100%;
  margin: 0;
  background: transparent;
  text-align: center;
  font-family: var(--font-sans);
}

.mermaid-wrap svg {
  max-width: 100%;
  height: auto !important;
}

.chart-box {
  position: relative;
  width: 100%;
}

.chart-error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-size: 0.88rem;
}

/* Shortcuts popover */
.shortcuts-popover {
  position: fixed;
  top: 48px;
  right: 16px;
  z-index: 60;
  width: 268px;
  background: var(--bg-paper);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  corner-shape: squircle;
  padding: 12px 14px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
  display: none;
}

.shortcuts-popover.open {
  display: block;
}

.shortcuts-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-main);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shortcuts-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 12px;
  font-size: 0.9rem;
  color: var(--text-muted);
  align-items: center;
}

.shortcuts-list kbd {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  background: var(--bg-subtle);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--text-main);
  justify-self: start;
}

@media (max-width: 1240px) {
  .layout {
    padding: 14px 12px 40px;
  }
  .paper {
    padding: 22px 24px 32px;
  }
  .toc-sidebar {
    left: 12px;
    top: 48px;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
  }
  body:not(.toc-open-mobile) .toc-sidebar {
    display: none;
  }
}

@media print {
  body {
    background: #ffffff;
  }
  .topbar, .toc-sidebar, .heading-anchor, .shortcuts-popover {
    display: none !important;
  }
  .layout {
    display: block;
    max-width: none;
    padding: 0;
  }
  .paper {
    max-width: none;
    border: none;
    box-shadow: none;
    padding: 0;
  }
  .paper tbody tr:hover {
    background: transparent;
  }
  .figure-block, .table-wrap, pre {
    break-inside: avoid;
  }
}
`;

export async function buildHtmlDocument(input, opts = {}) {
  const { standalone = false, liveReload = false, activeIndex = 0 } = opts;

  // Support either single rendered object or multi-page array
  const pages = Array.isArray(input.pages) ? input.pages : [input];
  const currentIdx = Math.max(0, Math.min(activeIndex, pages.length - 1));
  const current = pages[currentIdx];
  const isMulti = pages.length > 1;
  const anyMermaid = pages.some((p) => p.hasMermaid);
  const anyChart = pages.some((p) => p.hasChart);

  let headStyles = "";
  let bodyScripts = "";

  if (standalone) {
    const katexCss = await getInlinedKatexCss();
    const hljsCss = await readFile(ASSET_PATHS.hljsCss, "utf8");
    headStyles += `<style data-asset="katex">\n${katexCss}\n</style>\n<style data-asset="hljs">\n${hljsCss}\n</style>\n`;

    if (anyMermaid) {
      const mermaidJs = await readFile(ASSET_PATHS.mermaidJs, "utf8");
      bodyScripts += `<script data-asset="mermaid">\n${mermaidJs}\n</script>\n`;
    }
    if (anyChart) {
      const chartJs = await readFile(ASSET_PATHS.chartJs, "utf8");
      bodyScripts += `<script data-asset="chartjs">\n${chartJs}\n</script>\n`;
    }
  } else {
    headStyles += `<link rel="stylesheet" href="/_preview-assets/katex/katex.min.css">\n`;
    headStyles += `<link rel="stylesheet" href="/_preview-assets/hljs.css">\n`;
    if (current.hasMermaid) {
      bodyScripts += `<script src="/_preview-assets/mermaid.min.js"></script>\n`;
    }
    if (current.hasChart) {
      bodyScripts += `<script src="/_preview-assets/chart.umd.min.js"></script>\n`;
    }
  }

  const hrefFor = (index) => standalone ? `#p=${index}` : `/?p=${index}`;
  const sidebarHtml = buildSidebar(current.toc, isMulti ? documentsContent(pages, currentIdx, hrefFor) : '');
  const hasSidebar = Boolean(sidebarHtml);
  const review = !standalone && liveReload && Boolean(current.doc);
  const railHtml = review ? buildReviewRail(current) : '';
  const workspace = isMulti || review;

  const titleHtml = isMulti
    ? documentPicker(pages, currentIdx, hrefFor)
    : `<span class="topbar-title" id="topbar-title">${escapeHtml(current.title)}</span>`;

  const pagerHtml = isMulti ? `<nav class="page-stepper" aria-label="顺序阅读">
    ${[-1, 1].map((step) => {
      const target = currentIdx + step;
      const label = step < 0 ? '上一篇' : '下一篇';
      const enabled = Boolean(pages[target]);
      return `<a class="page-step" data-step="${step}"${enabled ? ` href="${hrefFor(target)}"` : ' role="link" aria-disabled="true"'} aria-label="${label}" title="${escapeHtml(enabled ? pages[target].title : label)}"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${step < 0 ? 'm7.5 2.5-3.5 3.5 3.5 3.5' : 'm4.5 2.5 3.5 3.5-3.5 3.5'}"/></svg></a>`;
    }).join(`<span id="page-indicator" aria-live="polite" aria-atomic="true">${currentIdx + 1}/${pages.length}</span>`)}
  </nav>` : '';

  const standaloneTemplates = standalone && isMulti
    ? pages
        .map(
          (p, i) =>
            `<template data-page-tpl="${i}">${p.html}</template>\n<template data-toc-tpl="${i}">${buildTocLinksHtml(p.toc) || '<span class="toc-link">本篇无章节</span>'}</template>\n<template data-documents-tpl="${i}">${documentsContent(pages, i, hrefFor)}</template>`
        )
        .join("\n")
    : "";

  const pagesMetaJson = standalone && isMulti
    ? `<script>window.__MD_PAGES__=${safeJson(pages.map((p) => ({ title: p.title })))};</script>`
    : "";

  const clientInitScript = `
<script>
(function () {
  // ---- Font size adjustment (- / = / 0) ----
  var BASE_FONT_KEY = "md-preview-font-px";
  var defaultFontPx = 14;
  function applyFontPx(px) {
    var clamped = Math.max(10, Math.min(18, Math.round(px * 2) / 2));
    document.documentElement.style.fontSize = clamped + "px";
    try { localStorage.setItem(BASE_FONT_KEY, String(clamped)); } catch (e) {}
    return clamped;
  }
  try {
    var savedPx = Number(localStorage.getItem(BASE_FONT_KEY));
    if (savedPx >= 10 && savedPx <= 18) document.documentElement.style.fontSize = savedPx + "px";
  } catch (e) {}

  // ---- Sidebar toggle ----
  var toggleBtn = document.getElementById("toc-toggle-btn");
  var closeBtn = document.getElementById("toc-close-btn");
  var isSmall = function () { return window.matchMedia("(max-width: 1240px)").matches; };

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      if (isSmall()) {
        document.body.classList.toggle("toc-open-mobile");
        if (rail && document.body.classList.contains('toc-open-mobile')) showRail(false);
      } else {
        document.body.classList.toggle("toc-collapsed");
      }
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      if (isSmall()) {
        document.body.classList.remove("toc-open-mobile");
      } else {
        document.body.classList.add("toc-collapsed");
      }
    });
  }

  // ---- Scroll-spy + click highlight ----
  var clickLockUntil = 0;
  var tocNavEl = document.getElementById("toc-nav") || document.querySelector(".toc-nav");
  var getTocLinks = function () { return Array.prototype.slice.call(document.querySelectorAll("a.toc-link")); };
  var getHeadings = function () { return Array.prototype.slice.call(document.querySelectorAll(".paper h1[id], .paper h2[id], .paper h3[id], .paper h4[id]")); };

  function setActiveToc(id) {
    var links = getTocLinks();
    links.forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-target") === id);
    });
  }

  function bindTocClicks() {
    getTocLinks().forEach(function (a) {
      a.addEventListener("click", function () {
        var id = a.getAttribute("data-target");
        if (id) {
          setActiveToc(id);
          clickLockUntil = Date.now() + 700;
        }
      });
    });
  }

  function syncScroll() {
    var headings = getHeadings();
    if (Date.now() < clickLockUntil || !headings.length) return;
    var atBottom = window.scrollY > 4 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) {
      var lastVisible = headings[headings.length - 1];
      for (var j = headings.length - 1; j >= 0; j--) {
        if (headings[j].getBoundingClientRect().top <= window.innerHeight * 0.72) {
          lastVisible = headings[j];
          break;
        }
      }
      setActiveToc(lastVisible.id);
      return;
    }
    var current = headings[0];
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top <= 96) {
        current = headings[i];
      } else {
        break;
      }
    }
    setActiveToc(current.id);
  }

  var rafPending = false;
  window.addEventListener("scroll", function () {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      syncScroll();
    });
  }, { passive: true });
  bindTocClicks();
  syncScroll();

  // ---- Print & visualizers (Mermaid + Chart.js) ----
  var printBtn = document.getElementById("print-btn");
  printBtn.addEventListener("click", function () { toggleHelp(false); helpBtn.focus(); window.print(); });

  function renderVisuals(scope) {
    var root = scope || document;
    if (typeof mermaid !== "undefined") {
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "loose",
        fontFamily: "inherit",
        themeVariables: {
          background: "#ffffff",
          primaryColor: "#eff6ff",
          primaryBorderColor: "#3b82f6",
          primaryTextColor: "#181c23",
          secondaryColor: "#f8fafc",
          secondaryBorderColor: "#94a3b8",
          tertiaryColor: "#fff7ed",
          lineColor: "#475569",
          textColor: "#181c23",
          fontSize: "14px"
        }
      });
      var nodes = root.querySelectorAll(".mermaid");
      if (nodes.length) {
        mermaid.run({ nodes: nodes }).catch(function (err) {
          console.error("Mermaid render failed:", err);
        });
      }
    }

    if (typeof Chart !== "undefined") {
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = "#334155";
      root.querySelectorAll("canvas.md-chart").forEach(function (canvas) {
        if (canvas._chartDone) return;
        canvas._chartDone = true;
        try {
          var cfg = JSON.parse(canvas.getAttribute("data-chart"));
          new Chart(canvas.getContext("2d"), cfg);
        } catch (err) {
          var box = document.createElement("div");
          box.className = "chart-error";
          box.textContent = "Chart error: " + err.message;
          canvas.replaceWith(box);
        }
      });
    }
  }
  renderVisuals(document);

  // ---- Right rail ----
  var rail = document.getElementById('workspace-rail');
  var railToggle = document.getElementById('rail-toggle');
  function showRail(on) {
    document.body.classList.toggle('rail-collapsed', !on);
    document.body.classList.toggle('rail-open', on);
    railToggle.setAttribute('aria-expanded', String(on));
    if (on && isSmall()) document.body.classList.remove('toc-open-mobile');
    if (!on && rail.contains(document.activeElement)) railToggle.focus();
  }
  var picker = document.getElementById('doc-picker');
  var pickerTrigger = document.getElementById('doc-picker-trigger');
  var pickerPanel = document.getElementById('doc-picker-panel');
  var pickerQuery = document.getElementById('doc-picker-query');
  var pickerLinks = picker ? Array.from(picker.querySelectorAll('[data-picker-key]')) : [];
  function filterDocs() {
    var words = pickerQuery.value.trim().toLowerCase().split(/\\s+/);
    pickerLinks.forEach(function (link) {
      link.hidden = !words.every(function (word) { return link.dataset.pickerKey.includes(word); });
    });
    picker.querySelector('.doc-picker-empty').hidden = pickerLinks.some(function (link) { return !link.hidden; });
  }
  function showPicker(open, restoreFocus) {
    pickerPanel.hidden = !open;
    pickerTrigger.setAttribute('aria-expanded', String(open));
    if (open) {
      if (isSmall()) document.body.classList.remove('toc-open-mobile');
      pickerQuery.value = '';
      filterDocs();
      pickerQuery.focus({ preventScroll: true });
    } else if (restoreFocus) {
      pickerTrigger.focus();
    }
  }
  if (picker) {
    pickerTrigger.addEventListener('click', function () { showPicker(pickerPanel.hidden); });
    pickerQuery.addEventListener('input', filterDocs);
    picker.addEventListener('keydown', function (event) {
      if (pickerPanel.hidden) return;
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        showPicker(false, true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        var visible = pickerLinks.filter(function (link) { return !link.hidden; });
        var index = visible.indexOf(document.activeElement);
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'ArrowDown') visible[Math.min(index + 1, visible.length - 1)]?.focus();
        else if (index > 0) visible[index - 1].focus();
        else pickerQuery.focus();
      } else if (event.key === 'Enter' && event.target === pickerQuery) {
        event.preventDefault();
        pickerLinks.find(function (link) { return !link.hidden; })?.click();
      }
    });
    picker.addEventListener('focusout', function (event) {
      if (event.relatedTarget && !picker.contains(event.relatedTarget)) showPicker(false);
    });
    document.addEventListener('click', function (event) {
      if (!picker.contains(event.target) && !pickerPanel.hidden) showPicker(false);
    });
    pickerPanel.addEventListener('click', function (event) {
      var link = event.target.closest('[data-picker-key]');
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      showPicker(false, true);
      if (link.hasAttribute('aria-current')) {
        event.preventDefault();
      }
    });
  }
  if (rail) {
    railToggle.setAttribute('aria-expanded', String(!isSmall()));
    railToggle.addEventListener('click', function () {
      showRail(isSmall() ? !document.body.classList.contains('rail-open') : document.body.classList.contains('rail-collapsed'));
    });
    document.getElementById('rail-close').addEventListener('click', function () { showRail(false); railToggle.focus(); });
    rail.addEventListener('review:open', function () { showRail(true); });
    rail.addEventListener('review:close', function () { showRail(false); });
  }
  var docsNav = document.getElementById('documents-list');
  if (docsNav) {
    docsNav.addEventListener('click', function (event) {
      var button = event.target.closest('.doc-expand');
      if (!button) return;
      var open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
    });
  }

  // ---- Multi-page navigation (standalone bundle + server mode) ----
  var activePageIdx = ${currentIdx};
  var totalPages = ${pages.length};

  function anchorScroll(hash) {
    if (!hash) return;
    var target;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (_) { return; }
    if (target) target.scrollIntoView();
  }

  function navigatePage(idx, hash, restoring) {
    if (idx < 0 || idx >= totalPages) return;
    if (window.__MD_PAGES__) {
      var tpl = document.querySelector('template[data-page-tpl="' + idx + '"]');
      var tocTpl = document.querySelector('template[data-toc-tpl="' + idx + '"]');
      var paperEl = document.querySelector(".paper");
      if (!tpl || !paperEl) return;
      if (!restoring) history.pushState(null, '', '#p=' + idx + (hash || ''));
      if (idx === activePageIdx) { if (hash) anchorScroll(hash); else window.scrollTo(0, 0); return; }
      activePageIdx = idx;
      paperEl.innerHTML = tpl.innerHTML;
      if (tocNavEl && tocTpl) tocNavEl.innerHTML = tocTpl.innerHTML;
      docsNav.innerHTML = document.querySelector('template[data-documents-tpl="' + idx + '"]').innerHTML;
      if (isSmall()) document.body.classList.remove('toc-open-mobile');
      var meta = window.__MD_PAGES__[idx];
      if (meta) {
        document.title = meta.title;
        document.getElementById('topbar-title').textContent = meta.title;
        pickerTrigger.setAttribute('aria-label', '切换文档：' + meta.title);
      }
      pickerLinks.forEach(function (link) {
        if (Number(link.dataset.pageIdx) === idx) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      document.getElementById('page-indicator').textContent = (idx + 1) + '/' + totalPages;
      document.querySelectorAll('.page-step').forEach(function (link) {
        var target = idx + Number(link.dataset.step);
        if (target >= 0 && target < totalPages) {
          link.href = '#p=' + target;
          link.title = window.__MD_PAGES__[target].title;
          link.removeAttribute('aria-disabled');
          link.removeAttribute('role');
        } else {
          link.removeAttribute('href');
          link.setAttribute('aria-disabled', 'true');
          link.setAttribute('role', 'link');
          link.title = link.getAttribute('aria-label');
        }
      });
      if (!pickerPanel.hidden) showPicker(false);
      bindTocClicks();
      renderVisuals(paperEl);
      if (hash) anchorScroll(hash); else window.scrollTo(0, 0);
      syncScroll();
    } else {
      window.location.href = "/?p=" + idx + (hash || "");
    }
  }

  if (totalPages > 1) {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href]');
      if (!a) return;
      if (a.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
      if (!window.__MD_PAGES__) return;
      var href = a.getAttribute('href');
      var match = /^#p=(\\d+)(#.*)?$/.exec(href);
      if (match) { e.preventDefault(); navigatePage(Number(match[1]), match[2] || ''); }
      else if (href.startsWith('#') && href.length > 1) { e.preventDefault(); navigatePage(activePageIdx, href); }
    });
    if (window.__MD_PAGES__) {
      var restorePage = function () {
        var match = /^#p=(\\d+)(#.*)?$/.exec(location.hash);
        navigatePage(match ? Number(match[1]) : 0, match ? match[2] || '' : location.hash, true);
      };
      window.addEventListener('hashchange', restorePage);
      window.addEventListener('popstate', restorePage);
      if (location.hash) restorePage();
    }
  }

  // ---- Keyboard shortcuts & help popover ----
  var helpBtn = document.getElementById("help-btn");
  var popover = document.getElementById("shortcuts-popover");
  function toggleHelp(force) {
    if (!popover) return;
    var next = typeof force === "boolean" ? force : !popover.classList.contains("open");
    popover.classList.toggle("open", next);
    helpBtn.setAttribute('aria-expanded', String(next));
    if (next) printBtn.focus({ preventScroll: true });
  }
  helpBtn.addEventListener('click', function () { toggleHelp(); });
  popover.addEventListener('focusout', function (e) {
    if (e.relatedTarget && !popover.contains(e.relatedTarget) && e.relatedTarget !== helpBtn) toggleHelp(false);
  });
  document.addEventListener("click", function (e) {
    if (popover && popover.classList.contains("open") && !popover.contains(e.target) && e.target !== helpBtn) {
      toggleHelp(false);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement && document.activeElement.isContentEditable)) return;

    if (e.key === "Escape") {
      if (popover.classList.contains('open')) {
        toggleHelp(false);
        helpBtn.focus();
      }
      return;
    }
    if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
      e.preventDefault();
      toggleHelp();
      return;
    }
    if (e.key === "t") {
      if (toggleBtn) toggleBtn.click();
    } else if (e.key === "j") {
      window.scrollBy({ top: 240, behavior: "smooth" });
    } else if (e.key === "k") {
      window.scrollBy({ top: -240, behavior: "smooth" });
    } else if (e.key === "g") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (e.key === "G") {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    } else if (e.key === "[" && totalPages > 1 && activePageIdx > 0) {
      e.preventDefault();
      navigatePage(activePageIdx - 1, "");
    } else if (e.key === "]" && totalPages > 1 && activePageIdx < totalPages - 1) {
      e.preventDefault();
      navigatePage(activePageIdx + 1, "");
    } else if (e.key === "-" || e.key === "_") {
      var cur = parseFloat(getComputedStyle(document.documentElement).fontSize) || defaultFontPx;
      applyFontPx(cur - 1);
    } else if (e.key === "=" || e.key === "+") {
      var cur2 = parseFloat(getComputedStyle(document.documentElement).fontSize) || defaultFontPx;
      applyFontPx(cur2 + 1);
    } else if (e.key === "0") {
      applyFontPx(defaultFontPx);
    }
  });
})();
</script>`;

  const liveReloadScript = liveReload
    ? `
<script>
(function () {
  var key = "md-preview-scroll:" + location.pathname + location.search;
  var saved = sessionStorage.getItem(key);
  if (saved !== null) {
    window.scrollTo(0, Number(saved));
    sessionStorage.removeItem(key);
  }
  var es = new EventSource("/_events");
  es.addEventListener("reload", function () {
    if (document.body.classList.contains('review-has-draft') || document.body.classList.contains('review-picking')) {
      var status = document.getElementById('review-status');
      if (status) status.textContent = '源文已更新。可先保留草稿，刷新后重新选取位置。';
      return;
    }
    sessionStorage.setItem(key, String(window.scrollY));
    location.reload();
  });
})();
</script>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(current.title)}</title>
${headStyles}<style>
${PAGE_CSS}
${workspace ? await workspaceCss : ''}
</style>
</head>
<body>
  <header class="topbar${workspace ? ' workspace-topbar' : ''}">
    <div class="topbar-left">
      ${hasSidebar ? `<button class="icon-btn" id="toc-toggle-btn" type="button" title="切换导航 (t)">目录</button>` : ""}
      ${titleHtml}
    </div>
    <div class="topbar-actions">
      ${pagerHtml}
      ${railHtml ? `<button type="button" class="icon-btn" id="rail-toggle" aria-controls="workspace-rail">批注</button>` : ''}
      <button class="icon-btn" id="help-btn" type="button" aria-label="更多操作" title="更多操作" aria-expanded="false" aria-controls="shortcuts-popover">···</button>
    </div>
  </header>
  <div class="shortcuts-popover" id="shortcuts-popover">
    <button class="icon-btn" id="print-btn" type="button">打印 / PDF</button>
    <div class="shortcuts-title">快捷键</div>
    <div class="shortcuts-list">
      <kbd>t</kbd><span>展开 / 收起目录</span>
      <kbd>j</kbd> / <kbd>k</kbd><span>向下 / 向上滚动</span>
      <kbd>g</kbd> / <kbd>G</kbd><span>回到顶部 / 跳到底部</span>
      ${isMulti ? `<kbd>[</kbd> / <kbd>]</kbd><span>上一页 / 下一页</span>` : ""}
      <kbd>-</kbd> / <kbd>=</kbd> / <kbd>0</kbd><span>缩小 / 放大 / 重置字号</span>
      <kbd>?</kbd><span>显示 / 关闭此面板</span>
    </div>
  </div>
  <main class="layout${workspace ? ' workspace-layout' : ''}${review ? ' workspace-live' : ''}">
    ${sidebarHtml}
    <article class="paper">
      ${current.html}
    </article>
    ${railHtml}
  </main>
  ${review ? '<button type="button" id="quote-shortcut" aria-label="批注选区" aria-controls="review-draft" hidden><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.4" aria-hidden="true"><path d="M2.5 2.5h11v8h-6l-3 3v-3h-2z"/></svg>批注</button>' : ''}
${standaloneTemplates}${pagesMetaJson}${bodyScripts}${clientInitScript}${review ? '<script src="/_preview-assets/review-client.js"></script>' : ''}${liveReloadScript}
</body>
</html>
`;
}
