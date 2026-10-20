// Method overview for an optimization paper (double column) — one self-contained figure file.
// Build:  python scripts/check.py examples/fig_method.typ      (PDF + SVG + PNG + lint)
// Shows: grid rows, glyphs (matrix / plot / tensor), groups, feedback loop, emphasis on the novel
// component, a compact zoomed-in detail row, brace, step badges, legend, panel label.
#import "../scripts/scifig.typ" as sf
#show: sf.setup.with(journal: "nature", width: "double")

#let method = sf.diagram(
  spacing: (20pt, 26pt),
  // ---- row 1: the training loop, read left -> right
  sf.node((0, 0), [Training data], sub: $cal(D)_"train"$, shape: "cylinder", name: <data>),
  sf.matrix((1, 0), rows: 6, cols: 5, tone: "neutral", label: [mini-batch $B_t$], name: <batch>, seed: 3),
  sf.node((2, 0), [Model $f_theta$], sub: [any architecture], tone: "primary", name: <model>),
  sf.node((3, 0), [Loss], sub: $cal(L)(theta_t; B_t)$, tone: "loss", name: <loss>),
  sf.matrix((4, 0), rows: 6, cols: 6, pattern: "lowrank", tone: "accent", label: [curvature $hat(H)_t$],
    name: <hess>, seed: 11),
  sf.node((5, 0), [Preconditioned step], sub: $theta_(t+1) = theta_t - eta hat(H)_t^(-1) g_t$,
    tone: "accent", emphasis: true, name: <update>),
  sf.plot((6, 0), series: ("noisy", "decay"), tones: ("neutral", "accent"), label: [training loss], name: <curve>),
  sf.same-size((<model>, <loss>), dim: "height"),

  sf.edge(<data>, <batch>),
  sf.edge(<batch>, <model>),
  sf.edge(<model>, <loss>, $hat(y)$),
  sf.edge(<loss>, <hess>, $g_t$),
  sf.edge(<hess>, <update>),
  sf.edge(<update>, <curve>, style: "dashed", head: "open"),
  sf.loop(<update>, <model>, tone: "accent", label: [next iterate $t <- t+1$], label-pos: (1, 80%), label-side: right),
  sf.group("inner", (<model>, <loss>, <hess>, <update>), label: [Inner loop · K steps], tone: "primary"),
  ..(<model>, <loss>, <hess>, <update>).enumerate().map(((i, n)) => sf.badge(n, i + 1)),

  // ---- row 2: what happens inside the novel block, placed under it (floats: no grid stretching)
  sf.tensor(sf.below-of(<loss>, gap: 54pt, dx: -14pt), depth: 5, sw: 14pt, sh: 20pt, tone: "accent",
    label: [recent gradients \ $G = [g_(t-k), dots, g_t]$], name: <grads>),
  sf.op(sf.right-of(<grads>, gap: 24pt), symbol: [σ], name: <svd>),
  sf.matrix(sf.right-of(<svd>, gap: 22pt), rows: 7, cols: 2, tone: "accent", label: $U_r$, name: <U>, seed: 4),
  sf.matrix(sf.right-of(<U>, gap: 6pt), rows: 2, cols: 2, pattern: "diag", tone: "accent", label: $Sigma_r$,
    name: <S>, seed: 2),
  sf.matrix(sf.right-of(<S>, gap: 6pt), rows: 2, cols: 7, tone: "accent", label: $U_r^top$, name: <Ut>, seed: 4),
  sf.node(sf.right-of(<Ut>, gap: 22pt), $+ lambda I$, shape: "pill", min-width: 26pt, name: <damp>),
  sf.edge(<grads>, <svd>),
  sf.edge(<svd>, <U>, [rank $r$]),
  sf.edge(<Ut>, <damp>),
  sf.brace((<U>, <S>, <Ut>), label: [$hat(H)_t$ in $cal(O)(d r)$ memory], offset: 4pt),
  sf.group("detail", (<grads>, <svd>, <U>, <S>, <Ut>, <damp>), label: [Low-rank curvature estimate (step 3)],
    tone: "accent", dashed: true, fill: white, pad: 9pt),
  sf.zoom(<hess>, "detail"),
)

#sf.panel("a", method)
#v(4pt)
#sf.legend((
  (tone: "neutral", label: [data]),
  (tone: "primary", label: [standard component]),
  (tone: "accent", label: [proposed]),
  (tone: "accent", kind: "arrow", label: [feedback (per step)]),
))
