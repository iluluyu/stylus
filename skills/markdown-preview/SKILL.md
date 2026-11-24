---
name: markdown-preview
description: Preview local Markdown notes and scientific figures in a browser or export offline HTML (KaTeX, booktabs tables, Mermaid, charts). Supports linked multi-page docs, outlines, backlinks, live reload, and persistent selection/insertion-point annotations with Agent replies.
license: MIT
metadata:
  author: iluluyu
  version: "0.2.0"
---

# Markdown Preview

`<skill>` is this skill's directory. Runs fully offline from `<skill>/node_modules` (requires Node.js 22.18+). Handle setup, launch, and verification yourself—do not ask the user to run CLI commands.

## Launch & Export

1. **Install dependencies once** if `<skill>/node_modules` is missing:
   ```bash
   npm ci --prefix <skill>
   ```
2. **Start detached live preview** or **export standalone offline HTML**:
   ```bash
   node <skill>/scripts/preview.mjs <file.md | image | dir>... --detach [--root <dir>] [--port <n>]
   node <skill>/scripts/preview.mjs <file.md | dir>... --out <output.html> [--root <dir>]
   ```
   - Accepts single/multiple `.md` or image files (`.svg`/`.png`/`.jpg`/`.webp`/`.gif`) or directories; watches `.md` files and referenced local figures for live reload; auto-picks a free port if `4321` is occupied.
   - Pass `--root <dir>` when relative image or note links point above the input directory (e.g. `../figures/fig1.png`).
   - Prints `{ "url", "pid", "files", "root", "annotationsDir" }` as JSON. Return the clickable `url` (and `.html` path if exported) and leave the server running unless asked to stop (`kill <pid>`).
   - **State directory (`annotationsDir`)**: stays with the project—`<dir>/review-state/markdown/<scope-id>` inside a `design/` folder or Design canvas (`project/canvas.json`), otherwise `<repo>/design/review-state/markdown/<scope-id>` (or `<root>/design/review-state/markdown/<scope-id>` outside Git). Override with `--annotations-dir <dir>` (e.g. `<canvas-root>/review-state/markdown/<collection>`).

## Authoring & Syntax Notes

- **Multi-page & links**: pass multiple `.md` files or a directory; supports relative Markdown links and wiki links (`[[report#Results|See results]]`, resolved relative → `--root` → unique title/basename) with auto outlines and backlinks (also work in standalone HTML).
- **Math (build-time KaTeX)**: `$...$`, `\(...\)`, `$$...$$`, `\[...\]`, and `\begin{equation|align|gather|cases|...}...\end{...}`. Inside GFM table cells, escape literal pipes as `\|` (e.g. `$\langle \psi \| \phi \rangle$`).
- **Tables, diagrams & charts**: GFM pipe tables render as booktabs three-line tables; ```` ```mermaid ```` renders offline; ```` ```chart ```` accepts full Chart.js JSON or shorthand:
  `{"type":"line","title":"Loss","labels":["0","50"],"xLabel":"Step","yLabel":"Loss","series":[{"name":"Ours","data":[0.42,0.02]}]}`.

## Annotations & Agent Handoff

In live preview (not standalone HTML), users select text → **批注** (quote) or click **添加插入点** → character gap (caret); comments persist in `annotationsDir`.

Read and reply with the same inputs, `--root`, and `--annotations-dir` flags used at launch (or a file subset with the original explicit `--root`):

```bash
node <skill>/scripts/preview.mjs <inputs...> --annotations [--since <ISO-time>]
node <skill>/scripts/preview.mjs <inputs...> --reply <annotation-id> 'Concise answer or edit summary.'
```

- **Read before acting**: inspect the referenced source lines first; use `--since <ISO-time>` when resuming.
- **Stale locations**: when `location` is `null` (block changed or became ambiguous), re-locate using stored `quote` and `original` section rather than stale line numbers.
- **Insertion points**: locate the exact Markdown gap via source line range + `caret.before`/`caret.after` (`caret.offset` counts UTF-16 units in *rendered* block text, not raw Markdown columns; older points report `insertAfterLine`). Preserve inline Markdown and paragraph structure when inserting standalone figures.
- **Scope & reply**: confirm intended edit scope against the user's request before modifying files. Verify the updated preview, then reply concisely (appears in the browser within seconds).
