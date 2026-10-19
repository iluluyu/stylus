# Further editing in Illustrator / Inkscape / Figma

scifig SVGs are built for post-editing:

| Property | Effect |
|---|---|
| Text is `<text>` with the font stack `Arial, Helvetica, Liberation Sans, Arimo, sans-serif` | editable on open; with Arial/Helvetica installed the layout matches the preview |
| Meaningful group ids: `panel-a`, `a-line-ours`, `a-band-ours`, `a-xaxis`, `a-legend`; diagrams `node-encoder`, `edge-a-b`, `group-inner`, `layer-edges` | objects are findable in the layers panel; Illustrator uses ids as layer / group names |
| Diagram layers: groups → edges → nodes → annotations → labels | hide all edges at once, adjust boxes separately |
| Data lines inside axes have no clip groups | select a curve without ungrouping a clip group first |
| Mathtext per-glyph `<tspan>`s are merged | formula labels are editable strings, not 20 loose characters |
| Plain SVG (no Inkscape namespaces), sizes in mm, 1 user unit = 1 pt | accepted by journals; correct physical size in every app |
| Transparent background (matplotlib SVG/PDF) | no white plate blocking things when assembling or overlaying |

## Per-application notes
- **Illustrator**: open `.svg` or `.pdf` directly, both editable. When exporting `.ai`/`.eps`/`.pdf`, keep "Preserve editing capabilities" and font embedding; **never** "Create Outlines".
- **Inkscape**: after editing, "Save As → Plain SVG" — Nature does not accept Inkscape SVG. Or export PDF with embedded fonts.
- **Figma**: imported SVG text is editable; without Arial installed Figma substitutes the font — check before export.
- **PowerPoint / Keynote**: insert the SVG and "Convert to Shape" to edit, losing some structure; for talks a PNG is enough.

## Recommended manual tweak workflow
1. Change as much as possible in code (data, labels, colors, spacing) and regenerate — reproducibility.
2. Hand-edit only what code can't express easily (nudge a label 1 mm, add a hand-drawn arrow).
3. After editing, run `check.py edited.svg --pdf` once more to check font sizes and fonts.

## Format conversion
- SVG → PDF: `python <skill>/scripts/check.py fig.svg --pdf` (cairo backend, fonts embedded, text selectable).
- Matplotlib figures: `sf.save` writes PDF directly (TrueType embedded).
- EPS: export from Illustrator / Inkscape, or `pdftops -eps fig.pdf fig.eps` (poppler).
