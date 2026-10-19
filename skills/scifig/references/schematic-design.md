# Schematic design language: method overviews, algorithm flows, framework diagrams

Data plots have right answers; schematics don't — which is why AI-drawn schematics look the most amateur.
Below is a fixed design language and 8 composition patterns. Pick a pattern first, then fill it in.
API details: `diagram-api.md`.

## Contents
1. Principles · 2. Color semantics · 3. Text · 4. Spacing and alignment · 5. Composition patterns (8, with code skeletons)
6. Iterating: what lint messages mean · 7. Don'ts

## 1. Principles

1. **One schematic explains one mechanism.** In 5 seconds the reader should see "input → key step → output" and "where the new thing is". More than ~12 boxes: split panels or use a zoomed detail (pattern B).
2. **Reading order = data-flow direction**: left→right (horizontal, double-column) or top→bottom (vertical, single-column, flowcharts). Feedback / iteration uses a detour loop (`route: 'below'`), never a diagonal against the main direction.
3. **A single focal point**: only your new component gets `tone: 'accent', emphasis: true` (thicker border, deeper fill, bold). Everything else is supporting cast.
4. **Shapes carry meaning, consistently**: rounded rectangle = processing step / module; cylinder = dataset / storage; pill = start / end / simple op; diamond = decision; small circle = operator (⊕ ⊗ σ); matrix / tensor / curve glyphs = intermediate quantities.
5. **Name things precisely with math**: write "Model $f_\theta$", not "neural network model"; label edges with variables ($g_t$, $\hat{y}$). Use the paper's notation.
6. **Corners are G2 smooth corners** (curvature-continuous, as in iOS / Figma): softer than circular arcs, no visible seam. `radius` is the *visual* radius — what circular corner it should look like (nodes 2.5 pt, groups 4 pt); internally it is enlarged 1.3× to compensate for G2 corners reading tighter. Don't enlarge it further. Pills and circles stay true arcs.
7. **Alignment beats decoration**: centers aligned per row, same-type boxes the same size (`sameSize`), uniform gaps. Order alone reads as quality.

## 2. Color semantics (≤ 3 hues + grey)

| tone | color | for |
|---|---|---|
| `neutral` / `data` | white fill, grey stroke | inputs, data, standard operations, context |
| `primary` / `model` | blue | existing standard components (model, optimizer backbone) |
| `accent` / `ours` | vermillion | **your contribution** and the signals / loops it produces |
| `secondary` | green | a second kind of component (teacher, validation branch), only when needed |
| `loss` / `objective` | purple | objectives, losses, constraints |
| `warm` / `cool` | amber / sky | avoid; only when more categories must be distinguished |

- Same color values as the Python plots (`PALETTE`), so "ours" in Figure 1 and the "Ours" curve in Figure 3 are the same vermillion.
- **Text is always near-black / dark grey** (Nature asks for no colored text); color goes on fills, strokes and arrows. A small color square before a group label replaces colored text.
- Arrows default to dark grey; only arrows carrying a *new* signal (feedback, quantities produced by our method) use `tone: 'accent'`.

## 3. Text

- Box label 7 pt, sub-label 6 pt grey (`sub`), group label 6 pt bold, edge label 6 pt grey. Don't set custom sizes (lint rejects < 5 pt).
- Sentence case ("Preconditioned step"), no periods, 2–4 words. Needing two lines means the box holds too much — split it or move it to the caption.
- Math in `$...$`: `_ ^ {} \frac \sqrt \hat \bar \tilde \mathbf \mathcal \mathbb \mathrm \text`, Greek letters, common symbols (`\nabla \leftarrow \in \le \approx \top \odot`…). Line break: `\n`.

## 4. Spacing and alignment

- Default `gap: 16` pt (≈ 5.6 mm); edges with labels need 20–24 pt; rows ≥ 40 pt apart (including group labels and loops).
- Group padding 7–9 pt; ≥ 10 pt between groups. Nested groups: outer `neutral` + `dashed`, inner colored.
- Use relative placement (`right: 'a'`, `below: ['a', 'b']`), not absolute coordinates: alignment holds automatically and moving one box moves the row.
- Give the first item `x: 0, y: 0`; the canvas centers content and trims height automatically; width is fixed to the journal column.

## 5. Composition patterns

### A. Pipeline — horizontal, in stages
```js
const d = new Diagram({ width: 'double' });
d.node('in', { label: 'Input $x$', tone: 'neutral', x: 0, y: 0 });
d.node('enc', { label: 'Encoder', sub: '$h = E(x)$', tone: 'primary', right: 'in' });
d.node('core', { label: 'Our module', sub: 'key idea in 3 words', tone: 'accent', emphasis: true, right: 'enc', gap: 22 });
d.node('dec', { label: 'Decoder', tone: 'primary', right: 'core', gap: 22 });
d.node('out', { label: 'Output $\\hat{y}$', tone: 'neutral', right: 'dec' });
d.chain(['in', 'enc', 'core', 'dec', 'out']);
d.sameSize(['enc', 'core', 'dec'], 'h');
d.group('train', ['enc', 'core', 'dec'], { label: 'Trained end-to-end', tone: 'primary' });
```

### B. Overview + zoomed detail — the most "premium" method figure
Main flow in one row; the new component is expanded below, connected by dashed zoom lines. See `examples/fig_method.mjs`.
```js
// ...row 1 as in A, with the novel node 'core'...
d.matrix('m1', { rows: 6, cols: 6, pattern: 'lowrank', tone: 'accent', label: '$A$', below: 'core', gap: 60 });
d.op('mul', { symbol: 'x', right: 'm1', gap: 18 });
d.vector('v1', { n: 6, tone: 'accent', label: '$v$', right: 'mul', gap: 18 });
d.chain(['m1', 'mul', 'v1']);
d.group('detail', ['m1', 'mul', 'v1'], { label: 'Inside our module', tone: 'accent', dashed: true, fill: '#FFFFFF' });
d.zoom('core', 'detail');
```
- Put the detail group **directly below** the magnified element, no wider than the main row; zoom lines must not cross text (lint: `zoom-over-text`).

### C. Iterative optimization loop
```js
d.chain(['model', 'loss', 'grad', 'update']);
d.edge('update', 'model', { route: 'below', tone: 'accent', label: '$t \\leftarrow t+1$' });
['model', 'loss', 'grad', 'update'].forEach((id, i) => d.badge(id, i + 1));   // step numbers match Algorithm 1
d.group('loop', ['model', 'loss', 'grad', 'update'], { label: 'Repeat K times', tone: 'primary' });
```
- The loop runs below (or above with `route: 'above'`) the main row; the group box automatically encloses it.

### D. Prior work vs ours (two-row comparison)
```js
d.text('h1', { text: 'Standard', weight: 'bold', x: 0, y: 0 });
d.node('a1', { label: 'Gradient', tone: 'neutral', right: 'h1', gap: 12 });
d.node('a2', { label: 'Step', tone: 'neutral', right: 'a1' });
d.node('b1', { label: 'Gradient', tone: 'neutral', below: 'a1', gap: 24 });
d.text('h2', { text: 'Ours', weight: 'bold', left: 'b1', gap: 12 });     // row header aligned to its row
d.node('b2', { label: 'Curvature sketch', tone: 'accent', emphasis: true, right: 'b1' });
d.node('b3', { label: 'Step', tone: 'neutral', right: 'b2' });
d.chain(['a1', 'a2']); d.chain(['b1', 'b2', 'b3']);
```
- Both rows share column positions (`below:` alignment); the difference appears only in the added / replaced cell, so readers instantly see "what's new".

### E. State evolution (t = 0, 1, 2 …)
Repeat one glyph 3–4 times to show how the algorithm state changes (sparsity pattern, attention, graph structure, trust region).
```js
['0', '1', '2'].forEach((t, i) => {
  d.matrix(`s${t}`, { rows: 6, cols: 6, pattern: ['random', 'band', 'diag'][i], tone: 'primary',
    label: `$t = ${t}$`, ...(i ? { right: `s${i - 1}`, gap: 26 } : { x: 0, y: 0 }) });
  if (i) d.edge(`s${i - 1}`, `s${t}`, { label: 'update' });
});
```

### F. Bilevel / nested loops (bilevel optimization, meta-learning)
Outer group `neutral` dashed, inner group `primary`; outer loop `route: 'above'`, inner loop `route: 'below'`, so the loops never cross.
Leave ≥ 26 pt between an item just outside the groups and the group members, to make room for both paddings (otherwise lint reports `group-intrusion`).
```js
d.group('inner', ['m', 'l', 'u'], { label: 'Inner loop (K steps)', tone: 'primary' });
d.group('outer', ['inner', 'val', 'meta'], { label: 'Outer loop', tone: 'neutral', dashed: true, pad: 10 });
d.edge('u', 'm', { route: 'below', tone: 'primary' });
d.edge('meta', 'm', { route: 'above', tone: 'accent', label: 'hyper-gradient' });
```

### G. Network architecture (tensors)
`tensor` `depth/sw/sh` encode channels and spatial size — encoders get narrower and deeper; `op` for ⊕, ⊗, concat.
Skip connections with `route: 'above'`. Don't draw every layer — only enough to explain the structure.

### H. Algorithm flowchart (single column, vertical)
```js
const d = new Diagram({ width: 'single' });
// nodes without positions + d.layout({ dir: 'TB' }) -> automatic layered layout
d.node('conv', { label: 'Converged?', shape: 'diamond', tone: 'neutral' });
d.edge('conv', 'sample', { route: 'right', label: 'no', feedback: true });
d.layout({ dir: 'TB', rankGap: 13 });
```
See `examples/fig_flowchart.mjs`. Decisions are diamonds, start/end are pills, the key step is accent.

## 6. Iterating: what lint messages mean

| lint | Meaning | Fix |
|---|---|---|
| `overlap` | two items overlap | larger `gap`, or a different relative position |
| `text-overlap` / `text-on-shape` | a label hits other text / items | more space; move edge labels via `labelPos` / `labelSide`; shorter glyph labels |
| `text-overflow` | text exceeds a manually set `w` | drop `w` (auto-fit) or shorten the text |
| `edge-through` | an edge crosses an unrelated item | `route: 'below'/'above'`, `fromSide/toSide`, `bend`, or rearrange |
| `edge-short` | items too close for a visible arrow | increase the gap |
| `edge-over-text` / `zoom-over-text` | a line crosses text | move the label (`labelPos: 0.25`) or the items |
| `edge-through-group` | an edge cuts through an unrelated group | reroute or move the group |
| `group-intrusion` | a non-member item / text falls inside a group box | add distance, or make it a member |
| `outside` | beyond the canvas (column width is fixed) | smaller gaps / boxes, two rows, or `width: 'double'` |
| `too-many-tones` | too many hues | merge meanings: ≤ 3 hues + grey |
| `crossings` (INFO) | edges cross | reorder nodes; ≥ 2 crossings usually means the layout needs rethinking |

Then **look at the PNG**: passing lint doesn't mean good-looking. Check: is the focal point obvious, are rows aligned,
is white space balanced, is there a large empty area (consider placing the legend or detail there), do arrows always
follow the reading direction.

## 7. Don'ts

- Clip-art icons, emoji, 3D blocks, shadows, gradients, rainbow tones; a different color per box.
- Sentences inside boxes; the same concept named differently in different places.
- Inconsistent arrowheads or stroke widths; key distinctions expressed by color alone.
- Enlarging fonts or boxes to "fill" space — white space is fine; a single-column figure is often 89 × 50 mm.
- Hand-writing SVG coordinates: use sfd's relative placement and lint, otherwise alignment and spacing will drift.
