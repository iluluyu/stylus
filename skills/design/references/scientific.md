# Scientific adaptation (content, not a new format)

Use the upstream Design Component grammar in `artifact-type/reference/`.
These few content decisions specialize it for scientific schematics:

- Method overview: input → processing → output; distinguish measured input
  from planned procedures and illustrative output.
- Mechanism: distinguish demonstrated causal effects from hypotheses.
  Define arrow, blunt inhibition bar and dashed-association meanings in a key.
- Graphical abstract: one evidence-backed message and a short reading path;
  avoid converting a paper into a tiny slide deck.
- Flowchart: name decisions and branches, route feedback through clear space,
  size nodes for their labels before drawing connections.
- No fabricated data or photorealistic "results". Source images and quantitative
  plots from supplied material; record provenance and transformations alongside
  the project. Do not use decorative curves as measured data. This skill is
  not a plotting/statistical analysis pipeline.
- Default white, near-black text, blue/orange or equivalent distinguishable
  accents. Do not encode meaning by hue alone. No marketing mockup chrome.
- Symbols (e.g. α, ΔG, k₁, xᵢ), italic variables and units require visual review
  after export; a browser font fallback may change shape or spacing.
- Journal final-size requirements override generic print.md document margins
  and 12pt body defaults. Agree the smallest final type/stroke with the user.
  Keep normal diagram geometry editable; one SVG is only one selectable object.

## Physical size is a verification task

The native index and editor use CSS px, not exact-mm page controls. Upstream
print guidance plans fixed pages at 96 px/in (px = mm × 96 / 25.4;
px = pt × 96 / 72). This is not a guarantee of an exported page box.

Choose a frame within 40–8000px per side. If authoring at a larger size for
comfortable editing, explicitly record the intended placement scale. Example:
688px nominally gives 182.03mm and 516pt at 96px/in; at 50% placement,
16px labels nominally become 6pt. Measure the real PDF/PNG first, then calculate
final text scale; confirm with the journal's minimum and a final-size proof.
Do not silently rescale, crop, rasterize or postprocess exports to claim that
the editor natively meets exact mm. If the native output cannot satisfy the
requested requirement, disclose it and ask before using an external tool.

Separate arrows are manually anchored, **not graph edges with auto-routing**.
Moving a node in the editor does not update arrow endpoints. Recheck them after
both human and agent edits; selecting an element is not scientific validation.
