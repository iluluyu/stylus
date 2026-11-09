# Notes and animations

## Speaker notes

```html
<section data-label="Limitations"
  data-speaker-notes="These are illustrative observations, not experimental results. Explain the missing validation before discussing the next experiment.">
  <div class="slide">...</div>
</section>
```

Omit notes by default. Write conversational notes only when explicitly requested;
do not ask another round of tone
questions if the user's brief already answers them. Escape `&`, `"`, and `<`
in attributes. Empty attributes are valid and override legacy notes for that
slide. Per-slide notes travel with the section on reorder.

For existing decks, a `<script type="application/json" id="speaker-notes">`
array of strings is supported as a fallback. Do not maintain two conflicting
note sources. The exporter attaches notes by **config order from document
order**, not by selector identity: when reordering/subsetting the PPTX config,
first make a matching deck copy with its sections in that same order. This
also matters when omitting skipped slides.

The runtime posts slide position to parent windows, but it does not include a
standalone presenter-notes window. Notes remain available in source and export
into PowerPoint's notes pane.

## Builds

Use no motion unless order carries meaning. Put `data-anim` on descendants,
never on a slide section. Write the visible final layout in CSS.

```html
<p data-anim="fade-in" data-anim-trigger="click">First observation</p>
<p data-anim="appear" data-anim-trigger="click">Second observation</p>
```

| Attribute | Meaning | Default |
| --- | --- | --- |
| `data-anim` | One supported effect | none |
| `data-anim-trigger` | `click`, `with`, `after` | `after` |
| `data-anim-order` | Numeric sort key; ties use document order | `0` |
| `data-anim-delay` | Delay in ms, 0–60000 | `0` |
| `data-anim-duration` | Duration in ms, 1–60000 | effect-specific |
| `data-anim-repeat` | Whole-effect count, 1–100 | `1` |
| `data-anim-auto-reverse` | Bare attribute or `true`; spin/grow/shrink/path only | false |

`click` opens a presenter-paced step. `with` shares the previous item's start;
`after` waits for all preceding effects in the step, including repeats and
reverse legs. Before the first click, effects autoplay on arrival. Reduced
motion plays effects instantly but retains click gating. Backward navigation
shows the fully built slide. Print, thumbnails, and `noscale` capture use base
layout, not hidden pre-build content.

Supported entrance/exit pairs (`-in` / `-out`): fade, fly, wipe, float, split,
bounce, zoom, wheel, random-bars, blinds, checkerboard, dissolve, box, circle,
diamond, plus, strips, wedge. Also supported: `appear`, `disappear`, `spin`,
`grow`, `shrink`, `pulse`, `teeter`, and `path`.

- Fly/wipe direction: `data-anim-dir="left|right|top|bottom"`, default bottom.
- Float: top/bottom, default bottom.
- Split: horizontal/vertical, default vertical. Random-bars/blinds/checkerboard:
  horizontal/vertical, default horizontal.
- Box/circle/diamond/plus: in/out; entrance defaults in, exit defaults out.
- Strips: down-right/down-left/up-right/up-left, default down-right.
- Spin/teeter: `data-anim-rotate`, degrees; defaults 360/5.
- Grow/shrink/pulse: `data-anim-scale`; defaults 1.5/0.67/1.05.
- Path: `data-anim-path="L 240 0"`, relative slide-pixel offsets, +y down.
  Optional initial `M x y`; then `L x y` or `C x1 y1 x2 y2 x y`; at most
  32 sampled points. No arbitrary SVG path syntax.

Default durations: 500 ms for fade/fly/wipe/split/zoom/random-bars/blinds/
checkerboard/dissolve/box/circle/diamond/plus/strips/wedge/pulse; 1000 ms for
float/teeter; 2000 ms for bounce/wheel/spin/grow/shrink/path. Appear/disappear
are instant. One effect per element; nested builds give the innermost build
ownership of its subtree. Avoid nesting unless that distinction is intentional.

Browser previews approximate some PowerPoint filters; old browsers may use a
fade fallback. Do not combine effects with existing masks or CSS animation on
the same element. Multi-shape cards may use a filter on their background and
synchronized fades on their text. Inspect desktop PowerPoint for final playback:
Keynote imports can substitute effects and drop repeat timing. PDF and
screenshot PPTX are static. Unsupported/hidden targets are diagnosed at export;
compare the reported build count with the number of intended builds.
