# Pre-delivery self-review (every time)

Lint catches mechanical problems; the items below need you to **look at the PNG**. Open the preview with Read; crop
and zoom with PIL when needed. Deliver only when every item is "yes"; on "no", fix, save again, look again.

## A. Message (most important)
1. **Squint test**: imagine the figure as a thumbnail — is the first thing you see evidence for the brief's message? If the most salient thing is a legend, grid or a baseline, demote it.
2. Without the caption, can a reader tell what each panel compares? (axis labels with units; method names on the plot)
3. Does each panel answer exactly one question? Two questions → split the panel.
4. Is our method visually prominent (color + width / bold), rather than something readers must hunt for?

## B. Data honesty
5. Is run-to-run variability shown (bands / error bars / raw points), with n and band meaning in the caption?
6. Bars start at 0; log axes are justified; axis ranges are not cropped to exaggerate differences.
7. Is the comparison fair (same budget / x axis: iterations vs wall-clock vs evaluations)?
8. Same method, same color and same name in every panel.

## C. Layout
9. Font sizes within 5–7 pt (Nature) / the journal range; **no text smaller than tick labels**; panel labels 8 pt bold.
10. No overlaps: text–text, text–data, legend–data, inset–data.
11. Alignment: axes tops/bottoms aligned within a row, panel labels aligned; in schematics, box centers aligned per row and sizes consistent.
12. Balanced white space: no crowded corner next to a big empty area; direct labels don't stick out of the figure.
13. 3–6 ticks with concise numbers (`0.5` not `0.50000`; no `1e-3` offset text).
14. Line-width hierarchy: data lines 1.0–1.6 pt > axes 0.6 pt > guides / grid 0.4–0.6 pt.

## D. Color
15. ≤ 6 hues; key distinctions still visible in the color-vision preview (`check.py --cvd`); the conclusion survives grayscale.
16. No colored text (direct labels are darkened automatically); no jet/rainbow; low heatmap cells don't vanish into the white background.

## E. Schematics
17. Consistent reading direction (left→right or top→bottom); loops detour instead of cutting back across.
18. The new component is the only focal point; other components share one grey/blue tone.
19. Box text is a 2–4 word noun phrase or a math symbol, never a sentence.
20. Uniform arrow style; edges don't cross boxes or text; ≤ 1 crossing.

## F. Files
21. SVG text is `<text>` (check.py raises an ERROR if text was outlined); no embedded rasters (except photos).
22. Deliver SVG + PDF (+ PNG preview) + the generating script; file names match figure numbers (`fig2.svg`).
23. Provide a caption draft: one-sentence conclusion + per-panel description + n / error meaning / statistical test.

## Typical "AI look" signals (fix on sight)
- Every panel has a title, every line has a boxed legend → remove titles, use direct labels.
- All methods equally saturated → desaturate or grey the baselines, highlight only Ours.
- Uneven box sizes, irregular gaps, inconsistent text centering → `sameSize` + relative placement.
- Gradients, shadows, oversized corner radii, heavy borders, emoji icons → delete them all.
- Mixed fonts (DejaVu, Times, Arial together) → check.py's font summary shows them; unify on Arial.
