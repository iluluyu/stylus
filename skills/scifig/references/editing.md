# Further editing in Illustrator / Inkscape / Figma

Which file to open depends on where the figure came from:

| Source | Editable master | Notes |
|---|---|---|
| matplotlib (`sf.save`) | `.svg` **or** `.pdf` | SVG text is `<text>`; PDF fonts are TrueType (Type 42) |
| Typst (`check.py fig.typ`, `sf.typst_figure`) | **`.pdf`** | real text, fonts embedded; Typst's SVG draws glyphs as outlines (looks identical, not editable as text) |

## matplotlib SVGs are built for post-editing

| Property | Effect |
|---|---|
| Text is `<text>` with the font stack `Arial, Helvetica, Liberation Sans, Arimo, sans-serif` | editable on open; with Arial/Helvetica installed the layout matches the preview |
| Meaningful group ids: `panel-a`, `a-line-ours`, `a-band-ours`, `a-xaxis`, `a-legend` | objects are findable in the layers panel; Illustrator uses ids as layer / group names |
| Data lines inside axes have no clip groups | select a curve without ungrouping a clip group first |
| Mathtext per-glyph `<tspan>`s are merged | formula labels are editable strings, not 20 loose characters |
| Plain SVG (no Inkscape namespaces), sizes in mm | accepted by journals; correct physical size in every app |
| Transparent background (SVG/PDF) | no white plate blocking things when composing or overlaying |

## Typst PDFs
- Open in Illustrator: text stays text (font embedded); boxes, arrows and groups are vector paths. Install Arial /
  Helvetica (or the Liberation Sans used to build it) for the text to stay editable with the same metrics.
- Inkscape: import the PDF with the internal importer (the Poppler/Cairo importer outlines text) and choose a
  font option that keeps text as text.
- Need an SVG with real text from a Typst figure? Import the PDF into Inkscape / Illustrator and save as plain SVG.
  For web, PowerPoint or Word, Typst's own SVG is fine (outlines render identically everywhere).
- Prefer editing the `.typ` source: every box, label and color is one line, and the lint re-checks the result.

## Per-application notes
- **Illustrator**: open `.svg` or `.pdf` directly. When exporting `.ai`/`.eps`/`.pdf`, keep "Preserve editing capabilities" and font embedding; **never** "Create Outlines".
- **Inkscape**: after editing, "Save As → Plain SVG" — Nature does not accept Inkscape SVG. Or export PDF with embedded fonts.
- **Figma**: imported SVG text is editable; without Arial installed Figma substitutes the font — check before export.
- **PowerPoint / Keynote**: insert the SVG (or PDF on macOS); "Convert to Shape" to edit; for talks a PNG is enough.

## Recommended manual tweak workflow
1. Change as much as possible in code (data, labels, colors, spacing) and regenerate — reproducibility.
2. Hand-edit only what code can't express easily (nudge a label 1 mm, add a hand-drawn arrow).
3. After editing, run `python <skill>/scripts/check.py edited.pdf` (or `edited.svg --pdf`) once more to check font sizes and fonts.

## Format conversion
- Matplotlib figures: `sf.save` writes SVG, PDF and PNG directly.
- Typst figures: `check.py fig.typ` writes PDF, SVG and PNG.
- SVG → PDF: `python <skill>/scripts/check.py fig.svg --pdf` (cairo backend, fonts embedded, text selectable).
- EPS: export from Illustrator / Inkscape, or `pdftops -eps fig.pdf fig.eps` (poppler).
