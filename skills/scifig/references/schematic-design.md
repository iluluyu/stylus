# Schematic design language: method overviews, algorithm flows, framework diagrams

Data plots have right answers; schematics don't — which is why AI-drawn schematics look the most amateur.
Below is a fixed design language and 8 composition patterns. Pick a pattern first, then fill it in.
API details: `diagram-api.md`. Every skeleton here compiles as-is inside a file that starts with
`#import "scifig.typ" as sf` and `#show: sf.setup.with(journal: "nature", width: "double")`.

## Contents
1. Principles · 2. Color semantics · 3. Text · 4. Spacing and alignment · 5. Composition patterns (8, with code)
6. Iterating: what lint messages mean · 7. Don'ts

## 1. Principles

1. **One schematic explains one mechanism.** In 5 seconds the reader should see "input → key step → output" and "where the new thing is". More than ~12 boxes: split panels or use a zoomed detail (pattern B).
2. **Reading order = data-flow direction**: left→right (row 0, double column) or top→bottom (column 0, single column, flowcharts). Feedback / iteration uses a detour loop (`sf.loop(..)`), never a diagonal against the main direction.
3. **A single focal point**: only your new component gets `tone: "accent", emphasis: true` (thicker border, deeper fill, bold). Everything else is supporting cast.
4. **Shapes carry meaning, consistently**: rounded rectangle = processing step / module; cylinder = dataset / storage; pill = start / end / simple op; diamond = decision; small circle (`sf.op`) = operator (⊕ ⊗ σ); matrix / tensor / curve glyphs = intermediate quantities.
5. **Name things precisely with math**: write `[Model $f_theta$]`, not "neural network model"; label edges with variables (`$g_t$`, `$hat(y)$`). Use the paper's notation.
6. **Corners are G2 smooth corners** (curvature-continuous, as in iOS / Figma): softer than circular arcs, no visible seam. `radius` is the *visual* radius (nodes 2.5pt, groups 4pt); it is enlarged 1.3× internally because G2 corners read tighter. Don't enlarge it further. Pills and circles stay true arcs.
7. **Alignment beats decoration**: the grid aligns centers per row and column for free; same-type boxes the same size (`sf.same-size`), uniform gaps (`spacing`). Order alone reads as quality.

## 2. Color semantics (≤ 3 hues + grey)

| tone | color | for |
|---|---|---|
| `neutral` / `data` | white fill, grey stroke | inputs, data, standard operations, context |
| `primary` / `model` | blue | existing standard components (model, optimizer backbone) |
| `accent` / `ours` | vermillion | **your contribution** and the signals / loops it produces |
| `secondary` | green | a second kind of component (teacher, validation branch), only when needed |
| `loss` / `objective` | purple | objectives, losses, constraints |
| `warm` / `cool` | amber / sky | avoid; only when more categories must be distinguished |

- Same color values as the Python plots (`PALETTES["scifig"]`), so "ours" in Figure 1 and the "Ours" curve in Figure 3 are the same vermillion.
- **Text is always near-black / dark grey** (Nature asks for no colored text); color goes on fills, strokes and arrows. A small color square before a group label replaces colored text.
- Arrows default to dark grey; only arrows carrying a *new* signal (feedback, quantities produced by our method) use `tone: "accent"`.

## 3. Text

- Box label 7 pt, sub-label 6 pt grey (`sub:`), group label 6 pt bold, edge label 6 pt grey (Nature sizes; other journals scale). Don't set custom sizes (the PDF lint rejects < 5 pt).
- Sentence case ("Preconditioned step"), no periods, 2–4 words. Needing two lines means the box holds too much — split it or move it to the caption.
- Math: Typst syntax — `$f_theta$`, `$hat(H)_t^(-1)$`, `$cal(D)_"train"$`, `$theta_(t+1)$`, `$nabla cal(L)$`, `$t <- t+1$`. Line break: `\`.

## 4. Spacing and alignment

- Default `spacing: (18pt, 24pt)` (column gap, row gap); edges with labels need 20–24pt column gaps; rows ≥ 24pt apart when a loop or group label runs between them.
- Group padding 7–9pt; keep ≥ 10pt between groups. Nested groups: outer `neutral` + `dashed: true, fill: none`, inner colored.
- Use the grid for the main structure and `sf.right-of` / `sf.below-of` only for compact detail rows (they float and don't stretch columns).
- The page width is the journal column; content is centered and the height trims itself.

## 5. Composition patterns

### A. Pipeline — horizontal, in stages
```typ
#sf.diagram(
  sf.node((0, 0), [Input $x$], name: <in>),
  sf.node((1, 0), [Encoder], sub: $h = E(x)$, tone: "primary", name: <enc>),
  sf.node((2, 0), [Our module], sub: [key idea in 3 words], tone: "accent", emphasis: true, name: <core>),
  sf.node((3, 0), [Decoder], tone: "primary", name: <dec>),
  sf.node((4, 0), [Output $hat(y)$], name: <out>),
  sf.chain((<in>, <enc>, <core>, <dec>, <out>)),
  sf.same-size((<enc>, <core>, <dec>), dim: "height"),
  sf.group("train", (<enc>, <core>, <dec>), label: [Trained end-to-end], tone: "primary"),
)
```

### B. Overview + zoomed detail — the most "premium" method figure
Main flow in row 0; the new component is expanded below with relative placement (floats, so the detail row stays
compact), connected by dashed zoom lines. Full version: `examples/fig_method.typ`.
```typ
#sf.diagram(
  spacing: (20pt, 24pt),
  sf.node((0, 0), [Input $x$], name: <in>),
  sf.node((1, 0), [Our module], tone: "accent", emphasis: true, name: <core>),
  sf.node((2, 0), [Output $hat(y)$], name: <out>),
  sf.chain((<in>, <core>, <out>)),
  sf.matrix(sf.below-of(<core>, gap: 40pt, dx: -22pt), rows: 6, cols: 6, pattern: "lowrank", tone: "accent",
    label: $A$, name: <m1>),
  sf.op(sf.right-of(<m1>, gap: 14pt), symbol: "x", name: <mul>),
  sf.vector(sf.right-of(<mul>, gap: 14pt), n: 6, tone: "accent", label: $v$, name: <v1>),
  sf.chain((<m1>, <mul>, <v1>)),
  sf.group("detail", (<m1>, <mul>, <v1>), label: [Inside our module], tone: "accent", dashed: true, fill: white),
  sf.zoom(<core>, "detail"),
)
```
- Put the detail group **directly below** the magnified element, no wider than the main row; zoom lines must not
  cross text (PDF lint: `line-through-text`; move a label with `label-pos` / `label-side`).

### C. Iterative optimization loop
```typ
#sf.diagram(
  sf.node((0, 0), [Model $f_theta$], tone: "primary", name: <model>),
  sf.node((1, 0), [Loss], tone: "loss", name: <loss>),
  sf.node((2, 0), [Gradient $g_t$], name: <grad>),
  sf.node((3, 0), [Our update], tone: "accent", emphasis: true, name: <update>),
  sf.chain((<model>, <loss>, <grad>, <update>)),
  sf.loop(<update>, <model>, tone: "accent", label: $t <- t+1$),
  (<model>, <loss>, <grad>, <update>).enumerate().map(((i, n)) => sf.badge(n, i + 1)),   // = Algorithm 1 steps
  sf.group("loop", (<model>, <loss>, <grad>, <update>), label: [Repeat K times], tone: "primary"),
)
```
- The loop runs below the row (`side: "above"` for over); the group encloses it automatically.

### D. Prior work vs ours (two-row comparison)
```typ
#sf.diagram(
  spacing: (16pt, 18pt),
  sf.node((0, 0), [*Standard*], shape: "plain", name: <h1>),
  sf.node((1, 0), [Gradient], name: <a1>),
  sf.node((3, 0), [Step], name: <a3>),
  sf.node((0, 1), [*Ours*], shape: "plain", name: <h2>),
  sf.node((1, 1), [Gradient], name: <b1>),
  sf.node((2, 1), [Curvature sketch], tone: "accent", emphasis: true, name: <b2>),
  sf.node((3, 1), [Step], name: <b3>),
  sf.edge(<a1>, <a3>),
  sf.chain((<b1>, <b2>, <b3>)),
)
```
- Both rows share grid columns, so the difference shows up only in the added / replaced cell — readers instantly
  see "what's new".

### E. State evolution (t = 0, 1, 2 …)
Repeat one glyph 3–4 times to show how the algorithm state changes (sparsity, attention, graph, trust region).
```typ
#sf.diagram(
  spacing: (26pt, 20pt),
  ("random", "band", "diag").enumerate().map(((i, p)) => sf.matrix((i, 0), rows: 6, cols: 6, pattern: p,
    label: [$t = #i$], name: label("s" + str(i)))),
  sf.edge(<s0>, <s1>, [update]),
  sf.edge(<s1>, <s2>, [update]),
)
```

### F. Bilevel / nested loops (bilevel optimization, meta-learning)
Inner group `primary`; outer group `neutral` dashed; inner loop below, outer loop above, so the loops never cross.
```typ
#sf.diagram(
  spacing: (22pt, 24pt),
  sf.node((0, 0), [Model $theta$], tone: "primary", name: <m>),
  sf.node((1, 0), [Train loss], tone: "loss", name: <l>),
  sf.node((2, 0), [Inner step], tone: "primary", name: <u>),
  sf.node((3, 0), [Val. loss], tone: "loss", name: <val>),
  sf.node((4, 0), [Hyper-step $lambda$], tone: "accent", emphasis: true, name: <meta>),
  sf.chain((<m>, <l>, <u>, <val>, <meta>)),
  sf.loop(<u>, <m>, tone: "primary"),
  sf.loop(<meta>, <m>, side: "above", tone: "accent", label: [hyper-gradient]),
  sf.group("inner", (<m>, <l>, <u>), label: [Inner loop (K steps)], tone: "primary", label-pos: "top-right"),
  sf.group("outer", ("inner", <val>, <meta>), label: [Outer loop], dashed: true, fill: none, pad: 10pt,
    label-pos: "bottom-left"),
)
```
- Loops leaving a labelled group automatically clear its label band; keep labels out of the loops' way
  (inner label top-right, where the outer loop doesn't descend; outer label at the bottom).

### G. Network architecture (tensors)
`sf.tensor` `depth` / `sw` / `sh` encode channels and spatial size — encoders get narrower and deeper; `sf.op` for
⊕, ⊗, concat; skip connections with `sf.loop(.., side: "above")`. Don't draw every layer.
```typ
#sf.diagram(
  spacing: (18pt, 20pt),
  sf.tensor((0, 0), depth: 2, sw: 10pt, sh: 30pt, tone: "neutral", label: [input], name: <x>),
  sf.tensor((1, 0), depth: 4, sw: 8pt, sh: 22pt, label: [conv], name: <c1>),
  sf.tensor((2, 0), depth: 6, sw: 6pt, sh: 14pt, tone: "accent", label: [ours], name: <c2>),
  sf.op((3, 0), symbol: "+", name: <add>),
  sf.node((4, 0), [Head], tone: "primary", name: <head>),
  sf.chain((<x>, <c1>, <c2>, <add>, <head>)),
  sf.loop(<c1>, <add>, side: "above", label: [skip]),
)
```

### H. Algorithm flowchart (single column, vertical)
One grid column, a diamond for the decision, pills for start / end, the key step as the accent; the "no" branch
leaves through an empty column. Full version: `examples/fig_flowchart.typ` (with `width: "single"`).
```typ
#sf.diagram(
  spacing: (14pt, 13pt),
  sf.node((0, 0), [Start], shape: "pill", name: <s>),
  sf.node((0, 1), [Sample $B_t$], tone: "primary", name: <b>),
  sf.node((0, 2), [Our step], tone: "accent", emphasis: true, name: <k>),
  sf.node((0, 3), [Converged?], shape: "diamond", name: <c>),
  sf.node((0, 4), [Return $theta_T$], shape: "pill", name: <e>),
  sf.chain((<s>, <b>, <k>, <c>)),
  sf.edge(<c>, <e>, [yes], label-side: left),
  sf.edge(<c>, (1, 3), (1, 1), <b>, [no], label-pos: (1, 50%), label-side: left),
)
```

## 6. Iterating: what lint messages mean

| lint | Meaning | Fix |
|---|---|---|
| `overlap` (geometry) | two items (with captions) overlap | larger `spacing` / `gap`, or another cell |
| `group-intrusion` | a non-member sits inside a group box | more distance, or make it a member |
| `group-overlap` | two unrelated group boxes overlap | more spacing; nest them instead |
| `edge-through` | an edge crosses an unrelated item | `sf.loop`, extra vertices through an empty column, `corner:` / `bend:`, or rearrange |
| `edge-short` | items too close for a visible arrow | raise the column / row gap |
| `crossings` (INFO) | edges cross | reorder cells; ≥ 2 crossings usually means the layout needs rethinking |
| `line-through-text` (PDF) | a line (edge, zoom, brace) runs through text | move the label (`label-pos`, `label-side`) or the items |
| `text-overlap` (PDF) | glyphs of two texts overlap | more space; shorter labels |
| `clipped` / `width` (PDF) | content wider than the column (fixed width) | smaller gaps / boxes, two rows, or `width: "double"` |
| `font-min` (PDF) | text below the journal minimum | don't shrink text; avoid fractions in labels |
| `too-many-hues` | too many hues | merge meanings: ≤ 3 hues + grey |

Then **look at the PNG**: passing lint doesn't mean good-looking. Check: is the focal point obvious, are rows aligned,
is white space balanced, is there a large empty area (consider placing the legend or detail there), do arrows always
follow the reading direction.

## 7. Don'ts

- Clip-art icons, emoji, 3D blocks, shadows, gradients, rainbow tones; a different color per box.
- Sentences inside boxes; the same concept named differently in different places.
- Inconsistent arrowheads or stroke widths (use `head:` / `tail:` rather than mixing fletcher mark strings); key
  distinctions expressed by color alone.
- Enlarging fonts or boxes to "fill" space — white space is fine; a single-column figure is often 89 × 50 mm.
- Absolute coordinates for everything: use grid cells and relative placement, otherwise alignment and spacing drift.
