# Native export and verification

The unmodified upstream editor is the exporter. There is no artifact.mjs
export subcommand. Use **Export → PDF / PNG / HTML** for the current single
artboard example. Native source remains `project/canvas.json` + `.dc.html`;
standalone HTML is a viewing deliverable, not a source interchange format.

## Independent development checks

From `skills/design/`:

```sh
npm ci
npx playwright install chromium
npm test
npm run test:smoke
npm run test:install
```

Ordinary check/upload/open needs Node 20+ only. Playwright and pdf-lib are
this package's own development dependencies, not imports from slides.
Validation used Node 26.12.1 and system Chromium 156.0.8078.79 on Linux:
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/sbin/chromium npm run test:smoke`.
The bundled Playwright browser download timed out here; its default executable
was unavailable. Install that browser first, or select a compatible installed
Chromium with the override. Each smoke records the actual versions and path.

The smoke opens a scratch native canvas, types a label in the WYSIWYG editor,
waits for disk persistence, reloads, runs the upstream check, downloads three
formats via the native menu, parses their real bytes and opens standalone via
file://. Evidence is under ignored `artifacts/`. The isolated-install smoke
copies only this skill into a temporary directory (no slides sibling and no
node_modules), runs check before install, then npm ci, tests and browser smoke.
Neither smoke changes the shipped source example. It stops its own server.

## Measured v2.12.1 support, not hypothetical guarantees

Sample: 688×360 CSS px fixed frame; 24px heading, 16px labels, 14px note.
Actual native exports after a real WYSIWYG edit:

| Output | Observed result |
|---|---|
| PDF | One page, **516×270pt = 182.0333×95.25mm** |
| PDF appearance | **One full-frame raster image**, with invisible selectable/tagged text (`3 Tr`, Glyphless font), **not vector artwork**; observed 1376×720 and 2064×1080px in different runs |
| PDF text layer | 18/12/10.5pt in decoded stream, matching the 24/16/14px planning sizes; it is an invisible layer, not native editable/vector appearance |
| PNG | Observed **1376×720px** (2×, **192 effective DPI** at the measured PDF size); actual values are recorded each run, not guaranteed |
| HTML | Standalone opens offline via file://; one document plus locally generated blob script URLs, **no external/server requests** |
| Editor | Separate HTML nodes/labels and SVG connectors load; text edit saves to the same `.dc.html` and survives reload |

Raster resolution varies: at this page size, 2× is 192 effective DPI and
3× is 288. PDF and PNG need not match; the cause of the observed variation
was not established. Tests check geometry and record actual pixels/DPI, not
a fixed raster scale. Measurements use pdf-lib, the PNG IHDR, and decoded
PDF resources/content. Local `pdfinfo`, `pdftotext` and `pdffonts` additionally
confirmed the page box, searchable scientific symbols and Glyphless text.
Editor/PNG/standalone screenshots were visually inspected: labels fit, k₁/ΔG
render and both arrowheads end beside their target nodes. A PDF proof can be
rendered with `pdftoppm -png -scale-to 1376 artifacts/research-canvas.pdf
artifacts/pdf-proof` and inspected; this is verification, not a second exporter.

## What is not promised

- No native exact-mm controls were demonstrated. The 96px/in planning rule
  agrees with this actual fixed-page export; verify every requested final size.
- This native PDF does **not** satisfy a vector-only journal requirement.
  Searchable/selectable text must not be described as editable vector graphics.
- Fixed raster DPI, 300-DPI output, and matching PDF/PNG resolution are not
  guaranteed. For a smaller placement calculate effective DPI again, and check type too:
  at 50% placement labels become 6pt and the note 5.25pt, often unacceptable.
- No new high-DPI/vector exporter or silent rescaling has been added. If native
  output misses publication requirements, disclose it and ask before any
  external postprocessing or alternate workflow.
- Multi-board PDF order/flow pagination, uploaded/custom/Google fonts, imported
  child components, external images, external-app import and edit-back from
  standalone were not qualified by this minimal sample. Test those when used.
- Arrows are manual separate elements, not auto-routed graph edges; moving a
  node requires reconnecting arrows. One inline SVG plot is one selectable
  block, not individually editable data or a plotting pipeline.

A zero-problem `check` never proves runtime/visual correctness. Inspect the
actual editor and exported files for clipping, glyphs, arrow semantics and
scale. Retain the native project for further edits and report unsupported
requirements rather than claiming them away.
