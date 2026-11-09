# Provenance and licensing

## Lineage

This skill splits the slide-specific material out of Stylus's former
`skills/design`. That fork identifies its upstream base as
[JimLiu/baoyu-design](https://github.com/JimLiu/baoyu-design), commit
`6530033592bf7fa58bc1a5a2a2ad278da45213a9` (2026-09-23, v1.3.0),
then at `skills/baoyu-design`. This is a **lineage base**, not a claim that
every current tool file is byte-identical to that commit. Upstream later
archived the old skill under `archive/baoyu-design`.

The migrated toolchain comes from local commit `dbe3f67`; the fork-base
version records ancestry, not the current guidance version. The entry and
short references were reviewed against **baoyu-design v2.12.1**, commit
[`7db9784ac4f4974d78ab166c7db1c706c0481c3d`](https://github.com/JimLiu/baoyu-design/tree/7db9784ac4f4974d78ab166c7db1c706c0481c3d),
especially its active `claude-slides` skill and craft, font, and format references.
They are concise local formulations, not a bulk copy of the upstream prompts.

The actual working-tree `agents/gen-pptx`, `starter-components/deck-stage.js`,
and `deck-stage-patch.md` were **moved**, not replaced from the baseline.
Existing local `node_modules` and `dist` were preserved but are ignored, not
part of the distributable source.

## Latest guidance adopted

| Source in `claude-slides` at v2.12.1 | Local adaptation |
| --- | --- |
| `reference/craft.md` | Share the title sequence, build in order, keep a small type scale, and budget space rather than shrinking text |
| `SKILL.md`: revising a deck | Reread current pages and preserve everything outside the requested revision |
| `reference/fonts.md` | Choose fonts for the brief, check weights and scientific/CJK glyphs, and disclose substitutions |
| Current format/export guidance | State actual editability, static content, and checks not performed; keep notes share-safe |

The portable `deck-stage` format and local PPTX package remain the runtime;
this is not a mirror of the new `claude-slides` editor. Its `deck.json` protocol,
mandatory asset uploads, ban on unrequested visual checks, and platform-specific
`px = pt × 2` mapping are not adopted. Here CSS uses 96 px/in and 72 pt/in;
exports and font behavior are verified against this toolchain. Complex-equation
source preservation is a scientific adaptation, not an upstream feature claim.

## Mixed terms — not all MIT

| Material | Rights / license |
| --- | --- |
| Stylus additions: SKILL.md, new references, example, helper scripts, and tests | MIT; [local notice](LICENSE) |
| Jim Liu 宝玉's original gen-pptx agent tooling | MIT; [tool notice](agents/gen-pptx/LICENSE), [package notices](agents/gen-pptx/NOTICE.md) |
| Anthropic Claude Design starter material: deck-stage.js and upstream portions described in its patch ledger | Rights remain with **Anthropic, PBC**. No license was published for this material; **not MIT**. Included with its existing provenance; no new redistribution rights are asserted. |
| Vendored PptxGenJS (3.13.0-beta.1 source) | MIT; [license](agents/gen-pptx/vendor/pptxgenjs/LICENSE), [patch ledger](agents/gen-pptx/vendor/pptxgenjs/VENDOR.md) |
| npm dependencies and vendored browser libraries | Their own notices/licenses; not relicensed by this skill |

The original standalone tooling folder lacked Jim Liu's license text; the
notice here is restored from
[upstream main LICENSE](https://github.com/JimLiu/baoyu-design/blob/main/LICENSE),
not claimed to be the exact file at the fork-base commit.
The old repository-level MIT scope note must not be read as licensing the
Anthropic starter after relocation. Preserve this file when copying the skill.
Review rights before redistributing the starter; functionality does not imply
a license grant.

## Preserved patches and tests

- Entire gen-pptx source, vendor source, lockfile, build wiring, and original
  seven TypeScript unit-test files were migrated.
- PptxGenJS animation timing hooks and their vendor tests remain intact.
- CJK patch retained: `eaFontFaceFor`, all four renderer call sites, vendor
  `eaFontFace` serialization, and `test/cjk-ea-font.test.ts`.
  The previous provenance records its source as upstream #29 / v2.8.2,
  commit `3ac5c4e`, ported in 2026-11.
- The stage's animation Patch 3 is present. Fullscreen Patches 1–2 were only
  in the inherited ledger, not in the runtime; this migration makes that
  status explicit rather than claiming those features work.
- New local exporter fixes: screenshot capture sets stage base state and
  hides shadow chrome; CLI awaits browser cleanup instead of exiting before
  its finally block. Print refreshes the last-visible marker for dynamically
  skipped trailing slides even when the rail observer is disabled.
- Local comment paths now point inside this skill, with the unsupported host
  editor boundary documented. No other design assets or installation are needed.

## New validation material

The three-slide offline research example is original, deliberately hypothetical
and visibly labeled. It makes no empirical or citation claims. Its one optional
click build exercises the preserved runtime/export animation contract.
Node contracts check local references and configs; browser smoke checks scaling,
navigation, print pages, notes, static capture, CJK slots, and editable PPTX XML.
Independent installation copies this directory without caches/build output and
reinstalls only its own toolchain.
