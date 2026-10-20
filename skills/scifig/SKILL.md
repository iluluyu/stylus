---
name: scifig
description: Publication-grade (Nature / Science / NeurIPS level) scientific figures as vector PDF + SVG, built with Python (matplotlib) for data plots and Typst for schematics. Python toolkit for algorithm & optimization results (convergence curves with seed bands, performance profiles, loss landscapes with optimizer trajectories, Pareto fronts, ablations, CD diagrams, benchmark bars, sensitivity heatmaps); a Typst library for method schematics / pipelines / flowcharts / framework diagrams with G2-rounded boxes; Typst composition of multi-panel figures; automatic lint + rendered preview for self-critique; one self-contained source file per figure. Use it whenever the user wants a paper figure, a results plot, a method overview, flowchart or algorithm diagram, a vector/SVG/PDF figure, "Nature style", Typst or matplotlib figures, or asks to make any plot publication-ready — even a casual "draw me a plot" for a paper or report.
---

# scifig — journal-grade vector figures (Python + Typst)

AI-made figures look amateur not because the model can't draw, but because it has too much freedom:
default styles, ad-hoc colors, and nobody looks at the result. This skill moves taste into the tools —
size, font sizes, line widths, palette and labeling all have opinionated defaults, every build runs a
lint, and a PNG preview is rendered so you can **actually look at it**. Your job: decide what the figure
must say, pick the right chart or schematic pattern, then loop "render → look → fix" until it is clean.

Two languages, one design system (same palette, journal profiles and rules):
- **Python / matplotlib** for anything with data — `sys.path.insert(0, "<skill>/scripts"); import scifig as sf`.
- **Typst** for schematics and for composing panels — `#import "<skill>/scripts/scifig.typ" as sf` (built on
  `@preview/fletcher`, which Typst downloads on first use).

`<skill>` below means the directory containing this file.

## 1. Before drawing: write a figure brief (30 seconds, do not skip)

Write this in your reply or as a comment at the top of the figure file:

```
Message:  the one sentence the figure must convince the reader of
          (e.g. "at equal wall-clock time our loss is 10x lower")
Reader:   what does a reviewer see in 3 seconds? The most salient element must be evidence for the message
Charts:   chart type / schematic pattern per panel (chart-catalog / schematic-design)
Size:     single 89 mm / double 183 mm (per target journal), height in mm; panel arrangement
Colors:   method -> color mapping (same METHODS order in every figure file); "ours" gets the accent
```

## 2. One figure = one source file (the deliverable)

- **Data figure** → one `.py` (data loading, plotting, `sf.save`). **Schematic** → one `.typ`. **Schematic + data
  panels** → one `.py` that draws the data panels and holds the Typst layout as a string compiled with
  `sf.typst_figure(...)` (see `examples/fig1_overview.py`). Never spread one figure over several scripts or helper
  modules; nothing manual between running the file and getting the PDF.
- **Deliver it standalone**: `python <skill>/scripts/bundle.py figures/fig1.py` (or `.typ`) writes
  `figures/standalone/fig1.py`, which embeds the scifig library, so the single file runs in the user's repo or on
  another machine without this skill. Hand over that file plus its PDF / SVG / PNG.
- The library itself stays split into modules under `scripts/scifig/` (easy to read and search) — only the
  deliverable is merged.

## 3. Routing: read only the docs you need

| Task | Tool | Read first |
|---|---|---|
| Data / results plots (curves, bars, heatmaps, distributions…) | `scripts/scifig/` (Python) | `references/chart-catalog.md`; signatures in `references/python-api.md` |
| Method schematics, flowcharts, framework / algorithm diagrams | `scripts/scifig.typ` (Typst) | `references/schematic-design.md`; API in `references/diagram-api.md` |
| Combining panels (schematic + plots) into one figure | Typst layout (`sf.typst_figure` / `.typ`) | `references/composition.md` |
| Colors, color-blind safety, custom palettes, colormaps | `scifig.palette` / Typst `sf.tone` | `references/color.md` |
| Journal size / font / format requirements | — | `references/journal-specs.md` |
| Visual self-review before delivery | `scripts/check.py` | `references/critique-checklist.md` (**every time**) |
| User will keep editing in Illustrator / Inkscape / Figma | — | `references/editing.md` |

The fastest start is the closest file in `examples/`: copy it, swap data and text. Target look:
`examples/gallery/*.png` (glance at it when unsure what "good" looks like).
`fig_optimization.py` (6-panel results), `fig_benchmarks.py` (bars / bubbles / heatmap / distributions),
`fig_method.typ` (method overview + zoomed detail), `fig_flowchart.typ` (algorithm flowchart),
`fig1_overview.py` (schematics + data panel composed into Figure 1, one file).

## 4. Workflow (loop until clean)

1. **Build at final print size.** Python: `sf.use("nature")`, then `sf.subplots(width="single", height=60)` /
   `sf.mosaic("ab;cd", width="double", height=110)`. Typst: `#show: sf.setup.with(journal: "nature", width: "double")`.
   Figures are in mm, text and lines in pt. **Never rescale afterwards** — scaling changes every font size.
2. **Build + lint.** Python: `sf.save(fig, "out/fig2")` → `.svg` `.pdf` `.png` + lint.
   Typst: `python <skill>/scripts/check.py out/fig1.typ` → `.pdf` `.svg` `.png` + geometry lint + PDF lint.
   Mixed: `sf.typst_figure(LAYOUT, "out/fig1", files={...})` does the same from Python.
   Any other PDF / SVG: `python <skill>/scripts/check.py fig.pdf --cvd`.
3. **Look.** Open the PNG with Read (crop and zoom into regions when needed). Go through
   `references/critique-checklist.md`. Lint catches mechanical faults (overlap, clipping, font size, lines through
   text, default colors); composition, hierarchy and whether the message is visible at a glance are on you.
4. **Fix** lint ERROR/WARN items and whatever you saw, then back to step 2. Done = lint PASS and checklist passed.
5. **Deliver** the standalone source file (`bundle.py`) + PDF (journals' preferred format; editable text) + SVG + PNG.
   Add a caption draft stating n (seeds / repeats), what bands / error bars show, and any statistical test.

## 5. Hard rules (and why)

- **Design at final size**: Nature text is 5–7 pt, panel labels 8 pt bold lowercase. Drawing large and shrinking loses control of font size.
- **One color per method, everywhere**: `sf.method_colors(METHODS, highlight="Ours")` with the same METHODS order in every figure file; Typst `accent` = Python `ACCENT`. Readers track methods across panels by color.
- **"Ours" is the only accent**; baselines get calm colors; ≤ 6 hues; don't use color for what position can show.
- **Direct labels beat legends** (`direct_labels`, `convergence(..., labels="direct")`): no back-and-forth lookup.
- **No titles inside plots**: the message goes in the caption; panels only get a/b/c labels (`sf.panel_labels` in matplotlib, `sf.panel` in Typst — one set per figure).
- **Show variability**: multi-seed results as median + IQR band or mean + 95% CI, never a lone line; state n in the caption.
- **Bars start at 0** (the tool refuses truncated bars); for small differences plot gain over a baseline or a dot plot.
- **Text stays text, graphics stay vector**: no `imshow` heatmaps (use `sf.heatmap`), never outline text; for Typst figures the PDF is the editable master (its SVG draws glyphs as outlines).
- **Banned**: jet/rainbow colormaps, 3D bars, shadows, gradients, chart frames, heavy grids, default matplotlib colors.
- **Don't hand-pick colors or fonts**: use `palette` / `method_colors` / Typst `tone`. New colors: read `color.md` and validate with `palette_report`.

## 6. Minimal examples

```python
import sys; sys.path.insert(0, "<skill>/scripts")
import numpy as np, scifig as sf
sf.use("nature")                                        # profiles: nature|science|cell|pnas|ieee|neurips|icml|cvpr
colors = sf.method_colors(["SGD", "Adam", "Ours"], highlight="Ours")
runs = {m: np.abs(np.random.randn(10, 200)).cumsum(1)[:, ::-1] / 100 for m in colors}   # (seeds, steps)
fig, ax = sf.subplots(width="single", height=58)
sf.convergence(ax, runs, colors=colors, highlight="Ours", band="iqr")
sf.save(fig, "figures/fig2")                            # read the lint, then Read figures/fig2.png
```

```typ
#import "scifig.typ" as sf                              // copy <skill>/scripts/scifig.typ next to the figure
#show: sf.setup.with(journal: "nature", width: "double")
#sf.diagram(
  sf.node((0, 0), [Data $cal(D)$], shape: "cylinder", name: <x>),
  sf.node((1, 0), [Model $f_theta$], tone: "primary", name: <f>),
  sf.node((2, 0), [Our update], tone: "accent", emphasis: true, name: <u>),
  sf.chain((<x>, <f>, <u>)),
  sf.loop(<u>, <f>, tone: "accent", label: $t <- t+1$),
)
// python <skill>/scripts/check.py figures/fig1.typ   -> fig1.pdf / .svg / .png + lint
```

## 7. Environment

- Python: numpy, matplotlib (≥ 3.8), scipy (only CD-diagram ranks), Pillow (previews), pdfplumber (PDF lint).
- Typst ≥ 0.13 (tested 0.15.1): the `typst` CLI (macOS `brew install typst`, Windows `winget install Typst.Typst`,
  Linux release binary or `cargo install typst-cli`) or `pip install typst`. Packages (`@preview/fletcher:0.5.8`)
  download on first compile and are cached. A Typst import of a file outside the figure's folder needs `--root`;
  `check.py` / `sf.compile_typst` set it automatically.
- SVG → PNG/PDF for non-Typst SVGs: `check.py` tries rsvg-convert, cairosvg, librsvg, Inkscape, Playwright, ImageMagick.
- Fonts: Arial/Helvetica first; on Linux, Liberation Sans / Arimo have Arial's exact metrics. `check.py` passes the
  installed one to Typst (`--input sf-font=...`); a bare `typst compile` works too but warns about the missing ones.
- If the user names a target journal or conference, `sf.use("<journal>")` and `sf.setup.with(journal: "<journal>")`
  switch widths and font sizes; details in `journal-specs.md`.
