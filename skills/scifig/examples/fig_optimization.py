"""Example: a 6-panel double-column results figure for an optimization paper.

Run:  python examples/fig_optimization.py  [out_dir]
Shows: shared method colors, direct labels, convergence + rate guide, performance profile,
loss-landscape trajectories, Pareto fronts, ablation dot plot, CD diagram, panel labels.
All data here are synthetic.
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import scifig as sf  # noqa: E402

out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")
rng = np.random.default_rng(7)
METHODS = ["SGD", "Momentum", "Adam", "Ours"]

sf.use("nature")
colors = sf.method_colors(METHODS, highlight="Ours")   # one dict for the whole paper

# ---------- synthetic data ----------
T = 400
t = np.arange(1, T + 1)
rates = {"SGD": (1.0, 0.0), "Momentum": (1.4, 0.0), "Adam": (1.1, 0.004), "Ours": (2.0, 0.012)}
runs = {}
for m, (p, lin) in rates.items():
    base = 3.0 / t ** (p * 0.55) * np.exp(-lin * t)
    noise = np.exp(rng.normal(0, 0.25, size=(10, T)).cumsum(axis=1) * 0.03)
    runs[m] = base * noise

P = 80
cost = np.exp(rng.normal([1.0, 0.75, 0.6, 0.25], 0.45, size=(P, 4)))
cost[rng.random((P, 4)) < np.array([0.20, 0.12, 0.08, 0.03])] = np.inf


TH = np.radians(35)
R = np.array([[np.cos(TH), -np.sin(TH)], [np.sin(TH), np.cos(TH)]])
A = R @ np.diag([1.0, 18.0]) @ R.T            # ill-conditioned quadratic (kappa = 18)


def quad(x, y):
    return 0.5 * (A[0, 0] * x ** 2 + 2 * A[0, 1] * x * y + A[1, 1] * y ** 2)


def run_opt(kind, x0=(-2.2, -0.85), n=40):
    p = np.array(x0, float)
    v, m, s = np.zeros(2), np.zeros(2), np.zeros(2)
    out = [p.copy()]
    for k in range(1, n + 1):
        g = A @ p
        if kind == "SGD":
            p = p - 0.1 * g                         # near 2/L: zig-zags across the valley
        elif kind == "Momentum":
            v = 0.9 * v + g
            p = p - 0.012 * v                       # overshoots, spirals in
        elif kind == "Adam":
            m = 0.9 * m + 0.1 * g
            s = 0.999 * s + 0.001 * g ** 2
            p = p - 0.1 * (m / (1 - 0.9 ** k)) / (np.sqrt(s / (1 - 0.999 ** k)) + 1e-8)
        else:                                       # curvature-aware ("Ours")
            p = p - 0.35 * np.linalg.solve(A + 0.2 * np.eye(2), g)
        out.append(p.copy())
    return np.array(out)


traj = {m: run_opt(m) for m in METHODS}

pareto_pts = {}
tops = {"SGD": 82.0, "Momentum": 83.5, "Adam": 84.8, "Ours": 87.2}
scales = {"SGD": 9.0, "Momentum": 7.0, "Adam": 5.5, "Ours": 2.6}
for m in METHODS:
    c = np.exp(rng.uniform(0.0, 3.2, 12))
    acc = tops[m] - 14 * np.exp(-c / scales[m]) - np.abs(rng.normal(0, 0.9, 12))
    pareto_pts[m] = np.column_stack([c, acc])

abl_names = ["Full model", "− curvature term", "− adaptive step", "− warm start", "− momentum", "Baseline (Adam)"]
abl_vals = np.array([84.6, 82.1, 80.7, 83.9, 83.2, 78.4])
abl_err = np.array([0.5, 0.6, 0.7, 0.5, 0.6, 0.8])

cd_methods = ["Ours", "Adam", "Momentum", "SGD", "AdaGrad", "RMSProp"]
scores = rng.normal([0.80, 0.77, 0.765, 0.74, 0.745, 0.76], 0.02, size=(24, 6))
ranks = dict(zip(cd_methods, sf.average_ranks(scores)))

# ---------- layout: 183 x 112 mm, 2 rows x 3 panels ----------
fig, axd = sf.mosaic("abc;def", width="double", height=112)

sf.convergence(axd["a"], runs, x=t, colors=colors, highlight="Ours", logx=True,
               xlabel="Iteration $t$", ylabel=r"$f(x_t)-f^\star$")
sf.rate_guide(axd["a"], order=1, x0=1.6, x1=80, y0=0.25, where="below")

sf.performance_profile(axd["b"], cost, METHODS, colors=colors, highlight="Ours", tau_max=16)

sf.landscape(axd["c"], quad, (-2.7, 1.1), (-1.9, 1.5), traj, colors=colors, highlight="Ours",
             optimum=(0, 0), legend="upper left", arrows=0)

sf.pareto(axd["d"], pareto_pts, minimize=(True, False), colors=colors, highlight="Ours",
          xlabel="Compute (GPU h)", ylabel="Accuracy (%)")
axd["d"].set_xscale("log")

sf.ablation(axd["e"], abl_names, abl_vals, abl_err, ref=0, xlabel="Accuracy (%)")

sf.cd_diagram(axd["f"], ranks, n_datasets=24, highlight="Ours")

sf.panel_labels(fig, axd)
res = sf.save(fig, os.path.join(out_dir, "fig_optimization"))
