# sfd.mjs API reference (schematics / flowcharts)

```js
import { Diagram } from '<skill>/scripts/diagram/sfd.mjs';   // Node ≥ 18, zero dependencies
const d = new Diagram({ width: 'double' });
// ... add items, edges, groups ...
d.save('figures/fig1.svg');      // writes SVG, prints lint, runs check.py for a PNG preview
```

**Units**: every number is in pt (1 mm = 2.835 pt) unless the option name says mm. y grows downward.
**IDs**: every item has a unique id; SVG group ids are `node-<id>`, `edge-<from>-<to>`, `group-<id>` etc., easy to find in Illustrator / Inkscape.

## Contents
1. Diagram · 2. Positioning · 3. Nodes · 4. Glyphs · 5. Edges · 6. Groups
7. Annotations (brace / note / zoom / legend / badge / panel / text) · 8. Auto layout · 9. Text and math · 10. Output and checks

## 1. `new Diagram(options)`

| Option | Default | Description |
|---|---|---|
| `width` | `'double'` | `'single'` / `'onehalf'` / `'double'` (per journal) or mm |
| `height` | `'auto'` | mm; auto = content height + margin |
| `journal` | `'nature'` | `nature` `science` `cell` `pnas` `ieee` `neurips` `icml` `cvpr`: column widths, font sizes, label case |
| `margin` | `4` | pt around content when height is auto |
| `align` | `'center'` | horizontal placement of content on the fixed-width canvas, or `'left'` |
| `title` | `'diagram'` | written into the SVG `<title>` |
| `palette` | — | override colors, e.g. `{ orange: '#C0392B' }` (validate with `palette_report` first) |
| `theme` | — | override theme tokens, e.g. `{ corner: 'circular' }`, `{ g2Scale: 1.4 }`, `{ radius: 3 }` |

## 2. Positioning (choose one per item, in its options)

| Mode | Syntax | Description |
|---|---|---|
| Absolute | `x, y` | center point (pt). Usually only the first item gets `x: 0, y: 0`; the canvas re-centers automatically |
| Relative | `right: 'id'` / `left` / `above` / `below` | next to the reference; may be an array `['a','b']` (their bounding box) |
|  | `gap` | distance to the reference (default 16) |
|  | `align` | `'top'`/`'bottom'` when placed sideways, `'left'`/`'right'` when placed vertically; default center |
|  | `dx, dy` | extra nudge |
| Grid | `d.grid({ x0, y0, dx, dy })` + `at: [col, row]` | regular arrays |
| Auto | no position + `d.layout({ dir })` | layered auto layout (§8) |

Relative placement may reference items defined later; circular references throw.

## 3. Nodes `d.node(id, options)`

| Option | Description |
|---|---|
| `label` | main text; supports `$math$` and `\n` |
| `sub` | secondary text (6 pt grey) below the label |
| `shape` | `rect` (default, rounded) `pill` `circle` `ellipse` `diamond` `cylinder` `doc` `io` `hexagon` `plain` (no frame) |
| `tone` | `neutral` `primary` `accent` `secondary` `loss` `warm` `cool`, or `blue` `orange` `green` `purple` `amber` `sky` `grey`, or `#hex` |
| `emphasis` | `true` = key new component: thick border, deeper fill, bold |
| `bold` / `dashed` | bold text / dashed border (optional or inference-only components) |
| `w`, `h` | fixed size (default: auto-fit to text; `minW` 30, `minH` 17) |
| `fill`, `stroke`, `strokeWidth`, `radius` | manual overrides (avoid); `radius` is the **visual radius** (what circular corner it should look like), default 2.5 pt |
| `corner`, `smoothing` | `'g2'` (default, curvature-continuous iOS/Figma smooth corners) or `'circular'`; `smoothing` 0–1 (default 0.6, larger = longer transition). The actual G2 arc radius is `radius × g2Scale` (theme token, default 1.3) because equal-radius G2 corners read tighter |
| `textAlign: 'left'` | left-aligned text (multi-line descriptions) |

`d.sameSize(['a','b','c'], 'w'|'h'|'both')`: unify sizes (largest wins).
`d.op(id, { symbol, d: 10, tone })`: small operator circle; `symbol` is `'+'` `'x'` `'.'` or any short text (`'σ'`, `'‖'`, `'$\\odot$'`).

## 4. Glyphs — with a `label` below

| Method | Main options | Use |
|---|---|---|
| `d.matrix(id, o)` | `rows` `cols` `cell`(4.2) `values` (2-D, 0–1) `pattern`: `random` `lowrank` `diag` `band` `sparse` `causal` `attention`; `seed` `tone` | weights, Hessians, attention, covariance |
| `d.vector(id, o)` | `n` `orient: 'v'|'h'` `values` `cell` `tone` | embeddings, parameters, gradient vectors |
| `d.tensor(id, o)` | `depth` `sw` `sh` `dx` `dy` `tone` | feature maps, batches, stacked gradient history |
| `d.plot(id, o)` | `series`: arrays or presets `decay` `noisy` `rise` `sine` `bell` `step`; `tones` `w` `h` | schematic loss curves / distributions (**not** data plots) |
| `d.graph(id, o)` | `n` or `points` (0–1 coords) `edges` `highlight` (node indices) `r` | graph structure, network topology |
| `d.mlp(id, o)` | `layers: [3,4,4,2]` `w` `h` | fully connected network |
| `d.placeholder(id, o)` | `w` `h` `text` | placeholder for a photo / screenshot pasted later |

`seed` fixes random patterns so reruns look identical.

## 5. Edges `d.edge(from, to, options)` / `d.chain([ids], options)`

Endpoints: `'id'`, `'id.right'` (specific side), or a free point `{ x, y }`.

| Option | Description |
|---|---|
| `route` | `'auto'` (default: straight if aligned, otherwise orthogonal with rounded bends) `'straight'` `'curve'` (cubic Bézier) `'below'` `'above'` `'left'` `'right'` (detours for feedback / skip connections, avoiding nearby items) |
| `fromSide`, `toSide` | `right` `left` `top` `bottom`, override the automatic choice |
| `fromOffset`, `toOffset` | shift the port along the side (pt), to separate multiple edges on one side |
| `bend` | position of the orthogonal bend, 0–1 (default 0.5) |
| `clearance` | distance between detours and items (default 9) |
| `curvature` | curve bulge (default 0.45) |
| `label` | edge label (6 pt grey, math ok); `labelPos` 0–1; `labelSide`: `above` `below` `left` `right` `center` (on the line with a white background) |
| `style` | `'solid'` `'dashed'` `'dotted'` |
| `tone` / `color` / `width` / `emphasis` | color and width; `emphasis` = 1.1 pt |
| `head` / `tail` | `'arrow'` (default) `'open'` `'dot'` `'bar'` `'none'` `'both'` |
| `feedback: true` | treated as a back edge by auto layout (excluded from layering) |

Convention: solid = data / control flow; dashed = optional, inference-only, or indirect influence; accent color = new signals / loops produced by our method.

## 6. Groups `d.group(id, members, options)`

Members are item ids or other group ids (nesting). Edges with both ends inside the group (e.g. loops) are enclosed automatically.

| Option | Description |
|---|---|
| `label`, `labelPos` | `top-left` (default) `top-right` `top-center` `bottom-left` `bottom-right` |
| `tone` | very light tint of the tone as fill; a same-color square before the label (`labelDot: false` to disable) |
| `dashed` | dashed border (common without fill) |
| `fill` | `false` = transparent, or a color (e.g. `'#FFFFFF'` for zoom detail boxes) |
| `pad`, `padX`, `radius`, `minW` | padding (default 7), visual corner radius (default 4), minimum width |
| `corner`, `smoothing` | as for nodes; change globally with `new Diagram({ theme: { corner: 'circular' } })` |

## 7. Annotations

| Method | Description |
|---|---|
| `d.brace(members, { side, label, offset, depth })` | curly brace, `side`: `bottom` `top` `left` `right` |
| `d.note(target, text, { side, dist, dx, dy, italic })` | leader line + italic note |
| `d.zoom(source, detail, { pad })` | dashed box around `source`, two dashed lines to `detail` (item or group) |
| `d.legend(items, { at: 'bottom'|'top', align: 'center' } or { x, y })` | `items`: `{ tone, label, kind: 'box'|'line'|'dashed'|'arrow' }`; without coordinates it goes below the content |
| `d.badge(target, n, { corner, tone })` | numbered step dot (matching Algorithm steps in the text) |
| `d.panel('a', { x, y })` | panel label (8 pt bold, canvas coordinates, default top-left); omit when assemble.py adds labels |
| `d.text(id, { text, size, weight, italic, anchor, ...position })` | free text: column / row headers |

## 8. Auto layout `d.layout({ dir: 'LR'|'TB', rankGap, nodeGap })`

Applies to items **without any position**: longest-path layering along edges, barycenter ordering to reduce
crossings, then nodes are pulled toward their neighbors so chains are straight. Back edges (`feedback: true`,
detour routes, cycles) are ignored for layering. Good for flowcharts and medium DAGs; fine-tune with
`rank: k` (force a layer) or switch to relative placement.

## 9. Text and math

- Inside `$...$`: letters italic, digits / operators upright; `_`/`^` sub/superscripts (kept ≥ journal minimum); `{}` grouping;
  `\frac{a}{b}` → a/b; `\sqrt{x}`; `\hat \bar \tilde \dot \vec`; `\mathbf \mathrm \text \mathcal \mathbb`;
  Greek letters; `\nabla \partial \infty \sum \in \le \ge \approx \propto \times \cdot \odot \oplus \otimes \top \leftarrow \to \ell \|`;
  `\min \max \arg\min \log \exp \softmax` (upright); `\,` thin space. Binary minus gets thin spaces automatically.
- Text width is measured with an Arial-metric width table, so boxes auto-fit; no guessing sizes.

## 10. Output and checks

- `d.save(file, { preview: true })`: writes the SVG (layers: `layer-groups` → `layer-edges` → `layer-nodes` → `layer-annotations` → `layer-labels`),
  prints lint, runs `check.py` to render a PNG (explains if no renderer is found). Returns the issue list.
- `d.lint()`: overlaps, text on items / text, text overflow, off-canvas, edges through items / text / unrelated groups, short edges, zoom lines over text, group intrusion, too many hues, excessive height, edge crossing count.
- `d.render()`: returns the SVG string only.
- Exported helpers: `measure(str, size)`, `parseRich`, `roundRectPath`, `PALETTE`, `THEMES`, `tint`, `shade`, `mix`, `contrast`, `MM`.
