# PROVENANCE — where this skill comes from

## Upstream

- **Source**: [`skills/baoyu-design`](https://github.com/JimLiu/baoyu-design/tree/main/skills/baoyu-design)
  from the repository [JimLiu/baoyu-design](https://github.com/JimLiu/baoyu-design) by 宝玉 (Jim Liu)
- **Upstream commit at fork time**: `6530033592bf7fa58bc1a5a2a2ad278da45213a9` (2026-09-23)
- **License**: MIT © 2026 Jim Liu 宝玉 — carried forward; this fork lives in the
  stylus repo under its MIT license
- **What it is here**: an academic retarget of a general-purpose HTML design
  skill. The design methodology (`system-prompt.md`), harness references,
  starter components, PPTX generation chain, and design-system machinery are
  upstream work; the academic layer and routing are ours.

## Kept (upstream, possibly edited)

| Piece | Notes |
|---|---|
| `system-prompt.md` | Edited: academic routing table, starter list, skills list; video/napkin/social sections removed. Craft text is upstream. |
| `references/claude.md`, `cursor.md`, `codex.md` | Harness tool docs; `claude.md` edited to drop its video-export section (pipeline removed) |
| `references/upstream-system-prompt.md`, `references/upstream-sync/` | Untouched provenance/sync snapshot |
| Starters: `design-canvas.jsx`(+patch), `chart-stage.js`, `deck-stage.js`(+patch), `doc-page.js`, `image-slot.js`, `data-overlay.js`, `tweaks-panel.jsx` | Unchanged (`data-overlay.js` kept as the engine of `design-feedback.md`) |
| `agents/gen-pptx/` (incl. vendored pptxgenjs), `agents/build-preview.mjs`, `agents/lib/`, `agents/compile-design-system.mjs`, `agents/check-design-system.mjs`, `agents/import-design-system.mjs`, `agents/record-asset.mjs`, checker/probe/verifier agent docs, `agents/vendor/` (babel, react, react-dom, fflate), `agents/tests/` | Unchanged; `import-figma.test.mjs` removed with the figma importer |
| built-in-skills (28 files): ask-the-user, create-design-system, data-visualization, design-components, design-feedback, design-system-authoring-guide, design-system-preview, export-as-pptx-editable, export-as-pptx-screenshots, frontend-design, generate-images, hi-fi-design, import-from-github, import-from-html, interactive-prototype, low-level-tweaks-api, make-a-deck, make-a-doc, make-tweakable, maps-geography, options-stack, read-pdf, save-as-pdf, save-as-standalone-html, speaker-notes, tweaks-protocol, use-design-system, web-research, wireframe | Unchanged upstream docs |

## Dropped (not relevant to academic figures)

Video pipeline (`animated-video`, `export-as-video`, `exportable-video`,
`sound-effects`, `animations*.jsx`, `gen-video/`), 3D (`3d-object.md`,
`three-d-stage.js`), social media shells (facebook/instagram/linkedin/
pinterest/reddit/tiktok/x/youtube/post-card/social-frames), UI mockup chrome
(ios/android frames and shells, chrome-shell, macos/browser/file windows),
`watercolor-illustration` + kit, `html-email`, `flier`, `trifold-brochure`,
`social-media-content`, `website-landing-page`, `mobile-prototype`,
`google-slides-safe`, `send-to-canva`, `send-to-figma`, `import-from-figma`
(+ `agents/import-figma.mjs`, `vendor/fig-materialize.mjs`),
`handoff-to-claude-code`, `something-cool`, `claude-api-in-prototypes`,
`gemini-image`, `data-science`, `experiment-workflow`,
hosted-tool stubs (`export-pptx-*.md` superseded by `export-as-pptx-*`),
`SKILL.md` and `project-types.json` (both rewritten). Also edited in place:
the Figma bullet of `design-system-authoring-guide.md` (dropped the link to
the removed `import-from-figma.md`).

Recovery: anything above can be copied back verbatim from the upstream repo at
the commit above — it is all still there.

## Added (ours)

- `SKILL.md` — academic entry/orchestration (rewritten from upstream's)
- `project-types.json` — academic figure-type routing (rewritten)
- `built-in-skills/academic-figures.md` — the academic domain layer: figure
  brief, 300-dpi print-true canvas convention (mm/pt→px), scifig-aligned
  palette tokens, anti-slop rules, export paths, scifig handoff
- `PROVENANCE.md` — this file
- `agents/tests/project-types.test.mjs` — retargeted from the upstream 13-type
  manifest to this fork's 9 academic types (the CI guard now pins OUR contract;
  run with `node --test agents/tests/`)
- Cross-link in `../scifig/SKILL.md` routing → this skill

## Re-syncing with upstream

Upstream evolves; this fork diverged on purpose. To pull in an upstream fix:

1. Clone upstream, diff `skills/baoyu-design` against commit `6530033…`.
2. For files in **Kept (unchanged)**: copy the new version over.
3. For edited files (`system-prompt.md`): re-apply the upstream change, then
   re-check that no dropped-skill reference crept back in.
4. `references/upstream-sync/` in upstream carries its own sync metadata —
   copying it updates the snapshot without touching operative files.
