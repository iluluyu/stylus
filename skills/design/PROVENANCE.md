# PROVENANCE — where this skill comes from

## Upstream

- **Source**: originally
  [`skills/baoyu-design`](https://github.com/JimLiu/baoyu-design/tree/main/skills/baoyu-design)
  from the repository [JimLiu/baoyu-design](https://github.com/JimLiu/baoyu-design) by 宝玉 (Jim Liu).
  **Upstream v2.3.0 (2026-10-30) archived the skill**: it now lives at
  [`archive/baoyu-design`](https://github.com/JimLiu/baoyu-design/tree/main/archive/baoyu-design)
  and is frozen there; upstream development moved to a new skill family
  (`claude-design`, `claude-slides`, `claude-design-system`, `claude-dashboard`,
  `claude-motion`, `dataviz`) built on prebuilt local editors. This fork does
  not follow that re-platforming.
- **Fork base commit**: `6530033592bf7fa58bc1a5a2a2ad278da45213a9` (2026-09-23, upstream v1.3.0)
- **License**: three layers, mirroring upstream's `NOTICE.md` (added upstream
  v2.4.1) —
  1. Jim Liu 宝玉's own work (MIT): the agent tooling in `agents/` (except
     vendored packages), plus upstream's local-agent prose.
  2. **Not MIT, rights stay with Anthropic, PBC**: `system-prompt.md`,
     `references/upstream-system-prompt.md`, `references/upstream-sync/`,
     `built-in-skills/` (Claude Design's built-in skills) and
     `starter-components/` (Claude Design's starter components) — material
     upstream includes so the skill works as it does on claude.ai; Anthropic
     has published no license for it. Exception:
     `built-in-skills/frontend-design.md` is Anthropic's frontend-design skill
     under **Apache License 2.0** (`built-in-skills/LICENSE-frontend-design.txt`).
  3. Vendored third-party code keeps its own licenses (React, ReactDOM, Babel,
     fflate, pptxgenjs — all MIT).
- **What it is here**: an academic retarget of a general-purpose HTML design
  skill. The design methodology (`system-prompt.md`), harness references,
  starter components, PPTX generation chain, and design-system machinery are
  upstream work; the academic layer and routing are ours.

## Kept (upstream, possibly edited)

| Piece | Notes |
|---|---|
| `system-prompt.md` | Edited: academic routing table, starter list, skills list; video/napkin/social sections removed. Craft text is upstream (Anthropic — not MIT, see Upstream). |
| `references/claude.md`, `cursor.md`, `codex.md` | Harness tool docs; `claude.md` edited to drop its video-export section (pipeline removed) |
| `references/upstream-system-prompt.md`, `references/upstream-sync/` | Untouched provenance/sync snapshot |
| Starters: `design-canvas.jsx`(+patch), `chart-stage.js`, `deck-stage.js`(+patch), `doc-page.js`, `image-slot.js`, `data-overlay.js`, `tweaks-panel.jsx` | Unchanged (`data-overlay.js` kept as the engine of `design-feedback.md`) |
| `agents/gen-pptx/` (incl. vendored pptxgenjs), `agents/build-preview.mjs`, `agents/lib/` (ds-core.mjs, import-design-system.mjs synced 2026-11 with upstream's path-containment fix #16), `agents/compile-design-system.mjs`, `agents/check-design-system.mjs`, `agents/record-asset.mjs`, checker/probe/verifier agent docs, `agents/vendor/` (babel, react, react-dom, fflate), `agents/tests/` | Upstream tooling (MIT). Local patch 2026-11: CJK East-Asian font fallback in gen-pptx (vendor Patch 3, see `agents/gen-pptx/vendor/pptxgenjs/VENDOR.md`). `import-figma.test.mjs` removed with the figma importer |
| built-in-skills (28 files + `LICENSE-frontend-design.txt`): ask-the-user, create-design-system, data-visualization, design-components, design-feedback, design-system-authoring-guide, design-system-preview, export-as-pptx-editable, export-as-pptx-screenshots, frontend-design (Apache 2.0), generate-images, hi-fi-design, import-from-github, import-from-html, interactive-prototype, low-level-tweaks-api, make-a-deck, make-a-doc, make-tweakable, maps-geography, options-stack, read-pdf, save-as-pdf, save-as-standalone-html, speaker-notes, tweaks-protocol, use-design-system, web-research, wireframe | Upstream docs (Anthropic — not MIT, see Upstream) |

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

Upstream evolves; this fork diverged on purpose. Upstream v2.3.0 archived the
skill, so the re-sync target is now the frozen `archive/baoyu-design/` tree
(plus, occasionally, fixes ported by hand from the new skill family, as was
the plan for the PPTX CJK font fallback). To pull in an upstream fix:

1. Clone upstream, diff `archive/baoyu-design` against commit `6530033…`
   (the fork base, where the skill lived under `skills/`).
2. For files in **Kept (upstream, possibly edited)**: copy the new version over.
3. For edited files (`system-prompt.md`): re-apply the upstream change, then
   re-check that no dropped-skill reference crept back in.
4. `references/upstream-sync/` in upstream carries its own sync metadata —
   copying it updates the snapshot without touching operative files.

### Sync log

- **2026-11 (post-v2.8.2 audit)**: ported upstream's design-system
  path-containment fix (#16 / commit `2b2c267`): `agents/import-design-system.mjs`,
  `agents/lib/ds-core.mjs` (+ their tests) — an untrusted design system can no
  longer read/copy files outside its folder via `../` specs, absolute paths or
  out-pointing symlinks. Added `built-in-skills/LICENSE-frontend-design.txt`
  and the `license:` line in `frontend-design.md`; rewrote the license section
  above per upstream's `NOTICE.md`. Upstream's `SKILL.md` trigger-narrowing
  (`a8004e7`) was **not** taken — our `SKILL.md` is a rewrite.
- **2026-11 (CJK PPTX fix)**: ported upstream's PowerPoint East-Asian font fix
  (#29 / v2.8.2 commit `3ac5c4e`, applied there only to claude-slides) onto our
  vendored gen-pptx: `eaFontFaceFor` in `agents/gen-pptx/src/core/fonts.ts`, an
  `eaFontFace` option through vendored pptxgenjs (vendor Patch 3), wired at the
  four `addText` sites in `src/render/render-node.ts`, tested by
  `agents/gen-pptx/test/cjk-ea-font.test.ts`. CJK runs now name Yu Gothic /
  Malgun Gothic / Microsoft JhengHei / Microsoft YaHei in PowerPoint's East-Asian
  slot instead of the Latin face, so Chinese/Japanese/Korean deck text can no
  longer render as boxes on machines without the deck's fonts.
- Out of scope for this fork, noted for the future: upstream's new skill family
  (local editors with human/agent co-editing, comments, LAN sharing — v2.0–v2.8)
  and its `dataviz` chart-design skill (chart-form heuristic, color rules,
  runnable palette validator). Migrating to that platform would be a separate
  project decision, not a re-sync.
