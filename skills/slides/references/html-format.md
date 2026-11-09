# HTML deck format

The starter is a local custom element, not a framework. See the runnable
[research deck](../examples/research-deck/index.html). Its data are explicitly
illustrative, not research results. It includes notes and one build solely to
exercise export tests; omit notes in a new talk unless explicitly requested.

## Structure and typography

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Research talk</title>
  <style>
    :root {
      --type-title: 64px; --type-body: 34px; --type-small: 28px;
      --pad-x: 100px; --pad-y: 80px; --gap: 32px;
    }
    body { margin: 0; }
    deck-stage:not(:defined) { visibility: hidden; }
    .slide {
      height: 100%; box-sizing: border-box;
      padding: var(--pad-y) var(--pad-x);
      background: #f8fafc; color: #142334;
      font: var(--type-body)/1.35 Arial, "Noto Sans CJK SC",
            "Microsoft YaHei", "PingFang SC", sans-serif;
    }
    h1, h2 { font-size: var(--type-title); margin: 0 0 var(--gap); }
    p { margin: 0 0 var(--gap); }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <deck-stage width="1920" height="1080" no-rail>
    <section data-label="Question"><div class="slide"><h1>Research question</h1></div></section>
    <section data-label="Method"><div class="slide"><h2>Method</h2></div></section>
  </deck-stage>
  <script src="deck-stage.js"></script>
</body>
</html>
```

Copy `starter-components/deck-stage.js` beside that file. One direct section is
one slide. Do not add layout attributes to the sections: the stage positions
and sizes them. Inner wrappers need an explicit height; absolute-positioned
images otherwise collapse their containing block. Keep local assets at valid
relative URLs, and put scripts/styles outside the stage.

Use literal HTML for slide bodies. Separate leaf text elements are easier to
edit and convert than mixed nested markup. Keep scientific plots as supplied
images or simple SVG, with uncropped labels. SVG/image content is generally
raster media in PPTX, not editable chart data. Use ordinary HTML text and boxes
for diagram parts that must remain editable.

## Navigation and capture

- Right/Down, Space, PageDown: play the next click build, then next slide.
- Left/Up, PageUp: previous slide, fully built on backward arrival.
- Home/End: first/last; R: restart. Numeric keys jump by visible slide number.
- Touch: tap the left/right half; interactive slide controls keep their clicks.
- API: `document.querySelector('deck-stage').goTo(0)` (zero-based).
- Event: `slidechange` bubbles with `detail.index`, `previousIndex`, `total`,
  `slide`, `previousSlide`, and `reason`.
- `noscale` disables scaling and builds for authored-size exporter capture.
- `data-deck-skip` on a section omits it from sequential navigation and print.
  Direct API jumps can still visit skipped slides. Exclude them from PPTX config
  explicitly if the export should omit them.

The component owns print page dimensions and page breaks. Do not add a second
`@page` rule or a fixed-height outer wrapper. Its `beforeprint` handler clears
runtime build state so printed slides show their authored visible content.

## Optional host integration

The default thumbnail rail can navigate slides. Without a host, structural
edits change only the live DOM and disappear on reload. With `window.__dcUpdate`,
they dispatch `dc-op` for a host to apply and await its acknowledgement.
No source-file persistence is included. Use `no-rail` for ordinary standalone
decks. The existing runtime retains host
messages and reserved bookkeeping attributes for compatibility; none are
required by this skill or its example. See [stage contract](stage-contract.md).

Native fullscreen patches 1–2 are recorded in the patch ledger but are not
applied in the migrated upstream runtime. Browser fullscreen itself still
works; do not advertise an F shortcut or automatic rail hiding. Animation
patch 3 is applied. See [patch ledger](../starter-components/deck-stage-patch.md).

## Portable HTML

A directory containing HTML, stage JS, and local assets works offline once
copied intact. For a single-file example, run `npm run standalone` in this skill:
it inlines the stage into `artifacts/research-deck.html`. That script deliberately
supports only the asset-free bundled example, not arbitrary page packaging.
For a custom deck, inline all local CSS, JS, fonts (if licensed), and media;
verify it makes no external requests before calling it standalone.
