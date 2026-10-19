---
name: scifig
description: Publication-grade (Nature / Science / NeurIPS level) scientific figures as editable vector SVG + PDF. Python toolkit for algorithm & optimization results (convergence curves with seed bands, performance profiles, loss landscapes with optimizer trajectories, Pareto fronts, ablations, CD diagrams, benchmark bars, sensitivity heatmaps), a JS library for method schematics / pipelines / flowcharts / framework diagrams, multi-panel assembly, and automatic lint + rendered preview for self-critique. Use it whenever the user wants a paper figure, a results plot, a method overview or algorithm diagram, a vector/SVG figure, "Nature style", or asks to make any plot publication-ready — even a casual "draw me a plot" for a paper or report.
---

# scifig — journal-grade, editable vector figures

AI-made figures look amateur not because the model can't draw, but because it has too much freedom:
default styles, ad-hoc colors, and nobody looks at the result. This skill moves taste into the tools —
size, font sizes, line widths, palette and labeling all have opinionated defaults, every save runs a
lint, and a PNG preview is rendered so you can **actually look at it**. Your job: decide what the figure
must say, pick the right chart, then loop "render → look → fix" until it is clean.

`<skill>` below means the directory containing this file.
Python: `sys.path.insert(0, "<skill>/scripts"); import scifig as sf`.
JS: `import { Diagram } from '<skill>/scripts/diagram/sfd.mjs'` (Node ≥ 18, zero dependencies).

## 1. Before drawing: write a figure brief (30 seconds, do not skip)

Write this in your reply or as a comment at the top of the script:

```
Message:  the one sentence the figure must convince the reader of
          (e.g. "at equal wall-clock time our loss is 10x lower")
Reader:   what does a reviewer see in 3 seconds? The most salient element must be evidence for the message
Charts:   chart type per panel (see chart-catalog / schematic-design)
Size:     single 89 mm / double 183 mm (per target journal), height in mm; panel arrangement
Colors:   method -> color mapping (one mapping for the whole paper); "ours" gets the accent
```

## 2. Routing: read only the docs you need

| Task | Tool | Read first |
|---|---|---|
| Data / results plots (curves, bars, heatmaps, distributions…) | `scripts/scifig/` (Python) | `references/chart-catalog.md`; signatures in `references/python-api.md` |
| Method schematics, flowcharts, framework / algorithm diagrams | `scripts/diagram/sfd.mjs` (JS) | `references/schematic-design.md`; API in `references/diagram-api.md` |
| Combining panels into one figure | `scripts/assemble.py` | `references/composition.md` |
| Colors, color-blind safety, custom palettes, colormaps | `scifig.palette` | `references/color.md` |
| Journal size / font / format requirements | — | `references/journal-specs.md` |
| Visual self-review before delivery | `scripts/check.py` | `references/critique-checklist.md` (**every time**) |
| User will keep editing in Illustrator / Inkscape / Figma | — | `references/editing.md` |

The fastest start is the closest script in `examples/`: copy it, swap data and text. Target look:
`examples/gallery/*.png` (glance at it when unsure what "good" looks like).
`fig_optimization.py` (6-panel results), `fig_benchmarks.py` (bars / bubbles / heatmap / distributions),
`fig_method.mjs` (method overview + zoomed detail), `fig_flowchart.mjs` (auto-laid-out flowchart),
`fig_assembled.py` (schematic + data plot assembled into Figure 1).

## 3. Workflow (loop until clean)

1. **Build at final print size.** Python: `sf.use("nature")`, then `sf.subplots(width="single", height=60)` /
   `sf.mosaic("ab;cd", width="double", height=110)`. JS: `new Diagram({ width: 'double' })`.
   Figures are in mm, text and lines in pt. **Never rescale afterwards** — scaling changes every font size.
2. **Save.** Python `sf.save(fig, "out/fig2")` → `.svg` `.pdf` `.png` + lint.
   JS `d.save("out/fig1.svg")` → `.svg` + lint + automatic `check.py` → `.png`.
   Any other SVG: `python <skill>/scripts/check.py fig.svg --pdf --cvd`.
3. **Look.** Open the PNG with Read (crop and zoom into regions when needed). Go through
   `references/critique-checklist.md`. Lint catches mechanical faults (overlap, clipping, font size, default
   colors); composition, hierarchy and whether the message is visible at a glance are on you.
4. **Fix** lint ERROR/WARN items and whatever you saw, then back to step 2. Done = lint PASS and checklist passed.
5. **Deliver** SVG (editable) + PDF (journals' preferred format) + PNG preview + the generating script.
   Add a caption draft stating n (seeds / repeats), what bands / error bars show, and any statistical test.

## 4. Hard rules (and why)

- **Design at final size**: Nature text is 5–7 pt, panel labels 8 pt bold lowercase. Drawing large and shrinking loses control of font size.
- **One color per method, everywhere**: call `sf.method_colors(names, highlight="Ours")` once and reuse it. Readers track methods across panels by color.
- **"Ours" is the only accent**; baselines get calm colors; ≤ 6 hues; don't use color for what position can show.
- **Direct labels beat legends** (`direct_labels`, `convergence(..., labels="direct")`): no back-and-forth lookup.
- **No titles inside plots**: the message goes in the caption; panels only get a/b/c labels (`sf.panel_labels`).
- **Show variability**: multi-seed results as median + IQR band or mean + 95% CI, never a lone line; state n in the caption.
- **Bars start at 0** (the tool refuses truncated bars); for small differences plot gain over a baseline or a dot plot.
- **Text stays text, graphics stay vector**: no `imshow` heatmaps (use `sf.heatmap`), never outline text.
- **Banned**: jet/rainbow colormaps, 3D bars, shadows, gradients, chart frames, heavy grids, default matplotlib colors.
- **Don't hand-pick colors or fonts**: use `palette` / `method_colors` / diagram `tone`. New colors: read `color.md` and validate with `palette_report`.

## 5. Minimal examples

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

```js
import { Diagram } from '<skill>/scripts/diagram/sfd.mjs';
const d = new Diagram({ width: 'double' });
d.node('x', { label: 'Data $\\mathcal{D}$', tone: 'neutral', x: 0, y: 0 });
d.node('f', { label: 'Model $f_\\theta$', tone: 'primary', right: 'x' });
d.node('u', { label: 'Our update', tone: 'accent', emphasis: true, right: 'f' });
d.chain(['x', 'f', 'u']);
d.edge('u', 'f', { route: 'below', tone: 'accent', label: '$t \\leftarrow t+1$' });
d.save('figures/fig1.svg');                             // lint + PNG preview
```

## 6. Environment

- Python deps: numpy, matplotlib (≥ 3.8), scipy (only for CD-diagram ranks), Pillow (color-vision previews).
- SVG → PNG/PDF: `check.py` tries rsvg-convert, cairosvg, librsvg (ctypes), Inkscape, Playwright, ImageMagick in turn
  and prints install hints if none works (macOS: `brew install librsvg`). Matplotlib figures don't need any of them.
- Fonts: Arial/Helvetica first; on Linux, Liberation Sans / Arimo have Arial's exact metrics, so layout is identical.
  SVGs carry an Arial-first font stack.
- If the user names a target journal or conference, `sf.use("<journal>")` and `Diagram({ journal })` switch widths and
  font sizes; details in `journal-specs.md`.
