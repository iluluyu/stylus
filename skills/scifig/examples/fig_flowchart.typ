// Algorithm flowchart (single column, top -> bottom) — one self-contained figure file.
// Build:  python scripts/check.py examples/fig_flowchart.typ   (PDF + SVG + PNG + lint)
// Shows: one column of steps on the grid, a decision diamond, start/end pills, the novel step as
// the only accent, a "no" loop on the right, a side note.
#import "../scripts/scifig.typ" as sf
#show: sf.setup.with(journal: "nature", width: "single")

#let flowchart = sf.diagram(
  spacing: (14pt, 13pt),
  sf.node((0, 0), [Initialise $theta_0$, $hat(H)_0 = I$], shape: "pill", name: <init>),
  sf.node((0, 1), [Sample mini-batch $B_t$], tone: "primary", name: <sample>),
  sf.node((0, 2), [Gradient $g_t = nabla cal(L)(theta_t)$], tone: "primary", name: <grad>),
  sf.node((0, 3), [Update curvature $hat(H)_t$], sub: [rank-$r$ sketch], tone: "accent", emphasis: true,
    name: <curv>),
  sf.node((0, 4), [Step $theta_(t+1) = theta_t - eta hat(H)_t^(-1) g_t$], tone: "primary", name: <step>),
  sf.node((0, 5), [Converged?], shape: "diamond", name: <conv>),
  sf.node((0, 6), [Return $theta_T$], shape: "pill", name: <done>),
  sf.same-size((<sample>, <grad>, <curv>, <step>), dim: "width"),

  sf.edge(<init>, <sample>),
  sf.edge(<sample>, <grad>),
  sf.edge(<grad>, <curv>),
  sf.edge(<curv>, <step>),
  sf.edge(<step>, <conv>),
  sf.edge(<conv>, <done>, [yes], label-side: left),
  // the "no" branch: out of the diamond's right corner, up the right side, into the sampling step
  sf.edge(<conv>, (1, 5), (1, 1), <sample>, [no], label-pos: (1, 50%), label-side: left),
  sf.note(<curv>, [only $cal(O)(d r)$ extra memory], side: "left", dist: 10pt),
)

#sf.panel("b", flowchart)
