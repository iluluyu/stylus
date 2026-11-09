# Provenance and licenses

## Lineage versus current source

- Original fork base: JimLiu/baoyu-design **v1.3.0**, commit
  `6530033592bf7fa58bc1a5a2a2ad278da45213a9` (2026-09-23).
  This is historical lineage, not the current runtime or guidance.
- Current adopted code and guidance: **v2.12.1**, commit
  [`7db9784ac4f4974d78ab166c7db1c706c0481c3d`](https://github.com/JimLiu/baoyu-design/tree/7db9784ac4f4974d78ab166c7db1c706c0481c3d),
  `skills/claude-design/`.
- The previous local implementation (`dbe3f67` and subsequent drafts) is not
  operative. Git retains the tracked local history; historical commit markers
  do not describe the active runtime.

**The native platform is now adopted**, not merely compared: canvas.json,
.dc.html Design Components, uploads, the complete precompiled local editor,
and its native exports. No plain-HTML entry point or second exporter remains.

## Byte-preserved upstream material

- `scripts/artifact.mjs`, `scripts/server.mjs`, and **all** of `scripts/editor/`
  are copied byte for byte. No replacement editor, canvas dialect or exporter.
- All of `artifact-type/reference/` is copied byte for byte. It is optional
  lookup, not a suite of mandatory nested skills. Format, diagrams and print
  are routed from SKILL.md; brand, design-system and web-app guidance is not
  required for a scientific schematic.
- Root upstream `NOTICE.md` is preserved in full as `NOTICE.md`;
  upstream `LICENSE` is preserved in full as `LICENSE.upstream`.
- `upstream-manifest.json` hashes the retained upstream files against the pin.
  `npm test` checks those hashes without requiring the audit checkout.

## Deliberate guidance changes only

`SKILL.md` is an abridgement of the current upstream skill, still named `design`.
It retains native create/revise paths, index shapes, exact support.js injection,
Design Component skeleton, upload/check/open/archive contracts and separate
HTML nodes/labels plus SVG connector conventions. No model is hard-coded.
Scientific additions are data honesty, method/mechanism/graphical-abstract/
flowchart scope, restrained white-background craft and export-verified mm/pt
requirements. The upstream prohibition on unsolicited visual verification is
replaced with proactive render → look → fix. Generic print type floors and
sheet defaults yield to actual scientific publication requirements. Native PDF
output tested here has a raster appearance with invisible selectable text, not
vector artwork; export resolution varied between runs. Measurements and limits
are in `references/export-validation.md`.

Mandatory design-system discovery, product/web-app styling, comments, LAN,
history and git-hook tutorials are omitted from the entry, **not removed from
the runtime**. The unmodified editor still contains its full capabilities.
`references/scientific.md` and `references/export-validation.md` document the
small scientific delta and measured limitations rather than changing grammar.

The old agents/DS tools, starter components, project-types.json, exporter and
unrelated tests were removed. Historical prompt snapshots were removed from
the runtime directory to avoid contradictory instructions and redundancy;
git retains the original tracked history. The old
`built-in-skills/academic-figures.md` is only a rule-free compatibility pointer
for the unchanged scifig skill. Slides' independent tools are not dependencies.

## Terms (mixed; not a package-wide MIT grant)

| Material | Terms |
|---|---|
| Upstream local Node tooling and local-agent additions | Jim Liu 宝玉, MIT; `LICENSE.upstream` |
| Adapted Artifact instructions, reference docs/font metadata, reconstructed editor and Anthropicons font | Anthropic, PBC; no published grant identified by upstream; **not MIT**; `NOTICE.md` |
| Editor's bundled open-source dependencies | Individual terms in the complete `scripts/editor/third-party-licenses.txt` |
| New local scientific prose, illustrative example and test code | iluluyu, MIT for these original additions only; `LICENSE` |
| Development npm dependencies | Their own package terms; not vendored into the runtime |

No Anthropic fonts, components or editor files are claimed as MIT. This is an
independent community adaptation, not affiliated with or endorsed by Anthropic.
The complete upstream NOTICE mentions other upstream packages not distributed
here; retaining it does not imply those files are part of this skill.

## Updating

Compare against the **current adopted pin**, not only v1.3.0. Copy runtime and
license files intact, refresh hashes from the actual source, rerun structure,
negative-format and browser round-trip/export tests. Record measured boundaries
and any scientific exceptions. Never remove bundled notices or silently swap
in a second runtime. Runtime needs Node 20+ only; npm/Chromium install is for
independent development verification, not ordinary canvas use.
