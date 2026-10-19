"""Example: assemble a diagram (sfd.mjs) and a data plot (scifig) into one editable Figure 1.

Run after the two node examples:  python examples/fig_assembled.py [out_dir]
Each panel is produced at its final print size, so assembly never rescales text.
"""
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import scifig as sf  # noqa: E402
from assemble import assemble  # noqa: E402

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out")
for js in ("fig_method.mjs", "fig_flowchart.mjs"):          # panels a and b
    subprocess.run(["node", os.path.join(HERE, js), out], check=True, capture_output=True)

# panel c: wall-clock convergence, same height as the flowchart (80.4 mm)
sf.use("nature")
methods = ["SGD", "Adam", "Ours"]
colors = sf.method_colors(methods, highlight="Ours")
rng = np.random.default_rng(1)
time = {m: np.linspace(0, T, 300) for m, T in zip(methods, [60, 70, 85])}   # ours costs more per step
rate = {"SGD": 0.035, "Adam": 0.06, "Ours": 0.16}
runs = {m: 2.0 * np.exp(-rate[m] * time[m][None, :] ** 0.95) * np.exp(rng.normal(0, 0.08, (8, 300)))
        + 1e-4 for m in methods}

fig, ax = sf.subplots(width="single", height=80.4)
sf.convergence(ax, runs, x=time, colors=colors, highlight="Ours", xlabel="Wall-clock time (min)",
               ylabel="Training loss gap")
axins = sf.inset_zoom(ax, (0, 12), (0.25, 2.6), bounds=(0.1, 0.06, 0.34, 0.3))
sf.convergence(axins, {m: runs[m][:, :60] for m in methods}, x={m: time[m][:60] for m in methods},
               colors=colors, highlight="Ours", labels=None, xlabel="", ylabel="")
axins.set_xlim(0, 12)
axins.set_ylim(0.25, 2.6)
sf.panel_labels(fig, [ax], ["c"])
sf.save(fig, os.path.join(out, "panel_c"), formats=("svg", "png"))

assemble(os.path.join(out, "figure1.svg"),
         rows=[[os.path.join(out, "fig_method.svg")],
               [os.path.join(out, "fig_flowchart.svg"), os.path.join(out, "panel_c.svg")]],
         width="double", labels="none", vgap_mm=2)
subprocess.run([sys.executable, os.path.join(HERE, "..", "scripts", "check.py"),
                os.path.join(out, "figure1.svg"), "--pdf"], check=False)
