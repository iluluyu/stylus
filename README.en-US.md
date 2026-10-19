<div align="right">

English | [简体中文](README.md)

</div>

# stylus

**Academic-writing skills for AI coding agents** — packaged as
[Agent Skills](https://agentskills.io/specification) that load in any
skills-compatible agent: Claude Code, Codex, dsh, zcode, Zed, opencode, pi,
and more.

stylus (Latin for "pen") does one thing: **help researchers write academic
English well.** Each skill is a self-contained Markdown folder — a `SKILL.md`
carrying the workflow and core rules, plus `references/` loaded only when a
task needs them. The writing skills are pure Markdown with zero dependencies;
`scifig` ships a Python / Node toolkit with automatic lint, invoked on demand.
No build step, no vendor lock-in.

## Skills

| Skill | What it does | Use it when |
|---|---|---|
| [math-writing](skills/math-writing/) | Mathematical writing standards: proofs as prose, formula grammar and punctuation, notation consistency, the four-C review frame | You write, edit, translate, or review proofs, theorems, derivations, or LaTeX drafts |
| [scientific-paper-writing](skills/scientific-paper-writing/) | Scientific manuscript writing: structure (Whitesides), sentences (Gopen & Swan), phrasing (Manchester Phrasebank), with Fast / Learn modes | You plan, draft, revise, or polish English manuscripts (PRL, Nature, PRX, …) |
| [scifig](skills/scifig/) | Publication-grade figures as **editable vector SVG + PDF**: algorithm & optimization plots (convergence curves, performance profiles, loss landscapes, Pareto fronts, CD diagrams, ablations…), method schematics / flowcharts (JS), multi-panel assembly, automatic lint + rendered previews for self-critique | You make any paper figure, results plot, method overview or algorithm diagram, or want any plot turned "Nature-style" |

The skills are complementary: `math-writing` governs how mathematical text is
written correctly; `scientific-paper-writing` governs how the whole paper is
written well; `scifig` governs how its figures look publishable.

## Installation

This repository is a collection. Clone it once, then link (or copy) the
skills you want into your agent's skills directory:

```bash
git clone https://github.com/iluluyu/stylus.git
```

### One clone, many agents

Codex, Zed, and dsh all read the shared directory `~/.agents/skills/`, so a
set of symlinks serves several tools at once:

```bash
ln -s /path/to/stylus/skills/math-writing              ~/.agents/skills/math-writing
ln -s /path/to/stylus/skills/scientific-paper-writing ~/.agents/skills/scientific-paper-writing
ln -s /path/to/stylus/skills/scifig                   ~/.agents/skills/scifig
```

### Per-agent directories

If your agent uses its own skills directory, link there instead:

| Agent | Skills directory |
|---|---|
| Codex (OpenAI) | `~/.agents/skills/` |
| Zed | `~/.agents/skills/` |
| dsh (DeepSeek) | `~/.dsh/skills/` (also reads `~/.agents/skills/`) |
| zcode (Z.ai) | `~/.zcode/skills/` |
| Claude Code | `~/.claude/skills/` |
| opencode | `~/.config/opencode/skills/` |
| pi | `~/.pi/agent/skills/` |

Update later with `git pull` inside the stylus clone; the symlinks follow
automatically.

### Just one skill, no full clone

Pull a single skill folder without cloning the repository:

```bash
npx degit iluluyu/stylus/skills/math-writing math-writing
```

### Chat clients (Claude.ai and similar)

Zip the `skills/<name>/` folder and upload it as-is. The
[spec](https://agentskills.io/specification) requires the folder name to
match the skill's `name`: the top level of the zip must be the skill's own
folder (`math-writing/`, `scifig/`, …) — not `stylus-main/`.

## Repository layout

```
stylus/
├── README.md / README.en-US.md    # bilingual docs (Chinese by default)
├── LICENSE                        # MIT
└── skills/
    ├── math-writing/
    │   ├── SKILL.md               # core rules + routing (always loaded on trigger)
    │   └── references/
    │       ├── proof-writing.md       # drafting: proof-writing conventions
    │       └── paper-checklist.md     # reviewing: four C's + QA checklists
    ├── scientific-paper-writing/
    │   ├── SKILL.md               # workflow: modes + principle-code index
    │   └── references/
    │       ├── structure.md               # P codes: paper structure
    │       ├── sentences.md               # S codes: sentence structure
    │       ├── phrasing.md                # W codes: wording
    │       └── grammar-and-conventions.md # G/C codes: grammar & physics conventions
    └── scifig/
        ├── SKILL.md               # figure workflow: brief → chart choice → render-look-fix loop
        ├── scripts/               # Python package scifig + JS diagram library sfd.mjs
        ├── assets/                # matplotlib style (Nature-grade typography)
        ├── examples/              # minimal runnable examples + rendered gallery
        └── references/            # chart catalog / color / journal specs / composition / critique checklist
```

Skill content is written in English (the output being written is English),
but trigger phrases work in both languages — e.g. 论文润色, 帮我改证明,
快速模式.

## Sources and credits

The skills adapt ideas from the following public materials, which remain
the property of their authors:

- **math-writing** — John M. Lee, *Guidelines for Writing Proofs*
  (Math 300 handout, University of Washington, Autumn 2018); "Academic
  writing" review slides (four C's + checklists).
- **scientific-paper-writing** — G. D. Gopen & J. A. Swan, "The Science of
  Scientific Writing" (*American Scientist* **78**, 1990); G. M. Whitesides,
  "Whitesides' Group: Writing a Paper" (*Advanced Materials* **16**, 2004);
  University of Manchester *Academic Phrasebank*.

All examples in the skills are original; none are copied from the sources.

## License

[MIT](LICENSE)

## Keywords

academic writing · mathematical writing · paper polishing · scientific
writing · scientific figures · LaTeX · Agent Skills ·
