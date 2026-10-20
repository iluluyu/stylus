# Color

## Default palette `scifig`

Okabe–Ito hues (Nature's officially recommended color-blind-safe palette), slightly deepened and desaturated for a
calmer print look. Verified minimum pairwise CIEDE2000: 25 normal, 14.1 protan, 13.5 deutan, 12.6 tritan
(≥ 10 is distinguishable for lines).

| Name | Value | Default meaning |
|---|---|---|
| blue | `#1A5FA0` | baseline 1 / standard component (Typst tone `primary`) |
| orange (vermillion) | `#CF5B2A` | **our method** (`ACCENT`, Typst tone `accent`) |
| green | `#118C6E` | baseline 2 / secondary component |
| purple | `#C26FA3` | baseline 3 / losses and objectives (Typst tone `loss`) |
| amber | `#E1A02E` | baseline 4 |
| sky | `#5BADDF` | baseline 5 |
| grey | `#6E6E6E` + `NEUTRALS` ramp | reference lines, data, background elements |

Also built in: `okabe_ito` (original), `tol_bright`, `tol_vibrant`, `tol_muted` (Paul Tol).

## Rules

1. **Define method → color once**: `colors = sf.method_colors(METHODS, highlight="Ours")`, reuse in every panel.
   In schematics the same method uses the same tone (`accent` = vermillion = Python `ACCENT` = `sf.accent` in Typst).
2. **Emphasis by contrast, not quantity**: only "Ours" gets the saturated vermillion + a thicker line; with 4+ baselines use `scheme="gray"` (grey ramp + direct labels) so readers see "ours vs the rest".
3. **≤ 6 hues.** More categories: group (one hue in several lightnesses for a method family), facet (small multiples), or label directly.
4. **Color is never the only encoding**: important distinctions also differ in width, style, marker or position; `check.py --cvd` renders deutan / protan / grayscale versions — the key conclusion must survive grayscale.
5. **Text in ink**: Nature asks to avoid colored text and requires contrast > 4.5. Direct labels are darkened automatically (`readable`), and lint checks it.
6. **Consistent semantics**: red/orange means either our method or "bad" (loss, error) — pick one per figure; never use green for "good" (red–green color blindness).

## Colormaps (continuous data)

| Data | Colormap | Notes |
|---|---|---|
| One-directional values (accuracy, density, magnitude) | `sf.cmap("seq")` (light → blue), `seq_warm`, `viridis`, `cividis` | perceptually uniform; the lowest value is not pure white so cells don't vanish |
| Meaningful center (difference, correlation, sign) | `sf.cmap("div")` (blue–white–orange), `heatmap(center=0)` | colorbar symmetric around the center |
| Background fields (loss landscapes) | `landscape` / `landscape_warm` | very light so colored trajectories float on top |
| Banned | `jet` `rainbow` `hsv` `nipy_spectral` | not perceptually uniform, create false boundaries, explicitly discouraged by journals; `sf.cmap` raises |

## Custom colors

```python
sf.palette_report(["#1A5FA0", "#C0392B", "#2E8B57"])
# {'normal': {'min_dE': ...}, 'deutan': ..., 'protan': ..., 'tritan': ..., 'gray': ..., 'contrast_vs_bg': {...}}
```
If `min_dE < 10` under any vision type, change the color or add a second encoding; a color with `contrast_vs_bg < 4.5` must not be used for text.
For journal or lab brand colors, replace consistently in both places — `PALETTES` / `method_colors(..., accent='#...')`
in Python and `palette` in `scripts/scifig.typ` (or `tone: rgb("#...")` per item) — instead of scattered manual edits.
