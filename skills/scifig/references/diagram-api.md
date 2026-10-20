# scifig.typ API reference (schematics / flowcharts in Typst)

```typ
#import "scifig.typ" as sf                      // or "<skill>/scripts/scifig.typ" — keep the `as sf` form
#show: sf.setup.with(journal: "nature", width: "double")
#let fig = sf.diagram(
  sf.node((0, 0), [Data $cal(D)$], shape: "cylinder", name: <data>),
  sf.node((1, 0), [Model $f_theta$], tone: "primary", name: <model>),
  sf.edge(<data>, <model>),
)
#sf.panel("a", fig)
```
Build: `python <skill>/scripts/check.py fig1.typ` → `fig1.pdf` (real text) + `fig1.svg` (text as outlines) + `fig1.png`
+ lint. Typst ≥ 0.13 (tested 0.15.1); `@preview/fletcher:0.5.8` is downloaded by Typst on first compile.

**Units**: lengths need units (`16pt`, `3mm`). Grid positions are `(column, row)`; rows go down.
**Names**: items get `name: <id>` (a label); groups get a string id (`"inner"`). Edges, groups, badges, zooms,
braces and notes refer to these. Unnamed items get automatic names (fine if nothing refers to them).
**Loops**: build item lists with spreads, e.g. `..ids.enumerate().map(((i, n)) => sf.badge(n, i + 1))`.

## Contents
1. setup · 2. diagram · 3. Positions · 4. Nodes · 5. Glyphs · 6. Edges and loops · 7. Groups and annotations
8. Outside the canvas: legend, panels · 9. Math and text · 10. Colors · 11. Lint · 12. Single-file delivery

## 1. `sf.setup(journal:, width:, height: auto, margin: 3pt, math: "sans")`  (use as `#show: sf.setup.with(...)`)

| Option | Default | Description |
|---|---|---|
| `journal` | `"nature"` | `nature` `science` `cell` `pnas` `ieee` `neurips` `icml` `cvpr`: widths, font sizes, label case (same table as Python `sf.use`) |
| `width` | `"double"` | `"single"` / `"onehalf"` / `"double"` (per journal), a length (`120mm`) or a number in mm |
| `height` | `auto` | page height fits the content; set a length to force it |
| `math` | `"sans"` | `"sans"`: variables in the body font's italic (matches Arial mathtext in the Python plots); `"serif"`: Typst's Computer Modern math (LaTeX look) |

The page is transparent, text is Arial-metric 7 pt (Nature), and sub/superscripts are kept ≥ the journal minimum.
One figure per file; the content is centered on the fixed-width page.

## 2. `sf.diagram(..items, spacing: (18pt, 24pt), debug: false, lint: true)`

Accepts every `sf.*` item below plus plain `fletcher.node` / `fletcher.edge`. `spacing` = (column gap, row gap)
between cells; edge labels want ≥ 20pt column gaps. `debug: 1..3` shows fletcher's grid. Returns content.

## 3. Positions (`pos`, the first argument of every node / glyph)

| Form | Example | Notes |
|---|---|---|
| Grid cell | `(2, 0)` | column 2, row 0. Rows and columns size to their content, so centers align automatically. Fractions (`(1.5, 0)`) are allowed |
| Next to an item | `sf.right-of(<grads>, gap: 24pt)` · `sf.left-of(...)` · `sf.below-of(<loss>, gap: 54pt, dx: -14pt)` · `sf.above-of(...)` | `gap` is edge-to-edge (glyph captions included); `dx` / `dy` nudge (dy > 0 = down). Relative items **float**: they don't stretch grid columns — use them for a compact detail row under a wide main row |

The referenced item must be an `sf` item of the same diagram.

## 4. Nodes `sf.node(pos, label, ..)` and `sf.op(pos, ..)`

| Option | Description |
|---|---|
| `label` | content; math welcome (`[Model $f_theta$]`); `\` breaks a line |
| `sub` | secondary line (6 pt grey) under the label |
| `shape` | `"rect"` (default, G2 rounded) `"pill"` `"circle"` `"ellipse"` `"diamond"` `"cylinder"` `"doc"` `"io"` `"hexagon"` `"plain"` (no frame) |
| `tone` | `"neutral"` `"primary"` `"accent"` `"secondary"` `"loss"` `"warm"` `"cool"`, a palette key (`"blue"`…) or a color |
| `emphasis` | `true` = the key new component: thicker border, deeper fill, bold |
| `bold` / `dashed` | bold text / dashed border (optional or inference-only components) |
| `width`, `height` | fixed size (default: fit the text, min 30 × 17 pt); `pad-x`, `pad-y` (6pt) |
| `text-align` | `center` (default) or `left` for multi-line descriptions |
| `fill`, `stroke`, `stroke-width`, `radius` | manual overrides (avoid). `radius` is the **visual** radius (2.5pt) |
| `corner`, `smoothing` | `"g2"` (default, curvature-continuous iOS/Figma corners) or `"circular"`; `smoothing` 0–1 (0.6). The drawn G2 radius is `radius × 1.3` (`sf.g2-scale`) because G2 corners read tighter |

`sf.same-size((<a>, <b>, <c>), dim: "width" | "height" | "both")` — largest wins.
`sf.op(pos, symbol: "+" | "x" | "." | [σ] | $dot.o$, d: 10pt, tone:, name:)` — small operator circle.

## 5. Glyphs — `label:` is a caption hanging below (it does not shift the glyph off its row's axis)

| Function | Main options | Use |
|---|---|---|
| `sf.matrix(pos, ..)` | `rows` `cols` `cell: 4.2pt` `values` (2-D, 0–1; negative = empty) `pattern`: `"random"` `"lowrank"` `"diag"` `"band"` `"sparse"` `"causal"` `"attention"`; `seed` `tone` | weights, Hessians, attention, covariance |
| `sf.vector(pos, ..)` | `n` `orient: "v"` / `"h"` `values` `cell` `tone` | embeddings, parameters, gradients |
| `sf.tensor(pos, ..)` | `depth` `sw` `sh` `dx` `dy` `tone` | feature maps, batches, stacked gradient history |
| `sf.plot(pos, ..)` | `series`: arrays or presets `"decay"` `"noisy"` `"rise"` `"sine"` `"bell"` `"step"`; `tones` `width` `height` | schematic loss curves (**not** data plots) |
| `sf.graph(pos, ..)` | `n` or `points` (0–1) `edges` `highlight` (indices) `r` | graph structure, topology |
| `sf.mlp(pos, ..)` | `layers: (3, 4, 4, 2)` `width` `height` | fully connected network |
| `sf.placeholder(pos, ..)` | `width` `height` `body` | photo / screenshot pasted later |

`seed` fixes random patterns, so reruns look identical.

## 6. Edges `sf.edge(..)` and loops `sf.loop(..)`

`sf.edge(from, to, ..)` is fletcher's `edge` with house styling. Endpoints are names (`<model>`), grid
coordinates, or several vertices for an orthogonal route: `sf.edge(<conv>, (1, 5), (1, 1), <sample>)`.

| Option | Description |
|---|---|
| positional content | the label, e.g. `sf.edge(<a>, <b>, $hat(y)$)` (6 pt grey) |
| `label-pos` | `0.3`, or `(segment, 50%)` on multi-vertex edges |
| `label-side` | `left` / `right` of the direction of travel, or `center` (on the line, white background) |
| `style` | `"solid"` `"dashed"` `"dotted"` |
| `tone` / `color` / `width` / `emphasis` | color and width (default 0.75 pt dark grey; `emphasis` = 1.1 pt) |
| `head` / `tail` | `"arrow"` (default head) `"open"` `"dot"` `"bar"` `"none"`; or a fletcher marks string `"<->"`, `"-|>"`… |
| `bend`, `corner`, `shift`, … | any fletcher edge option (`bend: 30deg` curves; `corner: right` makes an L) |

`sf.loop(from, to, side: "below" | "above", depth: auto, clearance: 9pt, ..edge-options)` — feedback / iteration:
leaves `from`, runs under (over) the row, enters `to`. `depth: auto` clears the tallest item between the two ends,
captions included. Loops between group members are enclosed by the group automatically.

Convention: solid = data / control flow; dashed = optional, inference-only or indirect; accent color = new
signals / loops produced by our method.

## 7. Groups and annotations (drawn after layout, from exact positions)

| Function | Description |
|---|---|
| `sf.group(id, members, label:, tone:, dashed:, fill:, pad: 7pt, pad-x:, radius: 4pt, label-pos: "top-left")` | soft tinted container behind members (names, or ids of other groups for nesting); colored square before the label (`label-dot: false` to drop). `fill: white` + `dashed: true` for zoom-detail boxes. `label-pos`: `top-left` `top-right` `top-center` `bottom-left` `bottom-right` |
| `sf.badge(target, n, corner: "top-left", tone:)` | numbered step dot (match Algorithm 1) |
| `sf.zoom(source, detail, pad: 2.5pt)` | dashed outline around `source`, two dashed lines to `detail` (item or group) |
| `sf.brace(members, label:, side: "bottom", offset: 4pt, depth: 4.5pt)` | curly brace; `side`: `bottom` `top` `left` `right` |
| `sf.note(target, body, side: "left", dist: 12pt, italic: true)` | leader line + italic grey note |

## 8. Outside the canvas

| Function | Description |
|---|---|
| `sf.legend(items, gap: 10pt)` | row of keys; items `(tone: "accent", label: [proposed], kind: "box" \| "line" \| "dashed" \| "arrow")` |
| `sf.panel("a", body, align: center)` | bold label at the top-left, body below (lowercase for Nature, uppercase for Science/Cell/PNAS) |
| `sf.panels(..cells, columns: 2, gutter: 3mm, labels: auto)` | grid of labelled panels (`labels: none` if the cells carry labels) |
| `sf.panel-label("a")` | the label alone |

Compose a multi-panel figure with ordinary Typst: `#grid(columns: (89mm, 89mm), column-gutter: 5mm, sf.panel("b",
flow), sf.panel("c", image("panel_c.pdf")))`. `image()` of a matplotlib PDF/SVG stays vector with real text in the
PDF output. See `composition.md`.

## 9. Math and text

- Typst math: `$f_theta$`, `$hat(H)_t^(-1)$`, `$cal(D)_"train"$`, `$theta_(t+1) = theta_t - eta g_t$`, `$nabla$`,
  `$t <- t+1$`, `$x in RR^d$`, `$U_r^top$`, `$cal(O)(d r)$`, `$dots$`, `$lambda I$`. Multi-letter subscripts need
  quotes (`_"train"`) or parentheses (`_(t+1)`); a space separates variables (`d r`).
- `math: "sans"` sets single letters in the sans italic, words and digits upright, symbols from the math font.
- Avoid fractions in figure labels (`1/2` renders at script size); write `1\/2` or rephrase.
- Text is measured by Typst itself, so boxes always fit their text.

## 10. Colors

`sf.palette` (= Python `PALETTES["scifig"]`), `sf.accent`, `sf.ink`, `sf.muted`, `sf.faint`, `sf.tone(name)` →
`(base, fill, fill-strong, soft, stroke, dark)`, `sf.mix(a, b, t)`, `sf.tint(c, t)`, `sf.shade(c, t)` (same
formulas as Python). Brand / journal colors: pass a color as `tone:` (`tone: rgb("#C0392B")`) or edit `palette`
in scifig.typ together with `PALETTES` in palette.py; validate with `sf.palette_report` first.

## 11. Lint

`check.py fig.typ` / `sf.compile_typst` report two layers:
- **geometry** (computed inside `sf.diagram` from exact positions): `overlap`, `group-intrusion`, `group-overlap`,
  `edge-through`, `edge-short`, `crossings` (INFO);
- **PDF** (the actual output): `width`, `height`, `font-min`, `font-max`, `font`, `clipped`, `text-overlap`,
  `line-through-text`, `contrast`, `too-many-hues`, `raster`.
Meanings and fixes: `schematic-design.md` §6.

## 12. Single-file delivery

`python <skill>/scripts/bundle.py fig1.typ` writes `standalone/fig1.typ`: scifig.typ inlined at the top, figure code
below calling `node(...)` instead of `sf.node(...)` (Typst has no inline modules). Deliver that file.
