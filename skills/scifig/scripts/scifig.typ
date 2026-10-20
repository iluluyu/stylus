// scifig.typ — journal-grade schematics (method overviews, pipelines, flowcharts) for Typst ≥ 0.13.
// Twin of the Python package `scripts/scifig/`: same palette, journal profiles and design rules,
// so a schematic's accent and the "Ours" curve in a data plot are the same vermillion.
//
//   #import "scifig.typ" as sf
//   #show: sf.setup.with(journal: "nature", width: "double")
//   #sf.diagram(
//     sf.node((0, 0), [Data $cal(D)$], shape: "cylinder", name: <data>),
//     sf.node((1, 0), [Model $f_theta$], tone: "primary", name: <model>),
//     sf.edge(<data>, <model>),
//   )
//
// Layout is fletcher's elastic grid: `pos` = (column, row); rows/columns size themselves to their
// content, so alignment is automatic. Every length is in pt unless stated. API: references/diagram-api.md

#import "@preview/fletcher:0.5.8" as fletcher
#import fletcher: cetz

// ===================================================================== journal profiles
// Same numbers as JOURNALS in scifig/style.py (Nature row verified against the 2026 artwork guide).
#let journals = (
  nature: (widths: (single: 89mm, onehalf: 120mm, onehalf-wide: 136mm, double: 183mm),
    max-height: 170mm, size: 7pt, small: 6pt, label: 8pt, min: 5pt, case: "lower"),
  science: (widths: (single: 55mm, onehalf: 120mm, double: 175mm),
    max-height: 220mm, size: 7pt, small: 6pt, label: 8pt, min: 5pt, case: "upper"),
  cell: (widths: (single: 85mm, onehalf: 114mm, double: 174mm),
    max-height: 225mm, size: 7pt, small: 6pt, label: 9pt, min: 5pt, case: "upper"),
  pnas: (widths: (single: 87mm, onehalf: 114mm, double: 178mm),
    max-height: 225mm, size: 7pt, small: 6pt, label: 8pt, min: 5pt, case: "upper"),
  ieee: (widths: (single: 88.9mm, double: 181mm),
    max-height: 230mm, size: 8pt, small: 7pt, label: 8pt, min: 6pt, case: "lower"),
  neurips: (widths: (single: 139.7mm, half: 67mm, double: 139.7mm),
    max-height: 200mm, size: 8pt, small: 7pt, label: 9pt, min: 6pt, case: "lower"),
  icml: (widths: (single: 82.6mm, double: 171.5mm),
    max-height: 220mm, size: 8pt, small: 7pt, label: 9pt, min: 6pt, case: "lower"),
  cvpr: (widths: (single: 82.6mm, double: 174.6mm),
    max-height: 220mm, size: 8pt, small: 7pt, label: 9pt, min: 6pt, case: "lower"),
)

#let _config = state("scifig-config", (journal: "nature"))
#let _profile() = journals.at(_config.get().journal)   // call inside `context`

// Arial-metric fonts. check.py / sf.compile_typst pass the installed one as --input sf-font=...,
// which also silences Typst's "unknown font family" warnings for the others.
#let sans = {
  let f = sys.inputs.at("sf-font", default: none)
  if f != none { (f,) } else { ("Arial", "Helvetica", "Liberation Sans", "Arimo", "TeX Gyre Heros") }
}

// ===================================================================== color
// Okabe–Ito hues, deepened for print; CVD-checked (see references/color.md). == scifig.PALETTES["scifig"]
#let palette = (
  blue: rgb("#1A5FA0"), orange: rgb("#CF5B2A"), green: rgb("#118C6E"), purple: rgb("#C26FA3"),
  amber: rgb("#E1A02E"), sky: rgb("#5BADDF"), grey: rgb("#6E6E6E"),
)
#let ink = rgb("#1A1A1A")      // text, == scifig.INK
#let muted = rgb("#4D4D4D")    // secondary text, default arrows
#let faint = rgb("#8C8C8C")    // guides, leader lines, neutral strokes
#let guide = rgb("#B3B3B3")
#let accent = palette.orange   // == scifig.ACCENT

// linear mix in sRGB, identical to scifig.mix / tint / shade in Python
#let mix(a, b, t) = color.mix((a, (1 - t) * 100%), (b, t * 100%), space: rgb)
#let tint(c, t) = mix(c, white, t)
#let shade(c, t) = mix(c, black, t)

#let _alias = (primary: "blue", model: "blue", accent: "orange", ours: "orange", highlight: "orange",
  secondary: "green", loss: "purple", objective: "purple", warm: "amber", cool: "sky",
  neutral: "grey", data: "grey")

/// Semantic tone -> (base, fill, fill-strong, soft, stroke, dark, grey).
/// Names: neutral|data, primary|model, accent|ours, secondary, loss|objective, warm, cool,
/// a palette key (blue, orange, ...), or any color.
#let tone(name) = {
  if name == none { name = "neutral" }
  let base = if type(name) == color { name } else {
    let key = _alias.at(name, default: name)
    assert(key in palette, message: "scifig: unknown tone '" + name + "'. Use neutral, primary, accent, "
      + "secondary, loss, warm, cool, a palette key or a color.")
    palette.at(key)
  }
  let grey = base == palette.grey
  if grey {
    (base: base, fill: white, fill-strong: rgb("#F2F2F2"), soft: rgb("#F5F5F5"), stroke: faint,
      dark: muted, grey: true)
  } else {
    (base: base, fill: tint(base, 0.87), fill-strong: tint(base, 0.72), soft: tint(base, 0.94),
      stroke: shade(base, 0.05), dark: shade(base, 0.35), grey: false)
  }
}

// ===================================================================== setup
// Math: "sans" (default) sets variables in the body font's italic, like Arial math in the Python plots;
// "serif" keeps Typst's New Computer Modern math (LaTeX look). Sub/superscripts are kept >= the
// journal minimum (Typst would otherwise shrink 7 pt scripts to 4.9 pt).
#let _math-rules(mode, min, body) = {
  show math.attach: it => if it.at("label", default: none) == <sf-ok> { it } else {
    context {
      let s = calc.max(text.size, (min + 0.05pt) / 0.7)
      let f(v) = if v == none { none } else { text(size: s, v) }
      [#math.attach(it.base, t: f(it.t), b: f(it.b), tl: f(it.tl), bl: f(it.bl), tr: f(it.tr),
        br: f(it.br))<sf-ok>]
    }
  }
  if mode == "sans" {
    show math.equation: it => {
      show regex("^[A-Za-zα-ωϑϕϵϱϖς]$"): x => text(font: sans, style: "italic", math.upright(x))
      show regex("^(?:[\p{L}\d][\p{L}\d .,:;'\-]+|\d|[Α-Ω])$"): x => text(font: sans, math.upright(x))
      it
    }
    body
  } else { body }
}

/// Page = one figure at print size: fixed column width, height fits the content, transparent.
/// width: "single" | "onehalf" | "double" (journal widths) or a length / number in mm.
#let setup(journal: "nature", width: "double", height: auto, margin: 3pt, math: "sans", body) = {
  assert(journal in journals, message: "scifig: unknown journal '" + journal + "': "
    + journals.keys().join(", "))
  let j = journals.at(journal)
  let w = if type(width) == str {
    assert(width in j.widths, message: "scifig: width '" + width + "' not in " + j.widths.keys().join(", "))
    j.widths.at(width)
  } else if type(width) in (int, float) { width * 1mm } else { width }
  set page(width: w, height: height, margin: (x: 0pt, y: margin), fill: none)
  set text(font: sans, size: j.size, fill: ink, lang: "en", hyphenate: false)
  set par(leading: 0.3em, spacing: 0.6em, justify: false)
  _config.update((journal: journal))
  show: _math-rules.with(math, j.min)
  align(center, body)
}

// ===================================================================== G2 corners
// Curvature-continuous rounded rectangle (iOS / Figma "smooth corners", figma-squircle construction).
// `r` is the *visual* radius; G2 corners read tighter, so the drawn radius is r * g2-scale.
#let g2-scale = 1.3

#let _g2-corner(P, r, sm) = {
  // top-right corner in a y-down frame whose origin is the corner point; travel: top edge -> right edge
  let am = 90deg * (1 - sm)
  let arc = calc.sin(am / 2) * r * calc.sqrt(2)
  let alpha = (90deg - am) / 2
  let p34 = r * calc.tan(alpha / 2)
  let beta = 45deg * sm
  let c = p34 * calc.cos(beta)
  let d = c * calc.tan(beta)
  let b = (P - arc - c - d) / 3
  let a = 2 * b
  let k = 4 / 3 * calc.tan(am / 4) * r
  let A = (-P + a + b + c, d)
  let B = (A.at(0) + arc, A.at(1) + arc)
  (
    ((-P, 0), (-P + a, 0), (-P + a + b, 0), A),
    (A, (A.at(0) + k * calc.cos(beta), A.at(1) + k * calc.sin(beta)),
      (B.at(0) - k * calc.sin(beta), B.at(1) - k * calc.cos(beta)), B),
    (B, (B.at(0) + d, B.at(1) + c), (B.at(0) + d, B.at(1) + b + c), (0, P)),
  )
}

/// Cubic segments ((p0, c1, c2, p1), ...) in pt, y-down, centered at (cx, cy).
#let squircle-segments(w, h, r, smoothing: 0.6, cx: 0, cy: 0) = {
  let half = calc.min(w, h) / 2
  let r = calc.min(r * g2-scale, half)
  if r <= 0.01 { return none }
  let sm = calc.max(0, calc.min(smoothing, half / r - 1))
  let segs = _g2-corner((1 + sm) * r, r, sm)
  let corners = (
    (w / 2, -h / 2, p => p),
    (w / 2, h / 2, p => (-p.at(1), p.at(0))),
    (-w / 2, h / 2, p => (-p.at(0), -p.at(1))),
    (-w / 2, -h / 2, p => (p.at(1), -p.at(0))),
  )
  let out = ()
  for (x, y, rot) in corners {
    for s in segs {
      out.push(s.map(p => { let q = rot(p); (cx + x + q.at(0), cy + y + q.at(1)) }))
    }
  }
  out
}

// cetz drawing (y-up) of a rounded rectangle centered at (cx, cy); lengths in pt (floats)
#let _cetz-roundrect(w, h, r, corner: "g2", smoothing: 0.6, cx: 0, cy: 0) = {
  let segs = if corner == "g2" { squircle-segments(w, h, r, smoothing: smoothing) } else { none }
  if segs == none {
    let rr = if corner == "g2" { 0 } else { calc.min(r, calc.min(w, h) / 2) }
    return cetz.draw.rect(((cx - w / 2) * 1pt, (cy - h / 2) * 1pt), ((cx + w / 2) * 1pt, (cy + h / 2) * 1pt),
      radius: rr * 1pt)
  }
  let P(p) = ((cx + p.at(0)) * 1pt, (cy - p.at(1)) * 1pt)
  cetz.draw.merge-path(close: true, {
    for (i, s) in segs.enumerate() {
      let (p0, c1, c2, p1) = s
      if i > 0 {
        let prev = segs.at(i - 1).at(3)
        if calc.abs(prev.at(0) - p0.at(0)) + calc.abs(prev.at(1) - p0.at(1)) > 0.001 {
          cetz.draw.line(P(prev), P(p0))
        }
      }
      cetz.draw.bezier(P(p0), P(p1), P(c1), P(c2))
    }
    let last = segs.last().at(3)
    let first = segs.first().at(0)
    cetz.draw.line(P(last), P(first))
  })
}

// ===================================================================== node shapes (fletcher)
// fletcher calls shape(node, extrude); node.size is the box, `extrude` grows the outline (edge anchoring).
#let _pt(l) = l.to-absolute() / 1pt

#let _shape-rect(node, extrude, radius: 2.5pt, corner: "g2", smoothing: 0.6) = {
  let e = _pt(extrude)
  let (w, h) = node.size.map(_pt)
  _cetz-roundrect(w + 2 * e, h + 2 * e, _pt(radius) + e, corner: corner, smoothing: smoothing)
}

#let _shape-poly(pts) = (node, extrude) => {
  let e = _pt(extrude)
  let (w, h) = node.size.map(_pt)
  let sx = (w / 2 + e) / (w / 2)
  let sy = (h / 2 + e) / (h / 2)
  cetz.draw.line(..pts(w, h).map(p => (p.at(0) * sx * 1pt, p.at(1) * sy * 1pt)), close: true)
}
#let _diamond = _shape-poly((w, h) => ((0, h / 2), (w / 2, 0), (0, -h / 2), (-w / 2, 0)))
#let _hexagon = _shape-poly((w, h) => {
  let k = calc.min(5, w / 4)
  ((-w / 2 + k, h / 2), (w / 2 - k, h / 2), (w / 2, 0), (w / 2 - k, -h / 2), (-w / 2 + k, -h / 2), (-w / 2, 0))
})
#let _io = _shape-poly((w, h) => {
  let k = 4
  ((-w / 2 + k, h / 2), (w / 2, h / 2), (w / 2 - k, -h / 2), (-w / 2, -h / 2))
})
#let _doc = _shape-poly((w, h) => {
  let k = 5
  ((-w / 2, h / 2), (w / 2 - k, h / 2), (w / 2, h / 2 - k), (w / 2, -h / 2), (-w / 2, -h / 2))
})
#let _cylinder(node, extrude) = {
  let e = _pt(extrude)
  let (w, h) = node.size.map(_pt)
  let (w, h) = (w + 2 * e, h + 2 * e)
  let ry = 2.6
  cetz.draw.merge-path(close: true, {
    cetz.draw.line((-w / 2 * 1pt, (h / 2 - ry) * 1pt), (-w / 2 * 1pt, (-h / 2 + ry) * 1pt))
    cetz.draw.arc((-w / 2 * 1pt, (-h / 2 + ry) * 1pt), start: 180deg, stop: 360deg,
      radius: (w / 2 * 1pt, ry * 1pt))
    cetz.draw.line((w / 2 * 1pt, (-h / 2 + ry) * 1pt), (w / 2 * 1pt, (h / 2 - ry) * 1pt))
    cetz.draw.arc((w / 2 * 1pt, (h / 2 - ry) * 1pt), start: 0deg, stop: 180deg,
      radius: (w / 2 * 1pt, ry * 1pt))
  })
  cetz.draw.circle((0pt, (h / 2 - ry) * 1pt), radius: (w / 2 * 1pt, ry * 1pt), fill: none)
}

// ===================================================================== placement
// `pos` of any item is either a grid cell (column, row) — fletcher's elastic grid, rows and columns
// align automatically — or a position next to another named item. Relative items float: they do not
// stretch grid columns, which is what you want for a compact detail row under a wide main row.
// `gap` is edge-to-edge (glyph captions included); dx / dy nudge (dy > 0 = down).
#let right-of(of, gap: 16pt, dy: 0pt) = (sf-rel: "right", of: of, gap: gap, dx: 0pt, dy: dy)
#let left-of(of, gap: 16pt, dy: 0pt) = (sf-rel: "left", of: of, gap: gap, dx: 0pt, dy: dy)
#let below-of(of, gap: 24pt, dx: 0pt) = (sf-rel: "below", of: of, gap: gap, dx: dx, dy: 0pt)
#let above-of(of, gap: 24pt, dx: 0pt) = (sf-rel: "above", of: of, gap: gap, dx: dx, dy: 0pt)

// ===================================================================== items
// Items are metadata so they survive `for` loops and joins; `diagram` converts them to fletcher.

/// Box node. `label`/`sub` are content (math welcome). shape: rect (G2 rounded, default) | pill |
/// circle | ellipse | diamond | cylinder | doc | io | hexagon | plain.
/// tone: neutral | primary | accent | secondary | loss | warm | cool | palette key | color.
#let node(pos, label, sub: none, name: none, tone: "neutral", shape: "rect", emphasis: false,
  bold: false, dashed: false, width: auto, height: auto, min-width: 30pt, min-height: 17pt,
  pad-x: 6pt, pad-y: 6pt, text-align: center, fill: auto, stroke: auto, stroke-width: auto,
  radius: 2.5pt, corner: "g2", smoothing: 0.6) = metadata((sf: "node", pos: pos, label: label, sub: sub,
  name: name, tone: tone, shape: shape, emphasis: emphasis, bold: bold, dashed: dashed, width: width,
  height: height, min-width: min-width, min-height: min-height, pad-x: pad-x, pad-y: pad-y,
  text-align: text-align, fill: fill, stroke: stroke, stroke-width: stroke-width, radius: radius,
  corner: corner, smoothing: smoothing))

/// Small operator circle: symbol "+", "x", "." or any short content ([σ], $dot.o$).
#let op(pos, symbol: "+", name: none, tone: "neutral", d: 10pt) = metadata((sf: "op", pos: pos,
  symbol: symbol, name: name, tone: tone, d: d))

// ---- deterministic pseudo-random numbers (Park–Miller), so reruns look identical
#let _rand(seed, n) = {
  let s = calc.rem(calc.abs(int(seed)) * 7919 + 12345, 2147483646) + 1
  let out = ()
  for _ in range(n) {
    s = calc.rem(s * 48271, 2147483647)
    out.push(s / 2147483647)
  }
  out
}
#let _ramp(t, v) = {
  let v = calc.max(0, calc.min(1, v))
  if v < 0.6 { mix(tint(t.base, 0.9), t.base, v / 0.6) } else { mix(t.base, shade(t.base, 0.45), (v - 0.6) / 0.4) }
}

#let _matrix-values(rows, cols, pattern, seed) = {
  let r = _rand(seed, rows + cols + rows * cols)
  let u = r.slice(0, rows)
  let v = r.slice(rows, rows + cols)
  let rest = r.slice(rows + cols)
  range(rows).map(i => range(cols).map(j => {
    let q = rest.at(i * cols + j)
    if pattern == "lowrank" { 0.15 + 0.85 * u.at(i) * v.at(j) }
    else if pattern == "diag" { if i == j { 0.95 } else { 0.08 + 0.15 * q } }
    else if pattern == "band" { let k = calc.abs(i - j); if k <= 1 { 0.85 - 0.3 * k } else { 0.05 + 0.1 * q } }
    else if pattern == "sparse" { if q < 0.22 { 0.5 + 0.5 * u.at(i) } else { 0.04 } }
    else if pattern == "causal" { if j <= i { 0.2 + 0.8 * calc.pow(q, 1.5) } else { -1 } }
    else if pattern == "attention" { if j <= i { calc.exp(-calc.pow(i - j, 2) / 4) * (0.6 + 0.4 * q) } else { -1 } }
    else { q }
  }))
}

/// Heat-map matrix glyph (weights, Hessians, attention). pattern: random | lowrank | diag | band |
/// sparse | causal | attention, or `values` (2-D array in [0, 1]; negative = empty cell).
#let matrix(pos, rows: 5, cols: 5, values: none, pattern: "random", cell: 4.2pt, tone: "primary",
  label: none, name: none, seed: auto) = metadata((sf: "glyph", kind: "matrix", pos: pos, rows: rows,
  cols: cols, values: values, pattern: pattern, cell: cell, tone: tone, label: label, name: name, seed: seed))

/// Column ("v") or row ("h") vector glyph.
#let vector(pos, n: 6, values: none, orient: "v", cell: 4.2pt, tone: "primary", label: none, name: none,
  seed: auto) = metadata((sf: "glyph", kind: "vector", pos: pos, n: n, values: values, orient: orient,
  cell: cell, tone: tone, label: label, name: name, seed: seed))

/// Stacked slabs: feature maps, batches, gradient history. depth = number of slabs.
#let tensor(pos, depth: 4, sw: 16pt, sh: 22pt, dx: 3.2pt, dy: 3.2pt, tone: "primary", label: none,
  name: none) = metadata((sf: "glyph", kind: "tensor", pos: pos, depth: depth, sw: sw, sh: sh, dx: dx,
  dy: dy, tone: tone, label: label, name: name))

/// Mini line-chart glyph (schematic only, not data). series: arrays of numbers or presets
/// "decay" | "noisy" | "rise" | "sine" | "bell" | "step"; tones: one per series.
#let plot(pos, series: ("decay",), tones: ("primary", "neutral", "secondary"), width: 38pt, height: 24pt,
  frame: true, label: none, name: none, seed: 1) = metadata((sf: "glyph", kind: "plot", pos: pos,
  series: series, tones: tones, w: width, h: height, frame: frame, label: label, name: name, seed: seed))

/// Mini graph glyph: n nodes on a circle (or `points` in [0,1]^2), `edges` as (i, j) pairs.
#let graph(pos, n: 7, points: none, edges: none, highlight: (), r: 2.1pt, width: 34pt, height: 30pt,
  tone: "primary", label: none, name: none, seed: 5) = metadata((sf: "glyph", kind: "graph", pos: pos, n: n,
  points: points, edges: edges, highlight: highlight, r: r, w: width, h: height, tone: tone, label: label,
  name: name, seed: seed))

/// Fully connected network glyph, e.g. layers: (3, 5, 5, 2).
#let mlp(pos, layers: (3, 4, 4, 2), width: 40pt, height: 30pt, r: 2pt, tone: "primary", label: none,
  name: none) = metadata((sf: "glyph", kind: "mlp", pos: pos, layers: layers, w: width, h: height, r: r,
  tone: tone, label: label, name: name))

/// Dashed placeholder for a photo / screenshot to be pasted later.
#let placeholder(pos, body: [image], width: 50pt, height: 36pt, label: none, name: none) = metadata((
  sf: "glyph", kind: "placeholder", pos: pos, body: body, w: width, h: height, tone: "neutral", label: label,
  name: name))

// ---- connectors
#let _arrow-mark = (inherit: "stealth", size: 5.6, angle: 22deg, stealth: 0.22)
#let _open-mark = (inherit: "straight", size: 5)
#let _marks(head, tail) = {
  let m(k) = if k == "arrow" { _arrow-mark } else if k == "open" { _open-mark } else if k == "dot" { "*" }
    else if k == "bar" { "|" } else { none }
  (m(tail), m(head))
}
/// Arrow between two items; any fletcher edge argument works (vertices, "-|>" marks, label,
/// bend, corner, label-pos, label-side, ...). Extra: tone, color, width, emphasis,
/// style: "solid" | "dashed" | "dotted", head / tail: "arrow" | "open" | "dot" | "bar" | "none".
#let edge(..args, tone: none, color: none, width: auto, emphasis: false, style: "solid", head: "arrow",
  tail: "none") = {
  let c =if color != none { color } else if tone != none {
    let tt = if type(tone) == color { (base: tone, grey: false) } else {
      let key = _alias.at(tone, default: tone)
      (base: palette.at(key), grey: key == "grey")
    }
    if tt.grey { muted } else { tt.base }
  } else { muted }
  let w = if width != auto { width } else if emphasis { 1.1pt } else { 0.75pt }
  let dash = if style == "dashed" { (3pt, 2pt) } else if style == "dotted" { (0.8pt, 1.6pt) } else { none }
  let has-marks = args.pos().any(a => type(a) == str)
  let named = args.named()
  if not has-marks and "marks" not in named { named.insert("marks", _marks(head, tail)) }
  fletcher.edge(..args.pos(), ..named, stroke: (paint: c, thickness: w, dash: dash,
    cap: if style == "dotted" { "round" } else { "butt" }))
}

/// Edges along a chain of names: sf.chain((<a>, <b>, <c>)) == a -> b, b -> c (options apply to all).
#let chain(names, ..opts) = range(names.len() - 1).map(i => edge(names.at(i), names.at(i + 1), ..opts))

/// Feedback / iteration loop: leaves `from`, runs below (or above) the row, enters `to`.
/// depth: auto clears the tallest item (incl. glyph captions) between the two ends.
#let loop(from, to, side: "below", depth: auto, clearance: 9pt, ..edge-args) = metadata((sf: "loop",
  from: from, to: to, side: side, depth: depth, clearance: clearance, args: edge-args))

// ---- annotations (drawn after layout)
/// Container behind members (names or other group ids). Edges whose both ends are inside (loops)
/// are enclosed automatically. id: string, so other groups / zooms can refer to it.
#let group(id, members, label: none, tone: "neutral", dashed: false, fill: auto, stroke: auto, pad: 7pt,
  pad-x: auto, radius: 4pt, label-pos: "top-left", label-dot: true, corner: "g2",
  smoothing: 0.6) = metadata((sf: "group", id: id, members: members, label: label, tone: tone,
  dashed: dashed, fill: fill, stroke: stroke, pad: pad, pad-x: pad-x, radius: radius, label-pos: label-pos,
  label-dot: label-dot, corner: corner, smoothing: smoothing))

/// Numbered step dot on an item corner (match the steps of Algorithm 1).
#let badge(target, n, corner: "top-left", tone: none) = metadata((sf: "badge", target: target, n: n,
  corner: corner, tone: tone))

/// Overview -> detail: dashed outline around `source`, two dashed connector lines to `detail`.
#let zoom(source, detail, pad: 2.5pt) = metadata((sf: "zoom", source: source, detail: detail, pad: pad))

/// Curly brace spanning items. side: bottom | top | left | right.
#let brace(members, label: none, side: "bottom", offset: 4pt, depth: 4.5pt) = metadata((sf: "brace",
  members: members, label: label, side: side, offset: offset, depth: depth))

/// Italic callout with a leader line. side: left | right | top | bottom.
#let note(target, body, side: "left", dist: 12pt, italic: true) = metadata((sf: "note", target: target,
  body: body, side: side, dist: dist, italic: italic))

/// Unify sizes of nodes (largest wins). dim: "width" | "height" | "both".
#let same-size(names, dim: "both") = metadata((sf: "same", names: names, dim: dim))

// ===================================================================== rendering helpers
#let _key(n) = if n == none { none } else { str(n) }
#let _small(j) = j.small

#let _node-content(it, j, t) = {
  let main = text(size: j.size, fill: ink, weight: if it.emphasis or it.bold { "bold" } else { "regular" },
    it.label)
  let al = it.text-align
  if it.sub == none { align(al, main) } else {
    align(al, stack(dir: ttb, spacing: 2.4pt, main, text(size: j.small, fill: muted, it.sub)))
  }
}

#let _glyph-body(it, j, idx) = {
  let t = tone(it.at("tone", default: "primary"))
  let seed = if it.at("seed", default: auto) == auto { idx * 7 + 3 } else { it.seed }
  if it.kind == "matrix" {
    let vals = if it.values != none { it.values } else { _matrix-values(it.rows, it.cols, it.pattern, seed) }
    let rows = vals.len()
    let cols = vals.at(0).len()
    let c = it.cell
    box(width: cols * c, height: rows * c, {
      for i in range(rows) {
        for k in range(cols) {
          let v = vals.at(i).at(k)
          place(dx: k * c, dy: i * c, rect(width: c, height: c, fill: if v < 0 { white } else { _ramp(t, v) },
            stroke: 0.35pt + white))
        }
      }
      place(rect(width: cols * c, height: rows * c, stroke: 0.5pt + muted))
    })
  } else if it.kind == "vector" {
    let vals = if it.values != none { it.values } else { _rand(seed * 31 + 7, it.n) }
    let n = vals.len()
    let c = it.cell
    let (w, h) = if it.orient == "v" { (c, n * c) } else { (n * c, c) }
    box(width: w, height: h, {
      for (i, v) in vals.enumerate() {
        let (x, y) = if it.orient == "v" { (0pt, i * c) } else { (i * c, 0pt) }
        place(dx: x, dy: y, rect(width: c, height: c, fill: _ramp(t, v), stroke: 0.35pt + white))
      }
      place(rect(width: w, height: h, stroke: 0.5pt + muted))
    })
  } else if it.kind == "tensor" {
    let w = it.sw + it.dx * (it.depth - 1)
    let h = it.sh + it.dy * (it.depth - 1)
    box(width: w, height: h, {
      for k in range(it.depth - 1, -1, step: -1) {
        let fill = if k == 0 { t.fill-strong } else { mix(t.fill, white, 0.25 * k / it.depth) }
        place(dx: k * it.dx, dy: h - it.sh - k * it.dy, rect(width: it.sw, height: it.sh, radius: 0.8pt,
          fill: fill, stroke: 0.55pt + if t.grey { faint } else { t.stroke }))
      }
    })
  } else if it.kind == "plot" {
    let (w, h) = (it.w, it.h)
    let pad = 2pt
    let presets = (
      decay: (x, r) => calc.exp(-4 * x) * 0.9 + 0.05,
      noisy: (x, r) => calc.exp(-3.5 * x) * 0.85 + 0.08 + (r - 0.5) * 0.12 * (1 - x * 0.5),
      rise: (x, r) => 0.9 - calc.exp(-4 * x) * 0.85,
      sine: (x, r) => 0.5 + 0.38 * calc.sin(x * 2 * calc.pi * 1.5),
      bell: (x, r) => 0.08 + 0.85 * calc.exp(-calc.pow(x - 0.5, 2) / 0.02),
      step: (x, r) => if x < 0.35 { 0.2 } else if x < 0.7 { 0.55 } else { 0.85 },
    )
    box(width: w, height: h, {
      if it.frame {
        place(curve(stroke: 0.5pt + muted, curve.move((pad, pad)), curve.line((pad, h - pad)),
          curve.line((w - pad, h - pad))))
      }
      for (k, ser) in it.series.enumerate() {
        let rs = _rand(31 * (k + 1) + it.seed, 40)
        let ys = if type(ser) == array { ser } else { range(40).map(i => presets.at(ser)(i / 39, rs.at(i))) }
        let lo = calc.min(0, ..ys)
        let hi = calc.max(1, ..ys)
        let n = ys.len()
        let pts = ys.enumerate().map(((i, y)) => (pad + 1.5pt + (w - 2 * pad - 2pt) * i / (n - 1),
          h - pad - 1.5pt - (h - 2 * pad - 3pt) * (y - lo) / (hi - lo)))
        let tc = tone(it.tones.at(calc.rem(k, it.tones.len())))
        place(curve(stroke: (paint: if tc.grey { faint } else { tc.base }, thickness: 0.9pt, join: "round",
          cap: "round"), curve.move(pts.first()), ..pts.slice(1).map(p => curve.line(p))))
      }
    })
  } else if it.kind == "graph" {
    let (w, h) = (it.w, it.h)
    let rs = _rand(it.seed, 64)
    let N = if it.points != none { it.points.len() } else { it.n }
    let P = if it.points != none { it.points.map(((u, v)) => (u * w, v * h)) } else {
      range(N).map(i => {
        let a = 2 * calc.pi * i / N - calc.pi / 2
        let jit = 0.82 + 0.18 * rs.at(i)
        (w / 2 + calc.cos(a) * (w / 2 - 3pt) * jit, h / 2 + calc.sin(a) * (h / 2 - 3pt) * jit)
      })
    }
    let E = if it.edges != none { it.edges } else {
      let out = ()
      for i in range(N) {
        out.push((i, calc.rem(i + 1, N)))
        if rs.at(20 + i) < 0.45 { out.push((i, calc.rem(i + 2 + int(rs.at(40 + i) * (N - 3)), N))) }
      }
      out
    }
    let hot = tone("accent")
    box(width: w, height: h, {
      for (a, b) in E { place(line(start: P.at(a), end: P.at(b), stroke: 0.5pt + faint)) }
      for (i, p) in P.enumerate() {
        let hl = i in it.highlight
        place(dx: p.at(0) - it.r, dy: p.at(1) - it.r, circle(radius: it.r, fill: if hl { hot.base } else { t.fill-strong },
          stroke: 0.5pt + if hl { white } else { t.stroke }))
      }
    })
  } else if it.kind == "mlp" {
    let (w, h) = (it.w, it.h)
    let L = it.layers
    let m = calc.max(..L)
    let step = calc.min(6.5pt, (h - 6pt) / m)
    let xs = range(L.len()).map(i => 3pt + (w - 6pt) * i / calc.max(1, L.len() - 1))
    let pos = L.enumerate().map(((i, k)) => range(k).map(q => (xs.at(i), h / 2 + (q - (k - 1) / 2) * step)))
    box(width: w, height: h, {
      for i in range(L.len() - 1) {
        for p in pos.at(i) { for q in pos.at(i + 1) { place(line(start: p, end: q, stroke: 0.35pt + guide)) } }
      }
      for col in pos { for p in col {
        place(dx: p.at(0) - it.r, dy: p.at(1) - it.r, circle(radius: it.r, fill: t.fill,
          stroke: 0.5pt + if t.grey { faint } else { t.stroke }))
      } }
    })
  } else if it.kind == "placeholder" {
    let (w, h) = (it.w, it.h)
    box(width: w, height: h, {
      place(rect(width: w, height: h, fill: rgb("#FAFAFA"), stroke: (paint: faint, thickness: 0.5pt,
        dash: (2pt, 1.5pt))))
      place(line(start: (0pt, 0pt), end: (w, h), stroke: 0.4pt + rgb("#E0E0E0")))
      place(line(start: (w, 0pt), end: (0pt, h), stroke: 0.4pt + rgb("#E0E0E0")))
      place(center + horizon, text(size: j.small, fill: muted, it.body))
    })
  }
}

#let _op-body(it, j) = {
  let t = tone(it.tone)
  let d = it.d
  let k = d / 2 * 0.52
  box(width: d, height: d, {
    place(circle(radius: d / 2, fill: if t.grey { white } else { t.fill }, stroke: 0.7pt + if t.grey { muted } else { t.stroke }))
    let s = it.symbol
    if s == "+" or s == "x" {
      let a = if s == "+" { 0deg } else { 45deg }
      for b in (a, a + 90deg) {
        place(line(start: (d / 2 - calc.cos(b) * k, d / 2 - calc.sin(b) * k),
          end: (d / 2 + calc.cos(b) * k, d / 2 + calc.sin(b) * k), stroke: (paint: ink, thickness: 0.8pt, cap: "round")))
      }
    } else if s == "." {
      place(dx: d / 2 - 1.1pt, dy: d / 2 - 1.1pt, circle(radius: 1.1pt, fill: ink))
    } else {
      place(center + horizon, text(size: j.small, fill: ink, s))
    }
  })
}

// geometry helpers (pt floats, y-up as in cetz/fletcher)
#let _rect-of(g) = {
  let half = calc.max(g.w, g.at("cap-w", default: 0)) / 2
  (g.x - half, g.y - g.h / 2 - g.below, g.x + half, g.y + g.h / 2)
}
#let _union(rs) = (calc.min(..rs.map(r => r.at(0))), calc.min(..rs.map(r => r.at(1))),
  calc.max(..rs.map(r => r.at(2))), calc.max(..rs.map(r => r.at(3))))
#let _hit(a, b, pad: 0) = a.at(0) < b.at(2) - pad and b.at(0) < a.at(2) - pad and a.at(1) < b.at(3) - pad and b.at(1) < a.at(3) - pad
#let _seg-hits-rect(p, q, r) = {
  // Liang–Barsky clip test
  let (x0, y0, x1, y1) = r
  let d = (q.at(0) - p.at(0), q.at(1) - p.at(1))
  let t0 = 0.0
  let t1 = 1.0
  for (pp, qq) in ((-d.at(0), p.at(0) - x0), (d.at(0), x1 - p.at(0)), (-d.at(1), p.at(1) - y0), (d.at(1), y1 - p.at(1))) {
    if calc.abs(pp) < 1e-9 { if qq < 0 { return false } } else {
      let rr = qq / pp
      if pp < 0 { t0 = calc.max(t0, rr) } else { t1 = calc.min(t1, rr) }
      if t0 > t1 { return false }
    }
  }
  true
}
#let _seg-cross(a, b, c, d) = {
  let o(p, q, r) = (q.at(0) - p.at(0)) * (r.at(1) - p.at(1)) - (q.at(1) - p.at(1)) * (r.at(0) - p.at(0))
  let d1 = o(c, d, a)
  let d2 = o(c, d, b)
  let d3 = o(a, b, c)
  let d4 = o(a, b, d)
  ((d1 > 0.01 and d2 < -0.01) or (d1 < -0.01 and d2 > 0.01)) and ((d3 > 0.01 and d4 < -0.01) or (d3 < -0.01 and d4 > 0.01))
}

#let _flatten(xs) = {
  let out = ()
  for x in xs {
    if type(x) == array { out += _flatten(x) }
    else if type(x) == content {
      if x.func() == metadata { out.push(x) }
      else if x.has("children") { out += _flatten(x.children) }
      else if x.has("body") and x.func() != metadata { out += _flatten((x.body,)) }
    }
  }
  out
}

// ===================================================================== diagram
/// Draw a diagram. Items: sf.node / op / matrix / vector / tensor / plot / graph / mlp / placeholder /
/// edge / loop / group / badge / zoom / brace / note / same-size, and plain fletcher nodes / edges.
/// spacing: (column gap, row gap). lint: embed a geometry report that check.py / sf.compile_typst read.
#let diagram(..args, spacing: (18pt, 24pt), debug: false, axes: (ltr, ttb), cell-size: 0pt, lint: true) = context {
  let j = _profile()
  let items = _flatten(args.pos())
  let objs = ()       // fletcher content, in order
  let annots = ()
  let sames = ()
  let info = (:)      // name -> (below: pt, members: ..)
  let measured = (:)  // name -> (w, h) for sf nodes (before same-size)
  let pending = ()    // sf node dicts with resolved name
  let rows = (:)      // name -> pos
  // pass 1: names, sizes
  for (i, m) in items.enumerate() {
    let v = m.value
    if type(v) != dictionary or "sf" not in v { pending.push((raw: m)); continue }
    if v.sf in ("node", "op", "glyph") {
      let name = if v.name == none { label("sf-auto-" + str(i)) } else if type(v.name) == str { label(v.name) } else { v.name }
      v.name = name
      let body = if v.sf == "node" { _node-content(v, j, tone(v.tone)) } else if v.sf == "op" { _op-body(v, j) } else { _glyph-body(v, j, i) }
      let sz = measure(body)
      let (w, h) = (sz.width, sz.height)
      let below = 0pt
      if v.sf == "node" {
        w = if v.width != auto { v.width } else { calc.max(v.min-width, w + 2 * v.pad-x) }
        h = if v.height != auto { v.height } else { calc.max(v.min-height, h + 2 * v.pad-y) }
        if v.shape == "diamond" and v.width == auto { w *= 1.45; h *= 1.35 }
        if v.shape in ("hexagon", "io") and v.width == auto { w += 8pt }
        if v.shape == "cylinder" and v.height == auto { h += 5pt }
        if v.shape == "circle" { let dd = calc.max(w, h); w = dd; h = dd }
      } else if v.sf == "glyph" and v.label != none {
        let cm = measure(text(size: j.small, v.label))
        let ch = cm.height
        v.insert("cap-h", ch)
        v.insert("cap-w", cm.width)
        below = 3pt + ch + 1.5pt
      }
      v.insert("body", body)
      v.insert("w", w)
      v.insert("h", h)
      info.insert(str(name), (below: below, cap-w: v.at("cap-w", default: 0pt), pos: v.pos))
      pending.push((sf: v))
    } else if v.sf == "same" { sames.push(v); pending.push((skip: true)) }
    else { pending.push((sf: v)) }
  }
  // same-size groups
  for s in sames {
    let keys = s.names.map(n => str(n))
    let ws = pending.filter(p => "sf" in p and p.sf.at("name", default: none) != none and str(p.sf.name) in keys)
    let W = calc.max(..ws.map(p => p.sf.w))
    let H = calc.max(..ws.map(p => p.sf.h))
    pending = pending.map(p => {
      if "sf" in p and p.sf.at("name", default: none) != none and type(p.sf.name) == label and str(p.sf.name) in keys {
        if s.dim != "height" { p.sf.w = W }
        if s.dim != "width" { p.sf.h = H }
      }
      p
    })
  }
  let size-of = (:)
  for p in pending { if "sf" in p and p.sf.at("w", default: none) != none { size-of.insert(str(p.sf.name), (p.sf.w, p.sf.h)) } }
  // relative placement -> fletcher (rel: (dx, dy), to: name), y-up, centre to centre
  let resolve-pos(v) = {
    let p = v.pos
    if type(p) != dictionary or "sf-rel" not in p { return p }
    let k = str(p.of)
    assert(k in size-of, message: "scifig: '" + k + "' must be an sf item defined in this diagram")
    let (wr, hr) = size-of.at(k)
    let br = info.at(k).below
    let bs = info.at(str(v.name)).below
    let (dx, dy) = if p.sf-rel == "right" { (wr / 2 + p.gap + v.w / 2, 0pt) }
      else if p.sf-rel == "left" { (-(wr / 2 + p.gap + v.w / 2), 0pt) }
      else if p.sf-rel == "below" { (0pt, -(hr / 2 + br + p.gap + v.h / 2)) }
      else { (0pt, hr / 2 + p.gap + bs + v.h / 2) }
    (rel: (dx + p.dx, dy - p.dy), to: p.of)
  }
  // pass 2: build fletcher objects
  let loops = ()
  for p in pending {
    if "raw" in p { objs.push(p.raw); continue }
    if "skip" in p { continue }
    let v = p.sf
    if v.sf in ("node", "op", "glyph") { v.pos = resolve-pos(v) }
    if v.sf == "node" {
      let t = tone(v.tone)
      let fill = if v.fill != auto { v.fill } else if v.shape == "plain" { none } else if v.emphasis { t.fill-strong } else { t.fill }
      let sc = if v.stroke != auto { v.stroke } else if v.shape == "plain" { none } else if v.emphasis or t.grey { t.stroke } else { mix(t.stroke, white, 0.15) }
      let sw = if v.stroke-width != auto { v.stroke-width } else if v.emphasis { 1.2pt } else { 0.7pt }
      let stroke = if sc == none { none } else { (paint: sc, thickness: sw, dash: if v.dashed { (2.2pt, 1.6pt) } else { none }) }
      let shape = if v.shape in ("rect", "plain") { _shape-rect.with(radius: if v.shape == "plain" { 0pt } else { v.radius }, corner: v.corner, smoothing: v.smoothing) }
        else if v.shape == "pill" { fletcher.shapes.pill } else if v.shape == "circle" { fletcher.shapes.circle }
        else if v.shape == "ellipse" { fletcher.shapes.ellipse } else if v.shape == "diamond" { _diamond }
        else if v.shape == "hexagon" { _hexagon } else if v.shape == "io" { _io } else if v.shape == "doc" { _doc }
        else if v.shape == "cylinder" { _cylinder } else { panic("scifig: unknown shape '" + v.shape + "'") }
      let body = pad(x: v.pad-x, if v.shape == "cylinder" { pad(top: 3.5pt, v.body) } else { v.body })
      objs.push(fletcher.node(v.pos, body, name: v.name, width: v.w, height: v.h, inset: 0pt, shape: shape,
        fill: fill, stroke: stroke))
    } else if v.sf == "op" {
      objs.push(fletcher.node(v.pos, v.body, name: v.name, width: v.w, height: v.h, inset: 0pt, shape: fletcher.shapes.circle, stroke: none, fill: none))
    } else if v.sf == "glyph" {
      // caption hangs below the glyph without changing its size, so the glyph stays on the row's axis
      let body = if v.label == none { v.body } else {
        box(width: v.w, height: v.h, {
          v.body
          place(center + top, dy: v.h + 3pt, box(width: v.cap-w + 0.5pt,
            align(center, text(size: j.small, fill: muted, v.label))))
        })
      }
      objs.push(fletcher.node(v.pos, body, name: v.name, width: v.w, height: v.h, inset: 0pt, shape: fletcher.shapes.rect, stroke: none, fill: none))
    } else if v.sf == "loop" {
      // depth below/above the row: clear every sf item on the row between the two columns
      let fk = str(v.from)
      let tk = str(v.to)
      assert(fk in info and tk in info, message: "scifig.loop: give names of sf items (got " + fk + ", " + tk + ")")
      let is-cell(q) = type(q) == array and q.len() == 2
      let ext = 0pt
      for k in (fk, tk) {
        ext = calc.max(ext, size-of.at(k).at(1) / 2 + if v.side == "below" { info.at(k).below } else { 0pt })
      }
      if is-cell(info.at(fk).pos) and is-cell(info.at(tk).pos) {
        let (c0, r0) = info.at(fk).pos
        let (c1, _) = info.at(tk).pos
        let lo = calc.min(c0, c1)
        let hi = calc.max(c0, c1)
        for (k, inf) in info {
          if not is-cell(inf.pos) or k not in size-of { continue }
          let (c, r) = inf.pos
          if r == r0 and c >= lo and c <= hi {
            ext = calc.max(ext, size-of.at(k).at(1) / 2 + if v.side == "below" { inf.below } else { 0pt })
          }
        }
      }
      let depth = if v.depth == auto { ext + v.clearance } else { v.depth }
      // a loop leaving a labelled group must also clear that group's label band
      if v.depth == auto {
        let groups = pending.filter(q => "sf" in q and q.sf.sf == "group").map(q => q.sf)
        let members-of(g) = {
          let out = ()
          for m in g.members {
            if type(m) == str {
              let sub = groups.find(x => x.id == m)
              if sub != none { out += members-of(sub) }
            } else { out.push(str(m)) }
          }
          out
        }
        for g in groups {
          if g.label == none { continue }
          let top = g.label-pos.starts-with("top")
          if (v.side == "above") != top { continue }
          let mem = members-of(g)
          if (fk in mem) == (tk in mem) { continue }   // both inside: the group grows around the loop
          let hmax = calc.max(..mem.filter(k => k in size-of).map(k => size-of.at(k).at(1) / 2 + if top { 0pt } else { info.at(k).below }))
          let band = measure(text(size: j.small, weight: "bold", g.label)).height + 4pt
          depth = calc.max(depth, hmax + g.pad + band + 5pt)
        }
      }
      let dy = if v.side == "below" { -depth } else { depth }
      let ea = v.args.named()
      if "label-side" not in ea { ea.insert("label-side", if v.side == "below" { left } else { right }) }
      objs.push(edge(v.from, (rel: (0pt, dy), to: v.from), (rel: (0pt, dy), to: v.to), v.to, ..v.args.pos(), ..ea))
      loops.push((from: fk, to: tk, side: v.side, depth: depth, label-side: ea.at("label-side"),
        label: ea.at("label", default: v.args.pos().find(a => type(a) == content))))
    } else { annots.push(v) }
  }

  let render(grid, nodes, edges, options) = {
    let geo = (:)
    for n in nodes {
      if n.name == none or n.enclose.len() > 0 { continue }
      let k = str(n.name)
      geo.insert(k, (x: n.pos.xyz.at(0) / 1pt, y: n.pos.xyz.at(1) / 1pt, w: n.size.at(0) / 1pt, h: n.size.at(1) / 1pt,
        below: info.at(k, default: (below: 0pt)).below / 1pt, cap-w: info.at(k, default: (cap-w: 0pt)).cap-w / 1pt))
    }
    let issues = ()
    let small = j.small
    // ---- group boxes
    let gbox = (:)
    let gmembers = (:)
    let label-h = measure(text(size: small, weight: "bold", [Ag])).height / 1pt
    for g in annots.filter(a => a.sf == "group") {
      let mem = ()
      let rects = ()
      for m in g.members {
        let k = str(m)
        if type(m) == str and m in gbox { rects.push(gbox.at(m)); mem += gmembers.at(m); continue }
        assert(k in geo, message: "scifig.group '" + g.id + "': unknown member " + k)
        rects.push(_rect-of(geo.at(k)))
        mem.push(k)
      }
      for l in loops {
        if l.from in mem and l.to in mem {
          let a = geo.at(l.from)
          let b = geo.at(l.to)
          let yl = if l.side == "below" { a.y - l.depth / 1pt } else { a.y + l.depth / 1pt }
          // fletcher puts a "left" label on the left of the direction of travel
          let leftward = a.x > b.x
          let label-below = if l.label-side == left { leftward } else if l.label-side == right { not leftward } else { false }
          let outward = if l.side == "below" { label-below } else { not label-below }
          let lh = if l.label != none and outward { measure(text(size: small, l.label)).height / 1pt + 5 } else { 1.5 }
          rects.push((calc.min(a.x, b.x), if l.side == "below" { yl - lh } else { yl }, calc.max(a.x, b.x), if l.side == "below" { yl } else { yl + lh }))
        }
      }
      let u = _union(rects)
      let pad = g.pad / 1pt
      let px = if g.pad-x == auto { pad } else { g.pad-x / 1pt }
      let top = if g.label != none and g.label-pos.starts-with("top") { label-h + 4 } else { 0 }
      let bot = if g.label != none and g.label-pos.starts-with("bottom") { label-h + 4 } else { 0 }
      gbox.insert(g.id, (u.at(0) - px, u.at(1) - pad - bot, u.at(2) + px, u.at(3) + pad + top))
      gmembers.insert(g.id, mem)
    }
    let ref-rect(k, core: false) = {
      let k = if type(k) == str { k } else { str(k) }
      if k in gbox { gbox.at(k) } else {
        assert(k in geo, message: "scifig: unknown item or group " + k)
        let g = geo.at(k)
        if core { (g.x - g.w / 2, g.y - g.h / 2, g.x + g.w / 2, g.y + g.h / 2) } else { _rect-of(g) }
      }
    }
    // ---- lint (geometry is exact here)
    if lint {
      let keys = geo.keys()
      let boxes = keys.map(k => (k, _rect-of(geo.at(k))))
      for (a, (ka, ra)) in boxes.enumerate() {
        for (kb, rb) in boxes.slice(a + 1) {
          if _hit(ra, rb, pad: 0.5) { issues.push(("ERROR", "overlap", ka + " overlaps " + kb)) }
        }
      }
      for (gid, r) in gbox {
        for (k, rb) in boxes {
          if k not in gmembers.at(gid) and _hit(r, rb, pad: 0.5) {
            issues.push(("WARN", "group-intrusion", k + " is inside group '" + gid + "' but not a member"))
          }
        }
      }
      let gids = gbox.keys()
      for (a, ga) in gids.enumerate() {
        for gb in gids.slice(a + 1) {
          let ma = gmembers.at(ga)
          let mb = gmembers.at(gb)
          let nested = mb.all(x => x in ma) or ma.all(x => x in mb)
          if not nested and _hit(gbox.at(ga), gbox.at(gb), pad: 0.5) { issues.push(("WARN", "group-overlap", ga + " overlaps " + gb)) }
        }
      }
      let segs = ()
      for (ei, e) in edges.enumerate() {
        if e.kind == "arc" { continue }   // bent edges: the vertices are not the drawn path
        let vs = e.final-vertices.map(p => (p.at(0) / 1pt, p.at(1) / 1pt))
        if vs.len() < 2 { continue }
        let ends = (vs.first(), vs.last())
        let own = boxes.filter(((k, r)) => ends.any(p => p.at(0) >= r.at(0) - 0.5 and p.at(0) <= r.at(2) + 0.5 and p.at(1) >= r.at(1) - 0.5 and p.at(1) <= r.at(3) + 0.5)).map(b => b.at(0))
        for s in range(vs.len() - 1) {
          let (p, q) = (vs.at(s), vs.at(s + 1))
          segs.push((ei, p, q))
          for (k, r) in boxes {
            if k in own { continue }
            if _seg-hits-rect(p, q, (r.at(0) + 1, r.at(1) + 1, r.at(2) - 1, r.at(3) - 1)) {
              issues.push(("WARN", "edge-through", "an edge crosses " + k + " (reroute: loop / bend / corner, or move it)"))
            }
          }
        }
        if vs.len() == 2 and own.len() == 2 {
          let (a, b) = own.map(k => geo.at(k))
          let gap = if calc.abs(a.y - b.y) < 0.5 { calc.abs(a.x - b.x) - (a.w + b.w) / 2 }
            else if calc.abs(a.x - b.x) < 0.5 { calc.abs(a.y - b.y) - (a.h + b.h) / 2 - calc.max(a.below, b.below) } else { 99 }
          if gap < 9 { issues.push(("WARN", "edge-short", own.join(" -> ") + " arrow is only " + str(calc.round(gap, digits: 1)) + " pt long; raise spacing")) }
        }
      }
      let crossings = 0
      for (i, (ea, p, q)) in segs.enumerate() {
        for (eb, r, s) in segs.slice(i + 1) { if ea != eb and _seg-cross(p, q, r, s) { crossings += 1 } }
      }
      if crossings > 0 { issues.push(("INFO", "crossings", str(crossings) + " edge crossing(s); >= 2 usually means the layout needs rethinking")) }
    }

    let P(x, y) = (x * 1pt, y * 1pt)
    [#cetz.canvas({
      import cetz.draw: *
      // groups: outermost first
      for g in annots.filter(a => a.sf == "group").rev() {
        let t = tone(g.tone)
        let (x0, y0, x1, y1) = gbox.at(g.id)
        let fill = if g.fill == false or g.fill == none { none } else if g.fill != auto { g.fill } else { t.soft }
        let sc = if g.stroke != auto { g.stroke } else if g.dashed { if t.grey { faint } else { mix(t.stroke, white, 0.2) } } else { none }
        let st = if sc == none { none } else { (paint: sc, thickness: 0.6pt, dash: if g.dashed { (2.5pt, 1.8pt) } else { none }) }
        group({     // scoped style: must not leak into the edges drawn afterwards
          set-style(fill: fill, stroke: st)
          _cetz-roundrect(x1 - x0, y1 - y0, g.radius / 1pt, corner: g.corner, smoothing: g.smoothing, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2)
        })
        if g.label != none {
          let lp = g.label-pos
          let dot = g.label-dot and not t.grey and lp.ends-with("left")
          let cap = 0.716 * small / 1pt
          let lab = box({
            if dot { box(width: cap * 1pt, height: cap * 1pt, radius: 0.8pt, fill: t.base); h(2.2pt) }
            text(size: small, weight: "bold", fill: ink, g.label)
          })
          let x = if lp.ends-with("left") { x0 + 5 } else if lp.ends-with("right") { x1 - 5 } else { (x0 + x1) / 2 }
          let y = if lp.starts-with("top") { y1 - 3.2 } else { y0 + 3.2 }
          let anc = (if lp.starts-with("top") { "north" } else { "south" }) + (if lp.ends-with("left") { "-west" } else if lp.ends-with("right") { "-east" } else { "" })
          content(P(x, y), lab, anchor: anc)
        }
      }
      fletcher.draw-diagram(grid, nodes, edges, debug: options.debug)
      // invisible boxes so the canvas (and the page) includes captions hanging below glyphs
      for (k, g) in geo {
        if g.below > 0 {
          let r = _rect-of(g)
          rect(P(r.at(0), r.at(1)), P(r.at(2), g.y - g.h / 2), stroke: none, fill: none)
        }
      }
      for a in annots {
        if a.sf == "badge" {
          let (x0, y0, x1, y1) = ref-rect(a.target, core: true)
          let x = if a.corner.ends-with("left") { x0 } else { x1 }
          let y = if a.corner.starts-with("top") { y1 } else { y0 }
          let fs = calc.max(5.5pt, j.min)
          let r = 4.2 * fs / 5.5pt
          circle(P(x, y), radius: r * 1pt, fill: if a.tone == none { ink } else { tone(a.tone).base }, stroke: 0.8pt + white)
          content(P(x, y), text(size: fs, weight: "bold", fill: white, str(a.n)))
        } else if a.sf == "zoom" {
          let s = ref-rect(a.source)
          let d = ref-rect(a.detail)
          let pd = a.pad / 1pt
          let A = (s.at(0) - pd, s.at(1) - pd, s.at(2) + pd, s.at(3) + pd)
          let st = (paint: faint, thickness: 0.55pt, dash: (2pt, 1.5pt))
          rect(P(A.at(0), A.at(1)), P(A.at(2), A.at(3)), radius: 2pt, stroke: st, fill: none)
          let pairs = if d.at(3) <= A.at(1) { ((A.at(0), A.at(1), d.at(0), d.at(3)), (A.at(2), A.at(1), d.at(2), d.at(3))) }
            else if d.at(1) >= A.at(3) { ((A.at(0), A.at(3), d.at(0), d.at(1)), (A.at(2), A.at(3), d.at(2), d.at(1))) }
            else if d.at(0) >= A.at(2) { ((A.at(2), A.at(3), d.at(0), d.at(3)), (A.at(2), A.at(1), d.at(0), d.at(1))) }
            else { ((A.at(0), A.at(3), d.at(2), d.at(3)), (A.at(0), A.at(1), d.at(2), d.at(1))) }
          for (ax, ay, bx, by) in pairs { line(P(ax, ay), P(bx, by), stroke: st) }
        } else if a.sf == "brace" {
          let b = _union(a.members.map(ref-rect))
          let off = a.offset / 1pt
          let dep = a.depth / 1pt
          let (p, q, n) = if a.side == "bottom" { ((b.at(0), b.at(1) - off), (b.at(2), b.at(1) - off), (0, -1)) }
            else if a.side == "top" { ((b.at(0), b.at(3) + off), (b.at(2), b.at(3) + off), (0, 1)) }
            else if a.side == "left" { ((b.at(0) - off, b.at(3)), (b.at(0) - off, b.at(1)), (-1, 0)) }
            else { ((b.at(2) + off, b.at(3)), (b.at(2) + off, b.at(1)), (1, 0)) }
          let m = ((p.at(0) + q.at(0)) / 2, (p.at(1) + q.at(1)) / 2)
          let hh = dep / 2
          let mv(pt, k) = (pt.at(0) + n.at(0) * k, pt.at(1) + n.at(1) * k)
          let a1 = mv(p, hh)
          let m1 = mv(m, hh)
          let a2 = mv(q, hh)
          let tip = mv(m, dep)
          let lerp(u, v, t) = (u.at(0) + (v.at(0) - u.at(0)) * t, u.at(1) + (v.at(1) - u.at(1)) * t)
          let st = (paint: muted, thickness: 0.6pt, join: "round")
          merge-path(stroke: st, fill: none, {
            bezier(P(..p), P(..lerp(a1, m1, 0.25)), P(..a1))
            line(P(..lerp(a1, m1, 0.25)), P(..lerp(a1, m1, 0.75)))
            bezier(P(..lerp(a1, m1, 0.75)), P(..tip), P(..m1))
            bezier(P(..tip), P(..lerp(a2, m1, 0.75)), P(..m1))
            line(P(..lerp(a2, m1, 0.75)), P(..lerp(a2, m1, 0.25)))
            bezier(P(..lerp(a2, m1, 0.25)), P(..q), P(..a2))
          })
          if a.label != none {
            let anc = if a.side == "bottom" { "north" } else if a.side == "top" { "south" } else if a.side == "left" { "east" } else { "west" }
            content(P(..mv(tip, 2.5)), text(size: small, fill: muted, a.label), anchor: anc)
          }
        } else if a.sf == "note" {
          let b = ref-rect(a.target, core: true)
          let cx = (b.at(0) + b.at(2)) / 2
          let cy = (b.at(1) + b.at(3)) / 2
          let dist = a.dist / 1pt
          let (s, e, anc) = if a.side == "left" { ((b.at(0) - 1.5, cy), (b.at(0) - dist, cy), "east") }
            else if a.side == "right" { ((b.at(2) + 1.5, cy), (b.at(2) + dist, cy), "west") }
            else if a.side == "top" { ((cx, b.at(3) + 1.5), (cx, b.at(3) + dist), "south") }
            else { ((cx, b.at(1) - 1.5), (cx, b.at(1) - dist), "north") }
          line(P(..s), P(..e), stroke: 0.5pt + faint)
          circle(P(..s), radius: 0.9pt, fill: faint, stroke: none)
          let gapv = if anc == "east" { (-2, 0) } else if anc == "west" { (2, 0) } else if anc == "south" { (0, 2) } else { (0, -2) }
          content(P(e.at(0) + gapv.at(0), e.at(1) + gapv.at(1)), text(size: small, fill: muted, style: if a.italic { "italic" } else { "normal" }, a.body), anchor: anc)
        }
      }
    })#metadata((kind: "scifig-diagram", issues: issues, journal: _config.get().journal))<sf-lint>]
  }

  fletcher.diagram(..objs, spacing: spacing, debug: debug, axes: axes, cell-size: cell-size,
    edge-stroke: 0.75pt + muted, edge-corner-radius: 3pt, node-inset: 0pt, crossing-fill: white,
    label-sep: 1.6pt, label-size: j.small,
    label-wrapper: e => box(text(size: j.small, fill: muted, e.label), inset: (x: 1.2pt, y: 1pt), fill: e.label-fill),
    render: render)
}

// ===================================================================== outside the canvas
/// Legend row: items = ((tone: "neutral", label: [data]), (tone: "accent", kind: "arrow", label: [...]), ...)
/// kind: "box" (default) | "line" | "dashed" | "arrow".
#let legend(items, gap: 10pt) = context {
  let j = _profile()
  let sw(it) = {
    let t = tone(it.at("tone", default: "neutral"))
    let kind = it.at("kind", default: "box")
    if kind == "box" {
      box(width: 7pt, height: 5pt, radius: 1pt, fill: t.fill, stroke: 0.6pt + t.stroke, baseline: 0.5pt)
    } else {
      let col = if t.grey { muted } else { t.base }
      let st = (paint: col, thickness: 0.9pt, dash: if kind == "dashed" { (2.4pt, 1.6pt) } else { none })
      box(width: 10pt, height: 5pt, baseline: 0.5pt, {
        place(dy: 2.5pt, line(length: if kind == "arrow" { 6.5pt } else { 10pt }, stroke: st))
        if kind == "arrow" { place(dx: 5.5pt, dy: 0.7pt, polygon(fill: col, (0pt, 0pt), (4.5pt, 1.8pt), (0pt, 3.6pt), (1pt, 1.8pt))) }
      })
    }
  }
  set text(size: j.small, fill: ink)
  items.map(it => box[#sw(it)#h(3pt)#it.label]).join(h(gap))
}

/// Bold panel label (lowercase for Nature, uppercase for Science/Cell/PNAS).
#let panel-label(l) = context {
  let j = _profile()
  text(size: j.label, weight: "bold", fill: ink, if j.case == "upper" { upper(l) } else { l })
}

/// One labelled panel: bold label at the top-left, body below (centered by default).
#let panel(l, body, align: center, gap: 1pt) = block(width: 100%, {
  set std.align(left)
  panel-label(l)
  v(gap, weak: false)
  std.align(align, body)
})

/// Lay out panels in a grid with bold a/b/c labels at each panel's top-left.
/// cells: content (a diagram, or `image("panel.pdf")` made by scifig.save at its final size).
/// labels: auto (a, b, c ...) | array | none (when the panels already carry labels).
#let panels(..cells, columns: 1, gutter: 3mm, row-gutter: auto, labels: auto, align: left + top, label-gap: 1pt) = {
  let cs = cells.pos()
  let labs = if labels == auto { range(cs.len()).map(i => "abcdefghijklmnopqrstuvwxyz".at(i)) } else if labels == none { cs.map(_ => none) } else { labels }
  grid(columns: columns, column-gutter: gutter, row-gutter: if row-gutter == auto { gutter } else { row-gutter },
    align: align, ..cs.zip(labs).map(((c, l)) => if l == none { c } else {
      std.align(left, stack(dir: ttb, spacing: label-gap, panel-label(l), c))
    }))
}
