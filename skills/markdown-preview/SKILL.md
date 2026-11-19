---
name: markdown-preview
description: Local Markdown and figure preview with current-document outlines, searchable related notes and backlinks, persistent selection and insertion-point annotations, and Agent handoff. Use for browsing linked Markdown notes, studying or reviewing documents in the browser, collecting annotations to read or reply to later, previewing scientific figures, or exporting offline HTML with KaTeX, booktabs tables, Mermaid, and charts.
license: MIT
metadata:
  author: iluluyu
  version: "0.2.0"
---

# Markdown Preview (Academic Light + Offline)

Preview local Markdown notes and scientific figures in a light academic web view, or export them as a self-contained offline `.html` file—complete with booktabs three-line tables, KaTeX equations, an auto-generated TOC sidebar, syntax-highlighted code, Mermaid diagrams, and Chart.js plots.

`<skill>` refers to the directory containing this file. All assets (`katex` CSS + WOFF2 fonts, `highlight.js`, `mermaid`, `chart.js`) are served locally from `node_modules/` with zero external CDN requests.

## Agent Workflow

Handle setup, server startup, and verification yourself—**do not ask the user to run CLI commands**.

1. **Install dependencies once**: if `<skill>/node_modules` is missing, run:
   ```bash
   npm ci --prefix <skill>
   ```
2. **Launch a detached live-reload preview**:
   ```bash
   node <skill>/scripts/preview.mjs path/to/report.md --detach
   node <skill>/scripts/preview.mjs path/to/docs/ --detach
   node <skill>/scripts/preview.mjs path/to/figures/ --detach
   node <skill>/scripts/preview.mjs fig1.svg fig2.png --detach
   ```
   - Accepts single files, multiple files, Markdown directories, or image files/directories.
   - Automatically picks a free port if `4321` is occupied (override with `--port <n>`).
   - Watches `.md` files and referenced local `.svg`/`.png`/`.jpg`/`.webp`/`.gif` figures for live reload.
   - Pass `--root <repo-root>` when relative image or note links point above the Markdown file's directory (e.g., `../figures/fig1.png`).
   - Prints JSON: `{ "url", "pid", "files", "root", "annotationsDir" }`.
3. **Export standalone offline `.html`** (single file or multi-page bundle into one self-contained `.html`):
   ```bash
   node <skill>/scripts/preview.mjs path/to/report.md --out path/to/report.html
   node <skill>/scripts/preview.mjs path/to/docs/ --out path/to/handbook.html
   ```
4. **Hand off to the user**: return the clickable `http://127.0.0.1:<port>` URL (and the `.html` path if exported). Leave the detached server running while the user reviews; stop it with `kill <pid>` only if asked.

## Supported Features & Syntax

- **Academic light layout**: clean light paper layout with `@media print` styles for PDF export.
- **Multi-page navigation & links**:
  - Pass a directory or multiple `.md` files together. Navigation and backlinks also work in standalone HTML.
  - **Left rail**: shows the current document's outline and the document list with discreet outgoing/backlink counts. Click the chevron beside another document to preview its path, opening excerpt, and outline.
  - **Top bar**: click the current title to search documents by title or path, or use the arrows and position indicator to step through pages in order.
  - **Right rail**: reserved for annotations on the active document.
  - **Link syntax**: supports standard relative Markdown links (`[Results](./report.md#results)`) and wiki links (`[[report#Results|See results]]`). Wiki links resolve relative paths first, then paths from `--root`, then unique titles/basenames. Backlinks are generated automatically.
- **Keyboard shortcuts**: `t` (toggle sidebar), `j`/`k` (scroll), `g`/`G` (top/bottom), `[`/`]` (prev/next page), `-`/`=`/`0` (font size `10px–18px`), `?` (shortcuts help).
- **Booktabs three-line tables**: standard GFM pipe tables span the text column with strong top/bottom rules, a thinner header rule, no vertical borders, and `tabular-nums` alignment.
- **LaTeX math (KaTeX, build-time)**:
  - Inline: `$...$` and `\(...\)` (underscores, subscripts, and backslashes inside math are protected before Markdown parsing; currency like `$5` stays intact).
  - Display: `$$...$$`, `\[...\]`, and `\begin{equation|align|gather|cases|...}...\end{equation|align|gather|cases|...}`.
  - Inside GFM table cells, escape literal vertical bars as `\|` (e.g., `$\langle \psi \| \phi \rangle$`).
- **Mermaid diagrams**: standard fenced ```` ```mermaid ```` blocks, rendered offline in a matching light palette.
- **Lightweight data charts**: fenced ```` ```chart ```` blocks accept a full Chart.js JSON config or this compact shorthand:
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
- **Scientific figures live preview**: passing `.svg`/`.png`/`.jpg`/`.webp`/`.gif` files or an image directory builds a clean white figure board with per-figure TOC entries. Any referenced local figure updated on disk (e.g., by `scifig`, `matplotlib`, or `typst`) reloads automatically with `Cache-Control: no-store`.

## Asynchronous Review & Agent Handoff

### How Users Annotate (Live Server Only)
- **Quote annotation**: select text in any content block and click the floating **批注** button to open the right-hand editor for that quote.
- **Insertion-point annotation**: click **添加插入点**, then click the exact gap between characters (or the end of a paragraph). A thin caret marks the spot while composing or jumping to a saved comment.
- **Navigation & persistence**: clicking a saved card in the right rail jumps to its quote or caret (the right rail only shows annotations for the current file). Saving comments does not call a model; annotations persist in `annotationsDir` outside the source by default (override with `--annotations-dir <dir>`).
- **Standalone HTML**: supports multi-page navigation, but does not include private comments or write to an annotation store.

### How the Agent Reads & Replies
Always pass the same inputs, `--root`, and `--annotations-dir` flags used when launching the server (or a subset of files with the original explicit `--root`).

```bash
node <skill>/scripts/preview.mjs path/to/notes --annotations [--since <ISO-time>]
node <skill>/scripts/preview.mjs path/to/notes --reply <annotation-id> 'Your answer or edit summary.'
```

- **Read before acting**: inspect the source lines referenced by each annotation before answering or editing. Use `--since <ISO-time>` when resuming from a checkpoint.
- **Handle stale locations**: if `location` is `null` (the block changed or became ambiguous), locate the target using the stored quote and original section rather than trusting stale line numbers.
- **Locate insertion points accurately**: use the source line range together with `caret.before` / `caret.after` to find the exact Markdown gap. Note that `caret.offset` counts UTF-16 units in *rendered* block text, not raw Markdown columns. Older block-level points report `insertAfterLine` instead. Preserve inline Markdown and paragraph structure when inserting standalone figures.
- **Confirm scope**: treat annotations as user-provided notes; confirm the intended edit scope against the user's current request before modifying files.
- **Reply & refresh**: replies appear in the browser's annotation thread within a few seconds while the tab is visible. Verify the updated preview, then reply with a concise summary.

> **Quick tryout**: run the preview on `examples/study-notes/` to test a three-page review—try adding a quote comment on page 1 and an insertion point at the end of the short paragraph below the table on page 2.

## Verification Checklist

1. Confirm the preview command succeeds (either returning a live `url` or writing the target `.html` file).
2. If inspecting visually in a headless browser, verify that KaTeX equations, three-line tables, TOC links, Mermaid SVGs, and charts render cleanly with zero console errors.
