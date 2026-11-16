---
name: markdown-preview
description: Offline academic Markdown & figure web preview with a clean light theme, booktabs three-line tables, build-time KaTeX math rendering, auto-generated TOC, Mermaid diagrams, lightweight JSON charts, and live reload for Markdown and referenced figures. Use whenever the user asks to preview a Markdown report/note or scientific figures in the browser, export Markdown to a standalone offline HTML page, or render research Markdown with three-line tables, equations, and diagrams.
license: MIT
metadata:
  author: iluluyu
  version: "0.1.0"
---

# Markdown Preview (Academic Light + Offline)

Render local scientific Markdown files into a light-theme web view or a self-contained offline `.html` deliverable — with booktabs three-line tables, KaTeX equations, auto-generated TOC sidebar, syntax-highlighted code, Mermaid diagrams, and lightweight Chart.js plots.

## Workflow (agent-driven)

The agent handles setup, launching the preview server, and verifying output — **do not ask the user to run CLI commands**. Return the clickable `http://127.0.0.1:<port>` URL (and `.html` path if export was requested).

1. **Ensure dependencies once**: if `<skill>/node_modules` is missing, run `npm ci --prefix <skill>`.
2. **Launch detached live-reload preview** (single file, multiple files, Markdown directory, or figure/image files/directory — automatically picks a free port if `4321` is occupied, watches both `.md` files and referenced local `.svg`/`.png`/`.jpg` figures, and prints JSON `{ "url", "pid", "files" }`):
   ```bash
   node <skill>/scripts/preview.mjs path/to/report.md --detach
   node <skill>/scripts/preview.mjs path/to/docs/ --detach
   node <skill>/scripts/preview.mjs path/to/figures/ --detach
   node <skill>/scripts/preview.mjs fig1.svg fig2.png --detach
   ```
   Pass `--root <repo-root>` when relative images live above the Markdown file's directory (e.g. `../figures/fig1.png`).
3. **Export standalone offline `.html`** (single page or multi-page bundle into one self-contained `.html` file):
   ```bash
   node <skill>/scripts/preview.mjs path/to/report.md --out path/to/report.html
   node <skill>/scripts/preview.mjs path/to/docs/ --out path/to/handbook.html
   ```
4. **Hand off**: give the user the preview `url` to open directly in their browser (plus the exported `.html` path if created). Keep the server running in the background while the user reviews; stop it later with `kill <pid>` only if asked.

`<skill>` is the directory containing this file. All assets (`katex` CSS + WOFF2 fonts, `highlight.js`, `mermaid`, `chart.js`) run locally from `node_modules/` with zero external CDN requests.

## Supported syntax & conventions

- **Light academic layout & G2 corners**: `14px` compact base typography (`1.58` line-height, CJK/Latin stack), curvature-continuous G2 squircle corners on cards/containers, centered `800px` paper sheet, fixed top-left navigation/TOC sidebar, and `@media print` CSS for clean PDF printing.
- **Multi-page projects**: pass a directory or multiple `.md` files to get a sidebar page switcher, prev/next pagination, and automatic cross-file `.md` link routing — works in both live server mode and single-file offline `.html` bundles.
- **Keyboard shortcuts**: `t` (toggle sidebar), `j`/`k` (scroll), `g`/`G` (top/bottom), `[`/`]` (prev/next page), `-`/`=`/`0` (font size `10px–18px`), `?` (shortcuts help).
- **Booktabs three-line tables**: standard GFM pipe tables automatically render with `1.8px` top/bottom rules, `0.9px` header rule, no vertical lines, and `tabular-nums` alignment.
- **LaTeX math (KaTeX, build-time)**:
  - Inline: `$...$` and `\(...\)` (underscores, subscripts, and backslashes inside math are protected before Markdown parsing; currency like `$5` is left intact).
  - Display: `$$...$$`, `\[...\]`, and `\begin{equation|align|gather|cases|...}...\end{equation|align|gather|cases|...}`.
  - Inside GFM table cells, escape literal vertical bars in math as `\|` (e.g. `$\langle \psi \| \phi \rangle$`).
- **Mermaid diagrams**: standard fenced ```` ```mermaid ```` blocks, rendered offline in a matching light palette.
- **Lightweight data charts**: fenced ```` ```chart ```` blocks accept either a full Chart.js JSON config or a compact shorthand:
  ```json
  {
    "type": "line",
    "title": "Loss vs Iterations",
    "labels": ["0", "50", "100"],
    "xLabel": "Step",
    "yLabel": "Loss",
    "series": [
      { "name": "Baseline", "data": [0.42, 0.14, 0.05] },
      { "name": "Ours", "data": [0.42, 0.02, 0.001] }
    ]
  }
  ```
- **Scientific figures live preview**: pass `.svg`/`.png`/`.jpg` files or an image directory to generate a clean white figure board with per-figure TOC entries; any referenced local figure modified on disk (e.g. by `scifig` / `matplotlib` / `typst`) triggers automatic reload with `Cache-Control: no-store`.

## Verify before handoff

1. Run `node <skill>/scripts/preview.mjs <file.md> --out <out.html>` (or start `--port` for live viewing).
2. If inspecting visually in a headless browser, open the generated file/URL and verify KaTeX equations, three-line tables, TOC links, Mermaid SVGs, and charts render with zero console errors.
3. Deliver the preview URL or exported `.html` path concisely.
