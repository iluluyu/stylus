---
name: tex-preview
description: Review a local LaTeX paper in the browser with PDF ↔ TeX navigation, word/range/region annotations, and Agent review replies using focused source context.
license: MIT
---

# TeX Preview

`<skill>` is this skill's directory. Requires Node.js 22.18+, `latexmk`, `synctex`, and the project's TeX packages. Handle setup, launch, and verification yourself—do not ask the user to run CLI commands.

## Launch

If `<skill>/node_modules` is missing, run `npm ci --prefix <skill>`. Then launch detached:

```sh
node <skill>/scripts/preview.mjs path/to/main.tex --detach [--engine xelatex|lualatex] [--root <dir>]
```

- Pass the real main `.tex` file, `--engine` if not `pdflatex`, and `--root <dir>` when sources live above the main file's directory.
- Poll `<url>/api/state` until `building` is `false` (verify `id` is set and `error` is empty), then give the user the local URL and leave the server running unless asked to stop (`kill <pid>`).
- **State directory (`stateDir`)**: holds notes, replies, and compiled build snapshots. Stays with the project under `designs/rev/tex/<stem>-<hash>` (reuses the nearest `designs/` folder or Design canvas, otherwise `<repo>/designs/rev/tex/...`, or `<root>/designs/rev/tex/...` outside Git; auto-writes `designs/rev/.gitignore`). Pass `--state-dir <dir>` to override the `tex` state root. Old unreferenced builds are pruned automatically on compile while keeping `latest`, the previous build, and any build referenced by a note.
- **Browser UI**: TeX line markers open the movable review window; select text → **添加批注** or use PDF **框选**; drafts persist locally and submit on blur/close; **PDF** / **TEX** jump to targets.

## Process a Review

Reuse the main file and any `--root` / `--state-dir` flags from launch. Read the brief queue first, then fetch only the needed thread or source slice:

```sh
node <skill>/scripts/preview.mjs path/to/main.tex --annotations --brief --status open
node <skill>/scripts/preview.mjs path/to/main.tex --annotation <id>
node <skill>/scripts/preview.mjs path/to/main.tex --source sections/results.tex --lines 20:30
node <skill>/scripts/preview.mjs path/to/main.tex --reply <id> 'Concise edit summary or answer.'
```

- Narrow the brief queue (`--annotations --brief`) with `--file`, `--status open|resolved`, `--limit` (default 10), or `--offset`.
- Thread detail returns the compact anchor, last 2 replies, and 2 surrounding lines by default; pass `--context N` or `--full` only when omitted replies or full anchor data are needed.
- `selection` offsets use 1-based UTF-16 columns with an exclusive end. When `current` is `null` (stale anchor), `context` comes from the original build—re-locate using `source`/`pdf` and the saved quote.
- Check target lines on disk before editing. The server auto-recompiles on save (keeping the last successful PDF on failure); verify the new build via `<url>/api/state` before replying. Leave threads open for the reviewer to resolve unless asked otherwise.
