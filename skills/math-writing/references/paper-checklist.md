# Paper Review Checklist

The four C's of academic writing and pre-submission checklists for a finished
manuscript. Adapted from "Academic writing" review slides (math/physics
context; LaTeX typesetting).

**Load this file when**: reviewing, polishing, or QA-passing a finished draft
(paper, thesis, notes) before submission — not for drafting text from
scratch (use `proof-writing.md` for that).

Work through the checklists in order: General → Math → Figures & References →
LaTeX. Anything unchecked becomes an action item.

## The Four C's — the evaluation frame

Judge every piece of writing against four properties:

| Property | What it covers |
|---|---|
| **Correct** | Grammar, computation, and proofs contain no errors |
| **Clear** | Motivation, presentation, terminology, assumptions, and conclusions are all visible |
| **Consistent** | Terminology and notation stay the same throughout; conventional notation for the field; same font for the same object |
| **Concise** | Presentation, computation, and proof carry no excess; detail is calibrated to the reader's assumed background |

Notes on each:

- **Correct** covers grammar (typos, singular vs plural, restrictive vs
  non-restrictive relative clauses, articles, paragraphing, punctuation) and
  the technical content (computation, proof).
- **Clear** requires: explicit motivation and presentation; terminology and
  notation defined before use; assumptions stated; conclusions stated; font
  and figure sizes readable.
- **Consistent** requires: one term/notation per concept throughout the
  paper; conventional notation of the field; the same font for the same
  notation; consistent presentation.
- **Concise** requires: trimming presentation, computation, and proofs to
  what the assumed reader needs. State the assumption about reader knowledge
  explicitly (e.g. undergraduate math and physics; advanced linear algebra
  and quantum information; basic group and representation theory; basic
  graph theory and combinatorics).

## Checklist 1: General

- [ ] Clear motivation, presentation, and logical relation between parts
- [ ] New results clearly distinguished from previously known results
- [ ] Active voice preferred over passive voice
- [ ] No ambiguity
- [ ] Grammar and typos checked
- [ ] Suitable paragraphing
- [ ] Suitable punctuation — in both text and equations
- [ ] All terminology and notation well defined (before first use)
- [ ] Abbreviations spelled out in full at first use
- [ ] No abbreviation at the beginning of a sentence

## Checklist 2: Math

- [ ] Same font used for the same notation throughout
- [ ] Math functions typeset with correct operator fonts (`\sin`, `\cos`, `\exp`)
- [ ] Abbreviations of words set in regular (upright) script, not italic
      (e.g. $\mathrm{rank}$, $\mathrm{tr}$, $\mathrm{span}$)
- [ ] Suitable spacing between symbols, including delimiters
- [ ] Different expressions within one equation separated by `\quad`
- [ ] Long or complicated formulas displayed, not left in running text
- [ ] Parentheses, brackets, and braces chosen and sized appropriately
      (`\left…\right`, `\bigl…\bigr`, …)
- [ ] No displayed equation overflows the page margin
- [ ] Equation numbers placed consistently, and only where referenced
- [ ] Assumptions and conclusions stated clearly inside lemmas and theorems
- [ ] Long proofs divided into smaller pieces (lemmas, cases, steps)

## Checklist 3: Figures and References

- [ ] Suitable font and figure size (readable at print scale)
- [ ] Clear legend and caption for every figure
- [ ] Curves distinguishable even in black and white (line styles/markers,
      not only color)
- [ ] References sufficient and appropriate for the claims made
- [ ] Reference format unified: complete bibliographic information,
      consistent capitalization of names, standard abbreviations ("IEEE")
      capitalized correctly
- [ ] arXiv references updated to published versions where available

## Checklist 4: LaTeX

- [ ] Suitable document class and packages loaded (e.g. `mleftright` for
      auto-sized delimiters)
- [ ] Commands simple and unified; macros defined for repeated constructs
- [ ] Suitable typesetting (spacing) and alignment
- [ ] Informative citation keys (readable in the source, e.g. `Lee2018proofs`)
- [ ] Different label types distinguished: `eq:…`, `lem:…`, `thm:…`, `sec:…`
- [ ] Compile log checked for unexpected `?` (undefined references), errors,
      and warnings — all resolved

## Review output format

When reviewing a draft, report findings grouped by the four C's, each item
with location and suggested fix:

```markdown
## Correct
- §3.2, eq. (14): sign error in the second term — should be −γ, not +γ

## Clear
- §1: motivation appears only in the abstract; add one paragraph after the
  introduction stating why the problem matters

## Consistent
- §2 uses H for Hamiltonian, §4 uses 𝐻 and ℋ — pick one

## Concise
- §5.1: the three-case analysis can be collapsed; cases 2 and 3 are
  symmetric
```
