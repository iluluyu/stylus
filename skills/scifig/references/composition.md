# Multi-panel composition and assembly

## Plan on paper first (mm)
1. Choose the figure width (double 183 / single 89) and height (Nature ≤ 170).
2. Draw the grid: width and height of each panel (mm), 3–5 mm between panels. Reading order a→b→c left to right, top to bottom.
3. Same-type panels get the same size and aligned axes: panels in a row sharing a y range use `sharey=True` and drop inner y labels.
4. The schematic usually goes in a (a full top row), results after it; Figure 1 = method + one "signature" result is a common structure.

## Case 1: data plots only → one matplotlib Figure
```python
fig, axd = sf.mosaic("aab;cde", width="double", height=120,
                     gridspec_kw={"width_ratios": [1, 1, 1.2], "height_ratios": [1, 0.9]})
...
sf.panel_labels(fig, axd)       # aligns a/b/c: left per column, top per row
sf.save(fig, "figures/fig3")
```
Inside one Figure, constrained layout handles alignment, font sizes and spacing — tidier than assembling; do this whenever possible.

## Case 2: schematic + data plots → generate each at final size, then `assemble.py`
```bash
node make_schematic.mjs                    # 183 mm wide, with or without its own panel label
python make_plots.py                       # each panel at its final mm size
python <skill>/scripts/assemble.py figures/fig1.svg --width double \
       --row figures/schematic.svg --row figures/flow.svg,figures/curve.svg --gap 3 --vgap 2
python <skill>/scripts/check.py figures/fig1.svg --pdf
```
- Generate each panel **at its actual size in the final figure** (e.g. two side-by-side single-column plots, each 89 mm wide, same height). Then assembly needs no scaling and text stays 5–7 pt.
- Default is native-size placement (scaling only when a row doesn't fit, with a report of the font-size change; shrinking below the minimum is refused unless `--force`). `--fit` forces equal heights filling the row width.
- Labels: `--labels auto` lets the assembler add a/b/c; use `--labels none` when panels carry their own. Never both.
- Exact placement via JSON: `--layout layout.json`, `[{"file": "a.svg", "x": 0, "y": 0, "label": "a"}, ...]` (mm).
- The result is still pure vector: each panel is a `<g id="panel-x">` with internally prefixed ids to avoid clashes.

Python API:
```python
from assemble import assemble     # with <skill>/scripts on sys.path
assemble("figures/fig1.svg", rows=[["a.svg"], ["b.svg", "c.svg"]], width="double", labels="none")
```

## Consistency checklist (before assembling)
- Every panel uses the same `sf.use(journal)`; schematics use the same `journal`.
- Method colors come from one `method_colors` dict; the schematic `accent` is the same value as Python's `ACCENT`.
- The same quantity uses the same unit, axis-label wording and tick magnitude across panels.
- Only one set of panel labels (all via `panel_labels`/`d.panel`, or all via `assemble.py`).
- White space: 3–5 mm between panels; never enlarge fonts or boxes to fill space.
