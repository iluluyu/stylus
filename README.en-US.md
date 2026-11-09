<div align="right">

English | [简体中文](README.md)

</div>

# stylus

**Academic writing, scientific figures, and presentations for AI coding agents** — packaged as [Agent Skills](https://agentskills.io/specification), designed for Claude Code, Codex, Zed, dsh, zcode, opencode, pi, and other compatible agent environments.

stylus helps researchers **write clearly, draw clearly, and present clearly**. Each skill installs and functions independently: writing guides carry no runtime dependencies, scientific plotting leverages Python and Typst, design canvases use a bundled native local editor, and presentation decks support HTML browsing and PPTX export.

## Skills

| Skill | Description | Best For |
|---|---|---|
| [math-writing](skills/math-writing/) | Mathematical writing standards: proof prose structure, equation grammar and punctuation, notation consistency, and four-C review criteria. | Drafting, revising, translating, or reviewing mathematical proofs, derivations, and LaTeX manuscripts. |
| [scientific-paper-writing](skills/scientific-paper-writing/) | Scientific paper writing: structure (Whitesides), sentence flow (Gopen & Swan), and phrasing (Manchester Phrasebank), featuring Fast and Learn modes. | Planning, drafting, restructuring, or polishing manuscripts for top-tier journals (PRL, Nature portfolio, PRX, etc.). |
| [scifig](skills/scifig/) | Publication-grade vector figures: Python (matplotlib) for data plots, Typst for schematics and multi-panel layouts, with automated linting to SVG/PDF/PNG. | Preparing journal-spec results plots, algorithm flowcharts, method overviews, and composite figures. |
| [design](skills/design/) | Native scientific canvas: based on claude-design (v2.12.1/7db9784), creating method overviews and mechanisms via `canvas.json` and `.dc.html` with a prebuilt local editor. | Collaboratively drafting paper Figure 1, architecture diagrams, mechanisms, and flowcharts. |
| [slides](skills/slides/) | Research presentations: narrative-driven 16:9 slide decks using HTML `deck-stage`, with local browser preview and export to PDF or editable PPTX. | Building lab meeting updates, conference talks, defense presentations, and lecture decks. |

## Installation

Clone the repository once, then link or copy the desired skills into your agent's skills directory:

```bash
git clone https://github.com/iluluyu/stylus.git
cd stylus
```

### 1. Symlink to Agents (Recommended)

Using the standard shared directory `~/.agents/skills/` (supported by Codex, Zed, dsh):

```bash
mkdir -p ~/.agents/skills
ln -s "$(pwd)/skills/math-writing"              ~/.agents/skills/
ln -s "$(pwd)/skills/scientific-paper-writing" ~/.agents/skills/
ln -s "$(pwd)/skills/scifig"                   ~/.agents/skills/
ln -s "$(pwd)/skills/design"                   ~/.agents/skills/
ln -s "$(pwd)/skills/slides"                   ~/.agents/skills/
```

### 2. Individual Skill Installation

To obtain a single skill without a full setup, copy directly or download via `npx degit`:

```bash
# Copy from a cloned repository
mkdir -p ~/.agents/skills
cp -r skills/math-writing ~/.agents/skills/

# Or fetch directly without cloning
mkdir -p ~/.agents/skills
npx degit iluluyu/stylus/skills/math-writing ~/.agents/skills/math-writing
```

### Common Agent Directories

| Agent | Skills Directory |
|---|---|
| Codex (OpenAI) / Zed / dsh | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |
| dsh (dedicated) | `~/.dsh/skills/` |
| zcode (Z.ai) | `~/.zcode/skills/` |
| opencode | `~/.config/opencode/skills/` |
| pi | `~/.pi/agent/skills/` |

## Dependencies & Quick Start

Each skill declares its own runtime requirements:

- **math-writing / scientific-paper-writing**: Pure Markdown workflows and reference checklists with no runtime dependencies. Directly ingested by compatible agents.
- **scifig**: Uses Python (for data plots via `matplotlib` and `numpy`) and Typst (for schematics and multi-panel composition); run check on an example figure:
  ```bash
  python skills/scifig/scripts/check.py skills/scifig/examples/fig_method.typ
  ```
  See [scifig SKILL.md](skills/scifig/SKILL.md) for full environment and font dependencies.
- **design**: Requires Node.js 20+. Bundles the complete precompiled editor; no `npm install` needed:
  ```bash
  node skills/design/scripts/artifact.mjs open skills/design/examples/research-canvas
  ```
- **slides**: Requires Node.js 22.18+. Preview a deck locally (open `http://127.0.0.1:4311/examples/research-deck/index.html`):
  ```bash
  node skills/slides/scripts/serve.mjs skills/slides 4311
  ```
  The PPTX export toolchain requires Chromium and Playwright. Install dependencies in the agent directory before first export:
  ```bash
  npm ci --prefix skills/slides/agents/gen-pptx
  npm exec --prefix skills/slides/agents/gen-pptx -- playwright install chromium
  npm run build --prefix skills/slides/agents/gen-pptx
  ```

## Sources & Credits

- **math-writing**: Adapted from John M. Lee's *Guidelines for Writing Proofs* (University of Washington) and the Academic writing four-C review criteria.
- **scientific-paper-writing**: Built on Gopen & Swan's *The Science of Scientific Writing*, Whitesides' *Whitesides' Group: Writing a Paper*, and the University of Manchester *Academic Phrasebank*.
- **design**: Built on `claude-design` from [baoyu-design v2.12.1](https://github.com/JimLiu/baoyu-design/tree/7db9784ac4f4974d78ab166c7db1c706c0481c3d), retaining the native canvas format, local editor, and scientific constraints.
- **slides**: Built on the HTML `deck-stage` component and standalone PPTX export toolchain, informed by `claude-slides` presentation guidance from the same release.

## License

Original content and integration tools are licensed under [MIT](LICENSE). Upstream components, editor snapshots, and third-party libraries retain their respective terms; see [design provenance](skills/design/PROVENANCE.md) and [slides provenance](skills/slides/PROVENANCE.md).
