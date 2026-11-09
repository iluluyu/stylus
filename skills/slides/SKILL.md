---
name: slides
description: Create research presentations as real, navigable slide decks in HTML, PDF, or editable PowerPoint. Use for lab meetings, conference talks, defenses, teaching, and research proposals; plan the scientific story, build readable 16:9 slides, and verify local exports. Includes an offline HTML starter and its own PPTX toolchain. Not a general web-page-to-PowerPoint converter.
---

# Research slides

Build a presentation for a speaker, not a scrolling website.
Keep the argument clear, the evidence honest, and the slides readable from a distance.
This directory is self-contained; no other skill or prompt is required.

## Establish the brief

- Use the supplied paper, results, figures, and audience context first.
- Ask only questions that materially change the result, in one short round.
- Resolve missing audience, duration, or required deliverable if these are consequential.
- Do not repeatedly ask for style, notes, or animation preferences.
- If reasonable defaults suffice, state them and start: a concise research talk,
  restrained light theme, 16:9, editable PPTX when PowerPoint is requested.
- Follow an explicit slide count, language, template, or venue constraint.
- Keep output in the user's chosen project directory; do not overwrite source data.

## Plan the scientific argument

1. State the research question and why the audience should care.
2. Identify the gap, hypothesis, or decision the talk addresses.
3. Explain only the methods needed to interpret the evidence.
4. Show the central findings with the appropriate comparison or baseline.
5. Separate interpretation from observation; acknowledge limitations.
6. Close with the answer, its scope, and the next experiment or decision.

Adapt this sequence to a proposal, tutorial, defense, or short update.
Do not impose a full paper structure on a five-minute talk.
Share the full title sequence before building; do not wait for approval unless unclear.
The titles alone should reveal the story. Use one grammatical style, without theatrical punchlines.
Build in order: finish each slide's message, evidence visual, and source before the next.
Budget time for difficult figures, questions, and transitions, not just slide count.
Move derivations and secondary experiments to an appendix when useful.

## Protect the evidence

- Never invent measurements, error bars, sample sizes, citations, or statistical tests.
- Label hypothetical examples and simulated data visibly; do not imply real findings.
- Preserve units, axis meanings, scales, uncertainty definitions, and comparison conditions.
- Distinguish correlation from causation and results from proposed work.
- Attribute external figures, quotes, and claims with traceable sources.
- Keep scientific caveats near the relevant result, not only in notes.
- Prefer supplied plots and diagrams; verify their labels remain legible at slide size.
- If a necessary input is missing, flag it rather than fabricating a polished result.

## Compose for projection

- Default canvas: 1920 × 1080 CSS px (16:9), one fixed-size section per slide.
- Use one scale of four or five sizes: roughly 64 px titles, 34 px body, 28 px captions.
- User-requested PowerPoint sizes normally mean points: CSS px = pt × 96 / 72.
- Keep titles at least 48 px and small text at least 24 px on the default canvas.
- Budget space for title, visual, text, and footer. Cut, sequence, or split crowded
  content; do not shrink text to rescue a slide or clip it in a fixed-height box.
- Choose few fonts for the subject; preserve an existing deck's typefaces. Use a
  Latin/CJK stack, e.g. Arial, Noto Sans CJK SC, Microsoft YaHei, PingFang SC, sans-serif.
  Check the actual weights, Chinese, Greek, subscripts, and mathematical symbols.
- Fonts are not embedded in PPTX; substitutions can change line breaks on another machine.
- Prefer left-aligned text, generous margins, meaningful alignment, and whitespace.
- Vary layouts to suit content, while keeping section titles and repeated elements consistent.
- Use contrast, direct labels, and redundant encodings rather than color alone.
- Show images and diagrams without distortion; do not crop away scientific information.
- Draw exact labels, tables, and simple diagrams as editable text and shapes.
- Typeset complex equations reliably and keep their source. If exported as graphics,
  disclose that they are not native editable PowerPoint equations; do not fake them with Unicode.
- Do not replace evidence with decorative imagery or an unsupported infographic.

## Build a real deck

Use `starter-components/deck-stage.js`, a local vanilla-JS custom element.
The offline starting point is `examples/research-deck/index.html`.
Copy the stage beside the project's HTML and adjust its script URL when relocating.
Keep slide text as static HTML; no React, CDN, or hosted editor is needed.

```html
<deck-stage width="1920" height="1080" no-rail>
  <section data-label="Question"><div class="slide">...</div></section>
  <section data-label="Evidence"><div class="slide">...</div></section>
</deck-stage>
<script src="deck-stage.js"></script>
```

The stage supplies fit-to-viewport scaling, keyboard/tap navigation, and print pagination.
Do not size or position the slide sections yourself; fill their inner wrapper to 100% height.
Keep scripts and styles outside the stage's slide children.
Use `no-rail` for standalone presentation; persistent rail editing requires a host integration.
For full markup, APIs, and optional host behavior, see [HTML format](references/html-format.md).

## Revise with care

Reread the affected slides immediately before editing. Change only the requested
content; preserve unrelated layout, type, colors, order, identifiers, and notes.
Match new slides to their neighbors. Suggest broader improvements rather than applying them.

## Notes and motion are optional

Do not add speaker notes by default; add them only when the user explicitly requests them.
Put plain text in each section's `data-speaker-notes` attribute; escape HTML attribute characters.
Notes must match the slide and language, not repeat a generic placeholder on every page.
Keep the audience-facing slide visual-first, but do not hide essential qualifications in notes.
Legacy JSON notes are supported for existing decks; prefer per-slide attributes for new work.
Notes travel with source and exports and may be read by recipients; do not put secrets in them.

Default to no animation. Use builds only when reveal order helps explain the research.
Use `data-anim` inside slides for native PowerPoint builds, not arbitrary CSS animation.
Author the final visible state; print and capture must not lose unrevealed content.
See [notes and animations](references/notes-and-animations.md) only when needed.

## Deliver the requested formats

- HTML: a navigable deck plus all local assets, or a genuinely inlined standalone file.
- PDF: one page per non-skipped slide, correct aspect ratio, no navigation chrome.
- PPTX: editable native text and shapes by default; raster figures remain images.
- Screenshot PPTX: only on explicit request for flat, non-editable image slides.
- Not all HTML/CSS maps to native PowerPoint objects. Simplify unsupported constructs
  or discuss limitations; never promise arbitrary HTML conversion or perfect editability.
- A dashboard, article, or landing page must first be reauthored as discrete slides.

Run the bundled local CLI; there is no assumed hosted `gen_pptx` tool.
Setup, concrete commands, config, font strategy, and diagnostics are in
[export](references/export.md). Install only this directory's dependencies.
For the offline example, `npm run serve` from this directory starts the preview server.

## Verify before handoff

1. Preview over HTTP; check console errors, missing resources, and actual slide text.
2. Inspect all slides at presentation size and a small viewport; check wrapping and clipping.
3. Test forward/back navigation, first/last slide, and any click-gated builds.
4. Check print pagination, slide dimensions, and final-state visibility in the PDF.
5. Export PPTX and inspect diagnostics, slide count, native text, notes, and build count.
6. If available, inspect the result in desktop PowerPoint; disclose when that was not done.
7. Re-export after edits; do not deliver stale artifacts or claim unperformed visual checks.

Provide the HTML/assets, actual exports, and a preview URL or clear local-open instructions.
State editable scope, font substitutions, static content, and unperformed checks plainly.
Never mark a missing format as delivered. See [testing](references/testing.md) for repository checks.

Guidance reviewed against baoyu-design **v2.12.1** (`7db9784`), adapted for research talks.
The original fork base is separate: [provenance and licenses](PROVENANCE.md).
