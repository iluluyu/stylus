# Multi-panel composition (one figure = one source file)

## Plan on paper first (mm)
1. Choose the figure width (double 183 / single 89) and height (Nature ≤ 170).
2. Draw the grid: width and height of each panel (mm), 3–5 mm between panels. Reading order a→b→c left to right, top to bottom.
3. Same-type panels get the same size and aligned axes: panels in a row sharing a y range use `sharey=True` and drop inner y labels.
4. The schematic usually goes in a (a full top row), results after it; Figure 1 = method + one "signature" result is a common structure.

## Case 1: data plots only → one matplotlib Figure, one `.py`
```python
fig, axd = sf.mosaic("aab;cde", width="double", height=120,
                     gridspec_kw={"width_ratios": [1, 1, 1.2], "height_ratios": [1, 0.9]})
...
sf.panel_labels(fig, axd)       # aligns a/b/c: left per column, top per row
sf.save(fig, "figures/fig3")
```
Inside one Figure, constrained layout handles alignment, font sizes and spacing — do this whenever possible.

## Case 2: schematics only → one `.typ`
Several diagrams on one page: define each with `#let a = sf.diagram(..)`, then lay them out:
```typ
#sf.panel("a", a)
#v(4pt)
#grid(columns: (1fr, 1fr), column-gutter: 4mm, sf.panel("b", b), sf.panel("c", c))
```
Build: `python <skill>/scripts/check.py figures/fig1.typ`.

## Case 3: schematic + data plots → one `.py` that holds the Typst layout
The matplotlib panels are drawn at their final size and saved as PDF; the Typst layout (schematic + page) is a
string in the same script and is compiled with `sf.typst_figure`. Full example: `examples/fig1_overview.py`.
```python
fig, ax = sf.subplots(width=89, height=80)            # exactly the cell it will occupy
...                                                    # no sf.panel_labels: Typst labels every panel
panel_c = sf.save(fig, "figures/fig1_panel_c", formats=("pdf", "png"))["paths"]["pdf"]

LAYOUT = r"""
#import "scifig.typ" as sf
#show: sf.setup.with(journal: "nature", width: "double")
#let method = sf.diagram( ... )
#sf.panel("a", method)
#v(5pt)
#grid(columns: (89mm, 89mm), column-gutter: 5mm,
  sf.panel("b", flowchart),
  sf.panel("c", image("panel_c.pdf")),
)
"""
sf.typst_figure(LAYOUT, "figures/fig1", files={"panel_c.pdf": panel_c})
```
- `files` maps names used inside the Typst source to files on disk; `scifig.typ` is provided automatically.
- `image("x.pdf")` / `image("x.svg")` keep matplotlib panels vector, and the composed PDF keeps their text as text.
- Make each data panel **at its size in the final figure** (two side-by-side cells in a 183 mm row: 89 mm each with a
  5 mm gutter). Never let Typst scale an image (`image(.., width: ..)` changes every font size).
- Labels: one set only — either Typst (`sf.panel`) for every panel, or `sf.panel_labels` inside a matplotlib
  figure, never both for the same panel.
- Output: `fig1.pdf` (editable text, the file to submit), `fig1.svg` (text as outlines), `fig1.png` (preview) + lint.

## Delivering one file
`python <skill>/scripts/bundle.py figures/fig1.py` embeds the scifig library (Python and scifig.typ) into
`figures/standalone/fig1.py`; the user can move that single file anywhere and run it.

## Consistency checklist (before composing)
- Every panel uses the same journal: `sf.use("<journal>")` in Python and `sf.setup.with(journal: "<journal>")` in Typst.
- Method colors come from one `method_colors` dict; the schematic `accent` tone is the same value as Python's `ACCENT`.
- The same quantity uses the same unit, axis-label wording and tick magnitude across panels.
- White space: 3–5 mm between panels; never enlarge fonts or boxes to fill space.
