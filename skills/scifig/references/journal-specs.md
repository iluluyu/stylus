# Journal and conference specifications

`sf.use(name)` (Python) / `sf.setup.with(journal: name)` (Typst) / `check.py --journal name` share this table.
**The Nature row was checked against the official final-artwork guidelines (2026)**; the others are common values —
confirm with the journal's current author guidelines before submission, and if they differ edit `JOURNALS` in
`scripts/scifig/style.py` and `journals` in `scripts/scifig.typ` (keep the two identical).

| Profile | Widths (mm) | Max height | Text size | Minimum | Panel labels |
|---|---|---|---|---|---|
| `nature` (Nature portfolio: Nature, Nat. Mach. Intell., Nat. Comput. Sci. …) | single 89 · 1.5-col 120/136 · double 183 | 170 (room for the legend; full page 247) | 5–7 pt | 5 pt | 8 pt bold lowercase a b c |
| `science` (Science, Sci. Adv.) | 55 · 120 · 175 | ~220 | 6–8 pt | 5 pt | bold uppercase A B C |
| `cell` (Cell Press) | 85 · 114 · 174 | ~225 | 6–8 pt | 5 pt | bold uppercase |
| `pnas` | 87 · 114 · 178 | ~225 | 6–8 pt | 5 pt | bold uppercase |
| `ieee` (Transactions) | 88.9 (3.5 in) · 181 (7.16 in) | ~230 | 8–9 pt | 6 pt | lowercase or (a) |
| `neurips` (NeurIPS / ICLR, single-column layout) | 139.7 (\textwidth 5.5 in); half 67 | — | 8–9 pt | 6 pt | lowercase |
| `icml` | 82.6 (\columnwidth) · 171.5 (\textwidth) | — | 8–9 pt | 6 pt | lowercase |
| `cvpr` (CVPR / ICCV / ECCV, two-column) | 82.6 · 174.6 | — | 8–9 pt | 6 pt | lowercase |

## Nature essentials (final-artwork guide and research figure guide)
- Arial/Helvetica; text 5–7 pt; panel labels 8 pt bold, upright, lowercase.
- **Don't outline or rasterize text**; keep it editable; don't rasterize line art; supply unflattened editable vector files.
- Preferred formats: `.ai` `.eps` `.pdf` (with editing capabilities retained); **plain SVG (not Inkscape SVG)** is also accepted; JPEG/TIFF/PNG are not accepted for main figures.
  → scifig delivers PDF (fonts embedded, text editable) for every figure, plus plain SVG; matplotlib SVGs keep
  `<text>`, Typst SVGs draw glyphs as outlines — submit the PDF for Typst-made figures.
- Embed fonts as TrueType (Type 42), never Type 3 (matplotlib is set to `pdf.fonttype=42`).
- RGB color mode; avoid red–green combinations and rainbow scales; avoid colored text, contrast > 4.5.
- Photographic images ≥ 300 dpi at their largest used size.
- Supply figures at roughly print size; panels in alphabetical order with minimal white space.

## Conference papers
- Body text is larger (10 pt), so figure text is usually 7–9 pt to match; the `neurips`/`icml`/`cvpr` profiles account for this.
- Widths come from LaTeX `\columnwidth` / `\textwidth`; include with `\includegraphics[width=\linewidth]{fig.pdf}` — **draw the figure at that width**, don't rely on LaTeX scaling.
- Conferences usually take PDF: `sf.save` and Typst write it directly; for other SVGs use `check.py fig.svg --pdf`.

## LaTeX example
```latex
\begin{figure*}[t]
  \centering
  \includegraphics[width=\textwidth]{figures/fig2.pdf}   % the file itself is \textwidth wide
  \caption{...}
\end{figure*}
```
