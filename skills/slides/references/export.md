# Local export

Run all commands below from the **slides skill directory** (the directory
containing `SKILL.md`), unless noted. Node >=22.18 and npm are needed for the
TypeScript test suite; current Node LTS is recommended. No design installation,
React, CDN, model service, or hosted export tool is required.

## Install and build

```sh
npm ci --prefix agents/gen-pptx
npm exec --prefix agents/gen-pptx -- playwright install chromium
npm run build
```

On Linux, missing browser system libraries may require Playwright's documented
OS dependency installation by an administrator. Browser downloads and npm
installation need network access unless already cached. Deck viewing and the
example exports use only local resources after setup.

## Preview

```sh
npm run serve
```

This serves this skill at `http://127.0.0.1:4311`; open
`http://127.0.0.1:4311/examples/research-deck/index.html`. Stop with Ctrl+C.
For another directory, `node scripts/serve.mjs /absolute/project/path 4312`
serves that directory. Bind is loopback-only; reuse an existing server when possible.

## Editable PowerPoint (default)

The example config at `examples/research-deck/pptx.json` is directly runnable:

```sh
node agents/gen-pptx/dist/cli.mjs \
  --url http://127.0.0.1:4311/examples/research-deck/index.html \
  --config examples/research-deck/pptx.json --out artifacts
```

Example contract (JSON, not a hosted tool call):

```json
{
  "mode": "editable",
  "width": 1920,
  "height": 1080,
  "resetTransformSelector": "deck-stage",
  "filename": "research-deck",
  "slides": [
    {
      "showJs": "document.querySelector('deck-stage').goTo(0)",
      "selector": "deck-stage > [data-deck-active]"
    },
    {
      "showJs": "document.querySelector('deck-stage').goTo(1)",
      "selector": "deck-stage > [data-deck-active]"
    }
  ]
}
```

Include one entry per desired slide in order, using zero-based `goTo(N)`.
Match width/height to the authored canvas. `resetTransformSelector` sets
`noscale`, removing the stage's shadow-DOM scale before measurement. `showJs`
is trusted code executed in the deck; use only configs you trust. It must be
synchronous (no `await`); optional `delay` in ms defaults to 600.

`--config -` reads JSON from stdin. `--out` defaults to the current directory.
The CLI writes `<out>/<filename>.pptx` and prints a JSON result containing
`ok`, `file`, `slides`, `animations`, `bytes`, `flags`, `warnings`, and
`speakerNotes`. Success with warnings still exits 0; usage/config errors exit
64; runtime failures exit 1. Verify `ok` and the file, not just the exit code.

Editable means native text/shapes where supported, not a universal converter.
Images, complex SVG, and plots remain raster media; CSS layouts, filters,
clipping, and complex typography can differ. Simplify and inspect output.
Only discrete fixed-size slides are supported; do not point this at a report
or arbitrary web page and claim a deck conversion.

## Screenshot PowerPoint (explicit request only)

Use the same config with `"mode": "screenshots"`, or the bundled
`examples/research-deck/pptx-screenshots.json`:

```sh
node agents/gen-pptx/dist/cli.mjs \
  --url http://127.0.0.1:4311/examples/research-deck/index.html \
  --config examples/research-deck/pptx-screenshots.json --out artifacts
```

Each slide becomes one image, not editable objects. The bundled exporter
puts deck-stage into authored-size base-state capture and suppresses its
shadow controls in screenshot mode. For a custom stage, supply `hideSelectors`
and its own final-state setup in `showJs`; screenshot mode captures the whole
viewport, not just `selector`. The selector field remains required by the schema.
Animations do not survive as builds, although notes do. Expect an animation
warning if the source has builds; explain this limitation when relevant.

## PDF and standalone HTML

Browser Print → Save as PDF uses the stage's page dimensions and hides chrome.
Enable background graphics and use zero margins; do not override its page size.
For reproducible local PDF generation, with the preview server still running:

```sh
node scripts/export-pdf.mjs \
  http://127.0.0.1:4311/examples/research-deck/index.html artifacts/research-deck.pdf
npm run standalone
```

The PDF helper waits for the stage and fonts, then uses Chromium print CSS,
`preferCSSPageSize: true`, and `printBackground: true`. Verify page count and
final-state figures. PDF has no animations or editable slide objects.
`standalone` writes the asset-free example to `artifacts/research-deck.html`
with the runtime inlined. A normal HTML deck directory is already offline-capable
if its local assets travel together; it is not a single-file deliverable.

## Fonts and notes

Keep installed fonts when practical. An explicit CJK-capable stack avoids
browser tofu; the preserved CJK exporter patch names an East-Asian fallback in
PowerPoint's `a:ea` slot. Fonts are not embedded: test on the target machine.
Optional `fontSwaps: [{"from":"BrandSans","to":"Arial"}]` reflows before capture.
Optional `googleFontImports` downloads named families; avoid it for offline work.
A swap cannot prove destination coverage. Report failed loads and substitutions.

Per-section `data-speaker-notes` is authoritative; legacy JSON notes are a
fallback. Notes follow document order. See [notes](notes-and-animations.md)
before exporting a subset or a reordered config.

## Read diagnostics

- `duplicate_adjacent` / `duplicate_majority`: usually failed navigation;
  compare slide text and capture delay.
- `slide_size_mismatch` / `reset_selector_miss`: wrong root or unreset scale.
- `fonts_timeout` / `font_swap_failed`: check actual fonts and reflow.
- `images_failed`: missing/undecodable assets; fix before delivery.
- `notes_count_mismatch` / `notes_uniform_nonempty`: align and review notes.
  `no_speaker_notes` is expected if notes were not requested.
- `animation_invalid` / `animation_hidden_target` / `animation_nested`: inspect
  the affected elements; correct invalid values or hidden/nested targets.
- `animations_ignored_screenshots`: expected only for a knowingly static export.

Inspect build-time `warnings` too. Fix real defects and re-export; translate
remaining limitations into plain language rather than dumping diagnostic codes.
The local CLI closes its own browser; it does not operate the user's browser.
