# Chart catalog: algorithm & optimization papers

First ask "what does the reader need to compare?", then pick the chart. Each section: when to use →
call → design notes → common mistakes. Every function draws into an existing `ax` and returns its
artists, so you can keep layering; signatures are in `python-api.md`.

## Contents
1. Convergence / training curves · 2. Rate guides · 3. Performance profile · 4. Pareto front / accuracy–cost trade-off
5. Loss landscape + optimizer trajectories · 6. Ablation · 7. Benchmark bars · 8. Hyperparameter sensitivity heatmap
9. Ranking across datasets (CD diagram) · 10. Per-seed distributions · 11. Zoomed inset · 12. Scaling laws (log-log)
13. Quick chooser · 14. Don'ts

---

## 1. Convergence / training curves — `sf.convergence`
**Use for** optimization error, training/validation loss versus iterations, function evaluations or wall-clock time.
```python
sf.convergence(ax, runs, x=t, colors=colors, highlight="Ours", band="iqr",
               logy=True, logx=False, xlabel="Iteration $t$", ylabel=r"$f(x_t)-f^\star$")
```
- `runs`: `{method: (n_seeds, n_steps)}`; `x` may be a dict (each method's own wall-clock axis).
- Median + IQR band (`band="iqr"`) is most robust for heavy-tailed / log-scale data; mean + 95% CI via `band="ci95"`. State n and band meaning in the caption.
- Error-type quantities almost always need `logy=True`; use `logx=True` when iterations span orders of magnitude.
- **Fair comparison**: when per-iteration cost differs (second-order, variance reduction), also show a version with wall-clock time or gradient evaluations on x.
- Method names sit at line ends (default `labels="direct"`); the highlighted method is bold and thicker.
- Noisy training curves: EMA-smooth the data (and say so), or draw raw (faint) + smoothed (solid).

## 2. Rate guides — `sf.rate_guide` / `sf.slope_triangle`
**Use for** theory papers comparing measured curves to O(1/t), O(1/t²), linear rates.
```python
sf.rate_guide(ax, order=1, x0=2, x1=200, y0=0.3)      # grey dashed line + O(1/t) label rotated along it
sf.slope_triangle(ax, x0=20, y0=1e-3, slope=-2)       # slope triangle on log-log axes
```
- Keep the guide below the curves without crossing data (lint reports `text-on-data`); the label follows the line.

## 3. Performance profile — `sf.performance_profile`
**Use for** robustness and efficiency of solvers over many problems (CUTEst, LIBSVM, benchmark suites); the standard plot in optimization (Dolan & Moré 2002).
```python
sf.performance_profile(ax, T, names, colors=colors, highlight="Ours", tau_max=16)
```
- `T`: `(n_problems, n_solvers)` cost (time, iterations, evaluations); failures are `np.inf`.
- Reading: value at τ=1 = fraction where the solver is fastest (efficiency); right end = fraction eventually solved (robustness). Put both sentences in the caption.
- log₂ x axis. With fewer than ~20 problems use a table or dot plot instead.

## 4. Pareto front — `sf.pareto`; accuracy–cost trade-off — `sf.tradeoff`
```python
sf.pareto(ax, pts, minimize=(True, False), colors=colors, highlight="Ours",
          xlabel="Compute (GPU h)", ylabel="Accuracy (%)")            # one step front per method
sf.tradeoff(ax, {"Ours": (1.3, 78.1, 2), ...}, logx=False, size_key="Memory (×SGD)",
            better="upper left", xlabel=..., ylabel=...)              # one point per method, area = 3rd variable
```
- Multi-objective optimization, hyperparameter sweeps, accuracy / latency / memory trade-offs. Dominated points are faded, fronts solid.
- The "Better" arrow points toward the preferred region (upper left = cheap and accurate). Keep it in empty space — lint checks whether it covers points.
- When bubble area encodes a third variable, always give a `size_key` legend.

## 5. Loss landscape + optimizer trajectories — `sf.landscape`
**Use for** showing behavioral differences (oscillation, overshoot, preconditioned straight paths) — a staple of method papers' Figure 1/2.
```python
sf.landscape(ax, f, (-2.7, 1.1), (-1.9, 1.5), traj, colors=colors, highlight="Ours",
             optimum=(0, 0), legend="upper left", log=True)
```
- `f(X, Y)` vectorized, or an `(X, Y, Z)` grid; `traj = {method: (steps, 2)}`. Contours are vector polygons, no embedded raster.
- Light `landscape` colormap so colored trajectories float on top; log contours (`log=True`) reveal valley structure.
- Pick a test function that exposes the differences: ill-conditioned quadratic (condition number 10–50, rotated 30–40°), Rosenbrock, Beale, saddle functions.
- Equal aspect (default `equal=True`): make the xlim/ylim ratio close to the panel's aspect ratio, otherwise the panel shrinks and leaves white space.
- Start = hollow circle, end = filled circle, optimum = star. Legend in a corner without trajectories, or `legend="outside"`.

## 6. Ablation — `sf.ablation`
```python
sf.ablation(ax, names, vals, err, ref=0, xlabel="Accuracy (%)")   # names[0] = full model
```
- Horizontal dot plot with CIs, dashed reference = full model, a Δ column on the right. Less ink than bars and needs no zero baseline.
- Row order: full model on top, then by Δ or by logical group; baseline last.

## 7. Benchmark bars — `sf.grouped_bars`
```python
gain = {m: acc[m] - acc["SGD"] for m in methods if m != "SGD"}
sf.grouped_bars(ax, datasets, gain, err=err, colors=colors, highlight="Ours",
                ylabel="Gain over SGD (pp)", value_labels=True, fmt="{:+.1f}")
```
- Bar length encodes value, so bars **must start at 0**; the tool refuses `baseline≠0`. When absolute differences are small (92.1 vs 92.9), plot gain over a baseline, or use a dot plot / table.
- ≤ 5 bars per group; with > 6 datasets switch to a heatmap or dot plot. Turn value labels on only when exact readout matters.

## 8. Hyperparameter sensitivity — `sf.heatmap`
```python
sf.heatmap(ax, grid, xlabels, ylabels, best="max", fmt="{:.1f}", cbar_label="Accuracy (%)",
           xlabel="Learning rate", ylabel="Rank $r$")              # center=0 switches to the diverging map
```
- Vector cells (pcolormesh) with white separators; cell text auto black/white; `best` outlines the best cell.
- Signed quantities (difference to baseline) use `center=0` → blue–white–orange diverging map with a symmetric colorbar.

## 9. Ranking across datasets — `sf.cd_diagram`
```python
ranks = dict(zip(methods, sf.average_ranks(scores)))   # scores: (n_datasets, n_methods)
sf.cd_diagram(ax, ranks, n_datasets=24, highlight="Ours")
```
- Friedman + Nemenyi critical difference (Demšar 2006); thick bars join methods with no significant difference. Needs ≳ 10 datasets to mean anything.
- Height ≈ 14 + 3.5·⌈k/2⌉ mm.

## 10. Per-seed / per-run distributions — `sf.dist`
```python
sf.dist(ax, {m: final_scores[m] for m in methods}, colors=colors, highlight="Ours", ylabel=...)
```
- Box (median, IQR) + jittered raw points. With n < 20, raw points are more honest than violins.

## 11. Zoomed inset — `sf.inset_zoom`
```python
axins = sf.inset_zoom(ax, xlim=(0, 12), ylim=(0.25, 2.6), bounds=(0.1, 0.06, 0.34, 0.3))
sf.convergence(axins, sub_runs, x=sub_x, colors=colors, labels=None, xlabel="", ylabel="")
```
- Place it in empty space (lint reports `inset-on-data`); inset tick labels ≥ 6 pt or exponent superscripts drop below 5 pt.

## 12. Scaling laws / complexity
- Runtime vs problem size, error vs sample size: log-log + `slope_triangle` for the slope, or `rate_guide` for the theoretical order.
- Draw discrete sizes with `ax.plot(..., marker="o")`; still take colors from `method_colors`.

## 13. Quick chooser

| Reader compares | First choice | Alternative |
|---|---|---|
| Progress over time / iterations | convergence (with bands) | small multiples (one panel per task) |
| Overall performance over many problems | performance profile | CD diagram (many datasets), heatmap (dataset × method) |
| Two conflicting objectives | pareto / tradeoff | labeled scatter |
| Component contributions | ablation dot plot | table |
| Few methods on few datasets | gain-over-baseline bars | dot plot + CI |
| 2-D hyperparameter sweep | heatmap | contour |
| Intuitive behavioral difference | landscape + trajectories | schematic (schematic-design.md) |
| Run-to-run variability | dist | convergence bands |

## 14. Don'ts
- Dual y axes (readers misread correlation) — use two stacked panels sharing x.
- Pie charts, 3D charts, radar charts (unless the reviewing community explicitly expects them).
- Color for > 6 categories; triple-encoding (color + line style + marker) of different variables.
- Legends covering data; > 7 tick labels; scientific-notation offset text (`1e-3` at the axis end) — change units or use a log axis.
- Different colors for the same method in different figures of one paper.
