"""Figure 1 in ONE file: method overview (a, Typst), algorithm flowchart (b, Typst) and wall-clock
convergence (c, matplotlib), composed by Typst into one vector PDF / SVG at double-column width.

Run:  python examples/fig1_overview.py [out_dir]
Deliver as a single standalone file:  python scripts/bundle.py examples/fig1_overview.py
Every panel is made at its final print size, so composing never rescales text. Synthetic data.
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import scifig as sf  # noqa: E402

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")

# ---------------------------------------------------------------- panel c (matplotlib)
sf.use("nature")
METHODS = ["SGD", "Adam", "Ours"]
colors = sf.method_colors(METHODS, highlight="Ours")      # same accent as the schematics' "accent" tone
rng = np.random.default_rng(1)
time = {m: np.linspace(0, T, 300) for m, T in zip(METHODS, [60, 70, 85])}   # ours costs more per step
rate = {"SGD": 0.035, "Adam": 0.06, "Ours": 0.16}
runs = {m: 2.0 * np.exp(-rate[m] * time[m][None, :] ** 0.95) * np.exp(rng.normal(0, 0.08, (8, 300))) + 1e-4
        for m in METHODS}

fig, ax = sf.subplots(width=89, height=80)               # half of the 183 mm row, same height as panel b
sf.convergence(ax, runs, x=time, colors=colors, highlight="Ours", xlabel="Wall-clock time (min)",
               ylabel="Training loss gap")
axins = sf.inset_zoom(ax, (0, 12), (0.25, 2.6), bounds=(0.1, 0.06, 0.34, 0.3))
sf.convergence(axins, {m: runs[m][:, :60] for m in METHODS}, x={m: time[m][:60] for m in METHODS},
               colors=colors, highlight="Ours", labels=None, xlabel="", ylabel="")
axins.set_xlim(0, 12)
axins.set_ylim(0.25, 2.6)
# no panel label here: Typst labels a, b and c below, so all three share one style and alignment
panel_c = sf.save(fig, os.path.join(out, "fig1_panel_c"), formats=("pdf", "png"))["paths"]["pdf"]

# ---------------------------------------------------------------- panels a + b and the page (Typst)
LAYOUT = r"""
#import "scifig.typ" as sf
#show: sf.setup.with(journal: "nature", width: "double")

#let method = sf.diagram(
  spacing: (20pt, 26pt),
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
  sf.brace((<U>, <S>, <Ut>), label: [$hat(H)_t$ in $cal(O)(d r)$ memory]),
  sf.group("detail", (<grads>, <svd>, <U>, <S>, <Ut>, <damp>), label: [Low-rank curvature estimate (step 3)],
    tone: "accent", dashed: true, fill: white, pad: 9pt),
  sf.zoom(<hess>, "detail"),
)

#let flowchart = sf.diagram(
  spacing: (14pt, 13pt),
  sf.node((0, 0), [Initialise $theta_0$, $hat(H)_0 = I$], shape: "pill", name: <init>),
  sf.node((0, 1), [Sample mini-batch $B_t$], tone: "primary", name: <sample>),
  sf.node((0, 2), [Gradient $g_t = nabla cal(L)(theta_t)$], tone: "primary", name: <grad>),
  sf.node((0, 3), [Update curvature $hat(H)_t$], sub: [rank-$r$ sketch], tone: "accent", emphasis: true, name: <curv>),
  sf.node((0, 4), [Step $theta_(t+1) = theta_t - eta hat(H)_t^(-1) g_t$], tone: "primary", name: <step>),
  sf.node((0, 5), [Converged?], shape: "diamond", name: <conv>),
  sf.node((0, 6), [Return $theta_T$], shape: "pill", name: <done>),
  sf.same-size((<sample>, <grad>, <curv>, <step>), dim: "width"),
  sf.edge(<init>, <sample>), sf.edge(<sample>, <grad>), sf.edge(<grad>, <curv>),
  sf.edge(<curv>, <step>), sf.edge(<step>, <conv>),
  sf.edge(<conv>, <done>, [yes], label-side: left),
  sf.edge(<conv>, (1, 5), (1, 1), <sample>, [no], label-pos: (1, 50%), label-side: left),
  sf.note(<curv>, [only $cal(O)(d r)$ extra memory], side: "left", dist: 10pt),
)

#sf.panel("a", method)
#v(3pt)
#sf.legend((
  (tone: "neutral", label: [data]),
  (tone: "primary", label: [standard component]),
  (tone: "accent", label: [proposed]),
  (tone: "accent", kind: "arrow", label: [feedback (per step)]),
))
#v(5pt)
#grid(columns: (89mm, 89mm), column-gutter: 5mm,
  sf.panel("b", flowchart),
  sf.panel("c", image("panel_c.pdf")),
)
"""
sf.typst_figure(LAYOUT, os.path.join(out, "fig1_overview"), files={"panel_c.pdf": panel_c})
