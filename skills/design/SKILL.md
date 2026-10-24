---
name: design
description: >-
  Academic illustrations as self-contained HTML — the fast sketchpad for paper
  figures: method overview / Figure 1, concept & mechanism schematics, graphical
  abstracts and TOC graphics, flowcharts & pipelines, architecture diagrams,
  quick interactive data sketches, and talk slide decks. Renders in the browser,
  iterates in a build → preview → fix loop, then exports print-true vector PDF,
  300-dpi PNG, standalone HTML, or PPTX (talk decks). Shares its palette,
  journal size specs, and figure-brief discipline with the sibling scifig skill
  (scifig = final data plots in matplotlib/Typst; this skill = rapid HTML
  illustration and layout). Use whenever the user wants a schematic,
  示意图, 方法总览图, 作图, graphical abstract, TOC graphic, 概念图, 流程图,
  框架图, 算法示意图, a figure sketch or mockup for a paper / thesis / report,
  a scientific illustration, or slides for a talk / defense / 组会 — even a
  casual "帮我画个图" when the target is academic writing. Also use to export a
  deck built with this skill to PowerPoint (PPT/PPTX) — but only decks authored
  here (deck-stage HTML), not arbitrary HTML.
---

# Design — academic illustration workbench (HTML)

You are an expert scientific illustrator producing figure artifacts as HTML on
the user's behalf. This skill wraps a full design methodology forked from
baoyu-design and retargeted at academic figures. It is **harness-agnostic**:
it runs on Claude Code, Cursor, Codex Agent, pi, or any comparable
file-capable agent, resolving each environment's tools from a per-harness
reference doc.

**Position in the stylus toolbox** — three siblings, one pipeline:

| Stage | Skill | Medium |
|---|---|---|
| Draft the paper's text | `scientific-paper-writing` | English prose |
| **Sketch & iterate figures fast (this skill)** | `design` | HTML in the browser |
| Final publication data plots & vector schematics | `scifig` | Python / Typst |

Quick routing: **figures made of data** (curves, bars, heatmaps — numbers from
experiments) belong in scifig; **figures made of ideas** (schematics, method
overviews, graphical abstracts, flowcharts, layout-rich multi-panel stories)
belong here. Many Figure 1s are drafted here and finished in scifig's Typst
schematic library. See [`built-in-skills/academic-figures.md`](built-in-skills/academic-figures.md)
for the full decision matrix — and read that file for **every** figure job;
it carries the journal print specs, the shared palette, and the export rules
that make an HTML sketch publishable.

## How to use this skill

**1. Load the methodology.** Read [`system-prompt.md`](system-prompt.md) (in
this skill's directory) — the core design process and craft standards. Follow
it for the whole job.

**2. Load the academic layer.** Read
[`built-in-skills/academic-figures.md`](built-in-skills/academic-figures.md) —
figure brief, print-true canvas convention (mm / pt / dpi), the scifig-aligned
palette, academic anti-slop rules, and export paths. This is the domain layer
that separates a paper figure from a web page; skipping it produces figures
that look like marketing pages.

**3. Identify your harness and load its tool reference.** Generic tools
(shell, file read/write/edit/search, `gh`) work the same everywhere. The
harness-unique tools — **asking the user a question, previewing/showing a
page, taking screenshots, and debugging/verifying** — differ per environment.
Detect your harness and read the matching doc once:
- Claude Code (you have `AskUserQuestion`, `SendUserFile`, the Claude Preview MCP) → read [`references/claude.md`](references/claude.md).
- Cursor (you have `AskQuestion`, the `cursor-ide-browser` / `user-chrome-devtools` MCP) → read [`references/cursor.md`](references/cursor.md).
- Codex Agent (you have `functions.*`, `tool_search`, Codex Browser/Chrome plugins, or Codex Plan Mode) → read [`references/codex.md`](references/codex.md).
- pi (you have `ask_user_question`, `agent_browser`, `preview_export`) → the Claude Code doc is closest; substitute those tool names.
- Claude Desktop-like or unknown file-capable harness → use the generic workflow in `system-prompt.md`; ask questions in chat, write files normally, serve `designs/` over HTTP, and tell the user the local file path + URL.

**4. Route to the right figure type.** The machine-readable table is
[`project-types.json`](project-types.json); the same routing lives in
`system-prompt.md` → "How to do design work". Short form:

| Request | Load first | Scaffold |
|---|---|---|
| Method overview / Figure 1 / framework / pipeline | `academic-figures.md` + `hi-fi-design.md` | `design-canvas.jsx`, `image-slot.js` |
| Concept / mechanism schematic (示意图) | `academic-figures.md` + `hi-fi-design.md` | `design-canvas.jsx` |
| Graphical abstract / TOC graphic | `academic-figures.md` | `design-canvas.jsx` |
| Flowchart / algorithm diagram | `academic-figures.md` + `data-visualization.md` | `design-canvas.jsx` |
| Interactive data sketch (explore before scifig) | `data-visualization.md` | `chart-stage.js` |
| Talk / defense / 组会 slides (→ PPTX) | `make-a-deck.md` | `deck-stage.js` |
| Poster / one-pager / handout | `make-a-doc.md` | `doc-page.js` |
| Low-fi sketch exploration (many layouts fast) | `wireframe.md` | `design-canvas.jsx` |
| A reusable figure style / lab brand system | `design-system-authoring-guide.md` | `design-canvas.jsx` |

Default when the request is a figure but matches nothing above:
`academic-figures.md` + `hi-fi-design.md` on a `design-canvas.jsx`.

**5. Ask clarifying questions.** For new or ambiguous work, use your harness's
Ask-Question tool before building (see "Asking questions" in
`system-prompt.md`). For figure jobs, confirm at minimum: the **message** the
figure must land, the **target journal/venue** (sets sizes and fonts), single
vs double column, and which elements already exist (data files, photos, logos,
an existing scifig figure to match). If the user has draft text or a paper
repo, read it first — the figure brief comes from the paper.

**6. Set up the output folder.** Default `designs/<descriptive-project-name>/`
(e.g. `designs/fig1-method-overview/`). Create the project folder, write all
HTML deliverables + copied assets there, and never scatter figure files in the
repo root. If the project should follow a figure style system (per-journal or
per-lab tokens), discover with `glob designs/*/_ds_manifest.json` and follow
`built-in-skills/use-design-system.md`. Record each deliverable as an asset
with `agents/record-asset.mjs`. Resuming an existing project? Read its
`_d_meta.json` first.

**7. Build, preview, and verify.** Produce the deliverable following
`system-prompt.md` + `academic-figures.md`, then surface it over HTTP and
confirm it loads cleanly (the exact tools are in your harness reference doc).
Loop **render → screenshot → critique** until the figure survives the
checklist in `academic-figures.md` — then export (PDF / PNG / standalone
HTML / PPTX as appropriate) and hand off to scifig for any data panels that
need publication-grade rendering.

## Notes
- `system-prompt.md` is the single source of truth for craft;
  `built-in-skills/academic-figures.md` is the single source of truth for
  journal specs, palette, and export; `references/<harness>.md` is the single
  source of truth for which tool to call. This file just orchestrates entry.
- Keep deliverables self-contained: copy any asset you reference into the
  project folder.
- Provenance: forked from [JimLiu/baoyu-design](https://github.com/JimLiu/baoyu-design)
  (MIT) — see [`PROVENANCE.md`](PROVENANCE.md) for what was kept, dropped, and
  added, and how to re-sync with upstream.
