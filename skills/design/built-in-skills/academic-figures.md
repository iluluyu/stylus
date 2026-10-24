---
name: "academic-figures"
description: "Academic figures\nThe domain layer for paper figures — brief, print-true canvas (mm/pt/dpi), scifig-aligned palette, anti-slop rules, export paths, and handoff"
---

# Academic figures

This is the domain layer that separates a paper figure from a web page. Read it
before **every** figure job in this skill. Craft (layout, hierarchy, spacing)
lives in `system-prompt.md`; journal truth (sizes, fonts, colors, export)
lives here. The sibling skill **scifig** (same repo) is the authority for
final publication rendering — this file keeps both skills on one design
system: same palette hexes, same journal profiles, same figure-brief fields.

## 1. HTML here or scifig?

| The figure is… | Build in | Why |
|---|---|---|
| Made of **data** — curves, bars, heatmaps, anything whose numbers come from experiments | **scifig** (matplotlib) | Data integrity, seed bands, lint; hand-transcribed numbers in a schematic are fabrication risk |
| Made of **ideas** — method overview, mechanism 示意图, taxonomy, architecture | **here** (HTML) | Layout, typography and mixed content iterate 10× faster in CSS than in any plot library |
| A **graphical abstract / TOC graphic** | **here** | Dense narrative layout, one rectangle, no data axes |
| **Schematic + data panels combined** (typical Figure 1) | **here for layout**, scifig for each data panel | Render data panels with scifig (`sf.save` gives SVG), drop them into the HTML canvas as `<img src="…svg">`, compose around them |
| Final journal submission demanding fully editable vector with embedded Type-42 fonts | **scifig** (Typst/matplotlib) | Browser print-PDFs embed fonts as the browser chooses; scifig controls `pdf.fonttype=42` |

Rule of thumb: **explore here, finalize in scifig when the journal is strict**.
An HTML print-PDF (vector text, exact mm) is fine for arXiv, supplementary,
preprints, slides, posters, and most conferences; for Nature-portfolio final
main figures, port the winning composition to scifig's Typst schematic library.

## 2. The figure brief (30 seconds, before any pixel)

Same five fields as scifig — write it in chat or as a comment atop the HTML:

```
Message:  the one sentence the figure must land
          (e.g. "our update rule removes the drift the baselines suffer")
Reader:   what a reviewer sees in 3 seconds; the most salient element = the message
Panels:   what each panel shows and how they read left→right / top→bottom
Size:     journal + column (single/double), height in mm  →  canvas px below
Colors:   method → color mapping; "ours" gets the accent (palette below)
```

If the user's paper draft or repo is at hand, read it first — the brief comes
from the paper's claims, not from thin air.

## 3. Print-true canvas: design at 300 dpi, never rescale later

HTML is px-native, journals are mm/pt-native. Bridge it with a fixed
convention and never eyeball it:

**Canvas width (px) = mm × 11.811** (that is mm at 300 dpi). Height: pick the
aspect, same conversion.

| Venue column | mm | canvas px |
|---|---|---|
| Science 1-col | 55 | 650 |
| CVPR/ICML/ECCV column | 82.6 | 976 |
| Cell 1-col / 1.5-col | 85 / 114 | 1004 / 1346 |
| Nature single | 89 | **1051** |
| Nature 1.5-col | 120–136 | 1417–1606 |
| NeurIPS/ICLR \textwidth | 139.7 | 1650 |
| CVPR/ICML \textwidth | 171.5–174.6 | 2025–2062 |
| Nature/Science/PNAS double | 175–183 | 2067–**2161** |

**Font px = pt × 4.167** (300 dpi). Nature body text 5–7 pt → 21–29 px;
conferences 7–9 pt → 29–38 px. Panel labels **a b c**: 8 pt bold lowercase
(Nature family) = 33 px. Line weights: hairline 0.25 pt ≈ 1 px, standard
0.5–1 pt = 2–4 px, "ours"/message strokes thicker than context strokes.

```html
<style>
  /* Figure canvas — Nature double column, 90 mm tall */
  .figure-canvas { width: 2161px; min-height: 1063px; background: #fff;
                   font-family: Helvetica, Arial, sans-serif; color: var(--fig-ink);
                   position: relative; }
</style>
```

Screenshot/export the canvas at 1:1 → the PNG is exactly 300 dpi at print
size. **Never design big and shrink** — scaling changes every font size (same
rule as scifig).

## 4. Palette — identical tokens to scifig

Okabe–Ito derived, color-blind-safe, deepened for print. These are the same
hexes as scifig's `scifig` palette and Typst tones; a method keeps one color
across every figure of the paper.

```css
:root {
  --fig-surface: #ffffff;
  --fig-ink:     #1a1a1a;   /* text */
  --fig-muted:   #6E6E6E;   /* secondary text, reference/context elements */
  --fig-primary: #1A5FA0;   /* baseline 1 / standard component (Typst "primary") */
  --fig-accent:  #CF5B2A;   /* OUR method — the only saturated emphasis (Typst "accent") */
  --fig-green:   #118C6E;   /* baseline 2 */
  --fig-purple:  #C26FA3;   /* losses / objectives (Typst "loss") */
  --fig-amber:   #E1A02E;   /* baseline 4 */
  --fig-sky:     #5BADDF;   /* baseline 5 */
}
```

Rules (scifig `color.md`, condensed):
1. Accent = "ours" = the message. Everything structural gets ink/muted/neutral fills; color is spent only on what the reader must track.
2. ≤ 6 hues; group a method family by lightness steps of one hue, not new hues.
3. Color is never the only encoding — pair hue with weight, dash, or position; the figure must survive a grayscale screenshot.
4. No red/green opposition; no rainbow gradients; fills pale (mix with white) so text on top keeps > 4.5 contrast.
5. When matching an existing scifig figure, take the hexes it used (`references/color.md` in scifig or its generated files) — do not invent neighbors.

## 5. Typography and math

- **Sans for figure text** (Helvetica/Arial family) is the Nature-portfolio norm; a serif only when the venue's house style is serif. One family, ≤ 3 sizes per figure (panel label > element label > detail).
- **Math**: variables italic serif (`<i>` in `"Times New Roman", STIX, serif` with `letter-spacing: .02em`), sub/superscripts via `<sub>/<sup>` — this covers f<sub>θ</sub>(x), 𝒟, 𝔼 without any library. Real display equations → KaTeX (pin one version; snapshot `katex.min.js` + css + fonts into the project folder for offline, same self-containment rule as any asset). Never fake math with Unicode approximations that render differently across OSes (𝒳, ℝ glyph coverage varies — test the screenshot).
- **Panel labels** a/b/c: bold, lowercase (Nature/NeurIPS/CVPR) or per venue, in the canvas corner of each panel, 8 pt = 33 px, one set per figure.
- CJK in figures (mostly for talk slides): follow the CJK type rules in `system-prompt.md`.

## 6. Academic anti-slop (hard rules)

A paper figure is evidence, not decoration. Banned outright — they read as
marketing and survive grayscale badly:

- Gradients, drop shadows, glows, glassmorphism, rounded-left-accent cards.
- Emoji, decorative icons, stock illustration filler.
- 3D-anything (bars, perspective, tilt), chart junk, heavy grids, boxed frames around panels.
- Web fonts as identity: no Inter/Roboto defaults; Helvetica/Arial matches journal norms.
- Dark backgrounds; anything not on `--fig-surface: #fff` (dark mode is for slides only — for decks use the deck conventions in `make-a-deck.md`).
- Transcribed numbers: if a number appears in the figure, it came from a file the user gave or a scifig output — never from memory.

Prefer, always: direct labels on elements over separate legends; one arrow
grammar per figure (same weight, head style, and color semantics for the same
kind of flow); negative space over boxes; alignment to a visible grid; the
message element carrying the only saturated color on the canvas.

## 7. Export

- **PNG 300 dpi** (default quick deliverable): screenshot the `.figure-canvas` element at 1:1 — pixel width already equals mm × 11.811, so 1051 px = 89 mm @ 300 dpi. Name it `<figname>.png`.
- **Vector PDF at exact print size**: build a print copy (`save-as-pdf.md` flow) with
  ```css
  @page { size: 89mm 47mm; margin: 0; }            /* exact canvas mm */
  .figure-canvas { transform: scale(.32); transform-origin: 0 0; }  /* 96/300 */
  ```
  Print → Save as PDF. Text stays selectable vector; check the PDF page size is exactly the mm you set.
- **Standalone HTML** (`save-as-standalone-html.md`) for interactive/animated figures and supplementary material.
- **PPTX** only for talk decks via the deck chain (`make-a-deck.md` → `export-as-pptx-editable.md`).
- Text stays text in every path — never outline or rasterize labels.

## 8. Loop: render → screenshot → critique → fix

Same discipline as scifig's render-look-fix loop, browser edition:

1. Serve `designs/` over HTTP, screenshot the canvas (zoom into dense regions too).
2. Check: exact column width? smallest text ≥ venue minimum? panel labels present, one set? overlaps anywhere? arrows consistent? grayscale screenshot still lands the message? accent only on "ours"/the message? caption drafted?
3. Fix, re-render. Done = every check passes **and** you'd show this figure to Reviewer 2.

When done, draft the caption (see below) and offer the scifig handoff when
data panels or strict-journal vector masters are involved.

## 9. Caption and the writing siblings

Deliver every figure with a caption draft, first sentence = the Message from
the brief. State: what n is (seeds/repeats/subjects), what bands/error bars
show, any statistical test, and the meaning of panel letters. Caption and
prose conventions come from the **scientific-paper-writing** skill (load its
structure reference when drafting full figure captions for the paper).

## 10. Composing with scifig output (the Figure-1 pattern)

1. Draft the schematic layout here (design-canvas, print-true canvas).
2. Render each data panel in scifig at the **same journal profile and column
   fraction** it occupies in the layout (`sf.subplots(width=…)` in mm).
3. `sf.save` → take the `.svg` (keep the `.pdf` for submission) → `<img>` it
   into the canvas at native size (px = its mm × 11.811, so 1:1, no scaling).
4. Compose, label panels a/b/c once, screenshot, critique.
5. For submission: hand over the HTML print-PDF plus the underlying scifig
   panel PDFs; if the journal wants one editable vector master, rebuild the
   schematic wrapper in Typst (scifig `composition.md`) using the exact
   geometry settled here.
