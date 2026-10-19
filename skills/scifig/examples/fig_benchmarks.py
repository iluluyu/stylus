"""Example: benchmark figure — grouped bars, accuracy/cost trade-off, sensitivity heatmap,
per-seed distributions. Synthetic data. Run: python examples/fig_benchmarks.py [out_dir]"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import scifig as sf  # noqa: E402

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")
rng = np.random.default_rng(3)
sf.use("nature")
METHODS = ["SGD", "Adam", "Shampoo", "Ours"]
colors = sf.method_colors(METHODS, highlight="Ours")

datasets = ["CIFAR-10", "CIFAR-100", "ImageNet", "WikiText"]
base = np.array([93.1, 72.4, 76.0, 61.2])
acc = {m: base + d + rng.normal(0, 0.3, 4) for m, d in zip(METHODS, [-1.6, -0.9, -0.3, 0.9])}
err = {m: np.full(4, 0.35) for m in METHODS}

trade = {"SGD": (1.0, 76.0, 1), "Adam": (1.1, 76.7, 2), "Shampoo": (2.6, 77.3, 4), "K-FAC": (3.4, 77.0, 4),
         "Ours": (1.3, 78.1, 2)}
tcolors = sf.method_colors(list(trade), highlight="Ours")

lrs = ["1e-4", "3e-4", "1e-3", "3e-3", "1e-2"]
ranks = ["4", "8", "16", "32"]
X, Y = np.meshgrid(np.arange(5), np.arange(4))
grid = 78.3 - 0.35 * (X - 2.2) ** 2 - 0.25 * (Y - 1.6) ** 2 + rng.normal(0, 0.08, X.shape)

seeds = {m: rng.normal(76 + d, s, 10) for m, d, s in zip(METHODS, [0, 0.7, 1.2, 2.0], [0.6, 0.5, 0.7, 0.3])}

fig, axd = sf.mosaic("ab;cd", width="double", height=105)
# bars encode length from zero: show the gain over the SGD baseline instead of truncating the axis
gain = {m: acc[m] - acc["SGD"] for m in METHODS if m != "SGD"}
sf.grouped_bars(axd["a"], datasets, gain, err={m: err[m] for m in gain}, colors=colors, highlight="Ours",
                ylabel="Gain over SGD (top-1, pp)", value_labels=True, fmt="{:+.1f}")
sf.tradeoff(axd["b"], trade, colors=tcolors, highlight="Ours", xlabel="Time per epoch (relative to SGD)",
            ylabel="ImageNet top-1 (%)", better="upper left", logx=False, size_key="Memory (×SGD)")
axd["b"].set_xlim(0.2, 3.9)
axd["b"].set_ylim(75.5, 78.6)
sf.heatmap(axd["c"], grid, lrs, ranks, best="max", fmt="{:.1f}", cbar_label="Accuracy (%)",
           xlabel="Learning rate", ylabel="Sketch rank $r$")
sf.dist(axd["d"], seeds, colors=colors, highlight="Ours", ylabel="Final accuracy (%)")
sf.panel_labels(fig, axd)
sf.save(fig, os.path.join(out, "fig_benchmarks"))
