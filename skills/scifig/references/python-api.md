# scifig Python API reference

```python
import sys; sys.path.insert(0, "<skill>/scripts")     # a bundled standalone script needs no path
import scifig as sf
```
Modules: `style` (profiles, sizes, panel labels) · `palette` / `color` · `plots` · `export` (save) · `lint` (matplotlib) ·
`pdflint` · `typstbuild` · `svgtools` · `bundle`. The Typst twin is `scripts/scifig.typ` (`diagram-api.md`).

## Style and size (`scifig.style`)

| Function | Description |
|---|---|
| `sf.use(journal="nature", font=None, **rc)` | Activate a journal profile (`nature`/`science`/`cell`/`pnas`/`ieee`/`neurips`/`icml`/`cvpr`). Resets rcParams; sets font, sizes, line widths, palette, editable SVG export; keeps TeX sub/superscripts above the journal minimum. Call once at the top of every script. |
| `sf.journal()` | Active `Journal` (`.widths` mm, `.max_height`, `.font`, `.small`, `.min_font`, `.label`…). |
| `sf.figsize(width="single", height=None, aspect=None)` | Returns inches. `width`: `"single"`/`"onehalf"`/`"double"` or mm; `height` in mm. |
| `sf.subplots(nrows=1, ncols=1, width=..., height=..., **kw)` | `plt.subplots` at physical size + constrained layout. |
| `sf.mosaic("ab;cd", width="double", height=110, **kw)` | `plt.subplot_mosaic`, returns `(fig, {"a": ax, ...})`. `"aab;cde"` makes a span two columns; `gridspec_kw={"width_ratios": [...]}` for ratios. |
| `sf.panel_labels(fig, axes, labels=None)` | Bold a/b/c (uppercase for Science/Cell): left-aligned per column, top-aligned per row, then freezes the layout. **Call after all plotting, before `save`.** `axes` may be the mosaic dict (keys become labels). |
| `sf.export_mplstyle(path, "nature")` | Write a `.mplstyle` for scripts that don't use scifig (`plt.style.use(path)`). |

## Color (`scifig.palette`)

| Function | Description |
|---|---|
| `sf.method_colors(names, highlight=None, scheme="accent")` | Method → color. `highlight` gets the accent (vermillion `#CF5B2A`), others the color-blind-safe palette; `scheme="gray"` makes baselines grey (pair with direct labels); `"categorical"` = no emphasis. **Call once per paper; reuse the dict.** |
| `sf.palette(name="scifig", n=None)` | Palettes: `scifig` (default), `okabe_ito` (Nature's recommendation), `tol_bright`, `tol_vibrant`, `tol_muted`. |
| `sf.cmap(name)` | Colormaps: `seq`, `seq_warm`, `div` (centered), `landscape`, `landscape_warm`, or `viridis`/`cividis`… Rejects `jet`/`rainbow`. |
| `sf.palette_report(colors)` | Minimum CIEDE2000 distance under normal / deutan / protan / tritan / grayscale, and contrast on white. Validate every custom color with it. |
| `sf.tint(c, t)` / `sf.shade(c, t)` / `sf.mix(a, b, t)` / `sf.readable(c)` | Lighten, darken, mix, darken until readable as text (contrast ≥ 4.5). |
| `sf.NEUTRALS["500"]`, `sf.INK`, `sf.ACCENT` | Grey ramp, body ink, accent color. |

## Charts (`scifig.plots`) — all `fn(ax, ...)`, return artists

```text
convergence(ax, data, x=None, *, colors, highlight, band="iqr"|"ci95"|"std"|"minmax"|None,
            center="median"|"mean", logy=True, logx=False, labels="direct"|"legend"|None,
            xlabel, ylabel, lw=1.0, lw_highlight=1.6, band_alpha=0.16, linestyles=None)
rate_guide(ax, order=1, x0=None, y0=None, x1=None, label=None, where="below"|"above")
slope_triangle(ax, x0, y0, slope, width_dec=0.4, label=None, flip=False)
performance_profile(ax, T, names, *, tau_max=None, colors, highlight, labels="direct")
pareto(ax, points, *, minimize=(True, False), colors, highlight, fronts=True,
       show_dominated=True, labels="direct", xlabel, ylabel, better=True)
landscape(ax, f, xlim, ylim, trajectories=None, *, n=300, levels=14, log=True, cmap="landscape",
          lines=True, optimum=None, colors, highlight, markevery=None, arrows=2,
          legend="lower right"|"outside"|None, cbar=False, cbar_label=None, equal=True)
ablation(ax, names, values, err=None, *, ref=0, delta=True, fmt="{:+.1f}", xlabel="Score")
grouped_bars(ax, categories, values, err=None, *, colors, highlight, ylabel, value_labels=False,
             fmt="{:.1f}", legend=True, ylim=None)            # bars start at 0, by design
heatmap(ax, M, xlabels, ylabels, *, cmap="seq", center=None, vmin, vmax, annotate=True,
        fmt="{:.2f}", best="max"|"min"|None, cbar=True, cbar_label=None, xlabel, ylabel, square=True)
cd_diagram(ax, ranks, n_datasets, *, alpha=0.05, highlight=None, show_values=True, valign="top")
average_ranks(scores, higher_is_better=True)  ->  per-method mean rank (1 = best)
critical_difference(k, n_datasets, alpha=0.05)
tradeoff(ax, items, *, colors, highlight, logx=True, size_range=(12, 120), better="upper left",
         xlabel, ylabel, label_offsets=None, size_key=None)
dist(ax, data, *, colors, highlight, jitter=0.13, box=True, ylabel=None, rotate=0)
direct_labels(ax, items=[(text, x, y, color), ...], side="right")     # collision-free
better_arrow(ax, "upper left"|"upper right"|"lower left"|"lower right", text="Better")
inset_zoom(ax, xlim, ylim, bounds=(x, y, w, h)) -> axins
tidy_log(ax)                                      # remove minor-tick label clutter on log axes
```

## Saving and checking

| Function | Description |
|---|---|
| `sf.save(fig, "out/fig2", formats=("svg","pdf","png"), png_dpi=300, lint=True)` | Gives every artist a readable id (`panel-a`, `a-line-ours`, `a-band-ours`…), removes unneeded clip groups, keeps text as `<text>`, merges mathtext per-glyph tspans, transparent SVG/PDF background, white PNG preview; prints the lint report. Returns `{"paths", "issues", "size_mm"}`. |
| `sf.lint_figure(fig)` → `[Issue]`; `sf.report(issues)` | Text overlap / clipping, font size (incl. sub/superscripts), text on lines or markers, legend over data, inset covering data, default colors, raster heatmaps, column width, contrast, hue count, dense ticks. |
| `sf.lint_pdf("fig.pdf", journal="nature")` → `(issues, stats)` | Lint any finished PDF: width / height, font sizes, fonts, clipped text, text overlap, lines through text, contrast, hues, rasters (needs `pdfplumber`). |
| `python scripts/check.py fig.typ \| fig.pdf \| fig.svg [--cvd] [--journal neurips]` | Build / render + audit any figure. `--cvd` writes a color-blind / grayscale comparison. Exit code 1 on lint ERRORs. |

## Typst (schematics and composed figures)

| Function | Description |
|---|---|
| `sf.compile_typst("fig1.typ", out=None, formats=("pdf","svg","png"), ppi=300, journal=None)` | Compile a Typst figure (finds the `typst` CLI or the `typst` Python wheel, passes the installed Arial-metric font), then report the diagram geometry lint + PDF lint. Returns `{"paths", "issues", "size_mm"}`. |
| `sf.typst_figure(SOURCE, "out/fig1", files={"panel_c.pdf": path})` | Compile Typst source kept in a Python string; `scifig.typ` and `files` are staged next to it, so `#import "scifig.typ" as sf` and `image("panel_c.pdf")` just work. The way to keep a mixed figure in **one** `.py`. |
| `sf.library_source()` | Text of scifig.typ (the embedded copy inside a standalone bundle). |

## One file per figure (delivery / migration)

`python scripts/bundle.py fig2.py [-o out.py]` → `standalone/fig2.py`: the scifig modules (and scifig.typ when the
script calls `typst_figure` / `compile_typst`) are embedded and registered as the module `scifig`, so the figure code
runs unchanged anywhere with numpy + matplotlib (+ Typst). `.typ` figures bundle the same way. The library in the
skill stays split into modules; only the deliverable is merged.

## Typical combination

```python
sf.use("nature")
colors = sf.method_colors(METHODS, highlight="Ours")
fig, axd = sf.mosaic("abc;def", width="double", height=112)
sf.convergence(axd["a"], runs, x=t, colors=colors, highlight="Ours", logx=True)
...
sf.panel_labels(fig, axd)            # last layout step
sf.save(fig, "figures/fig2")         # then Read figures/fig2.png
```

Plain matplotlib calls are fine too — `sf.use()` already set the style. Rules: take colors from the `colors`
dict; don't set font sizes by hand (use rcParams defaults); for smaller annotations use `fontsize=sf.journal().small`.
