---
name: math-writing
description: "Standards for mathematical and academic writing in English — proof-writing conventions, formula grammar and punctuation, notation consistency, and paper-polishing checklists. Use this skill whenever the user writes, edits, translates, or reviews mathematical text such as proofs, theorem statements, derivations, or LaTeX paper drafts. Trigger on requests like 'polish this proof', 'review my paper', 'check my notation', 'help me write this theorem', 数学写作规范, 帮我改证明, 论文润色 — even when the user does not explicitly say 'math writing'. Also use when deciding formula punctuation, symbol vs word usage, abbreviation conventions, or how much detail a proof needs."
license: MIT
metadata:
  author: iluluyu
  version: "0.1.0"
---

# Mathematical Writing Standards

Two sources of authority, covering the two phases of writing:

1. **Drafting** (writing proofs and prose from scratch) → read
   [`references/proof-writing.md`](references/proof-writing.md)
2. **Reviewing** (polishing a finished draft before submission) → read
   [`references/paper-checklist.md`](references/paper-checklist.md)

If the task spans both phases — e.g. editing one paragraph of a proof —
read `proof-writing.md` first; it governs sentence-level choices. Load
`paper-checklist.md` as well whenever you must *report* a review, whatever
the object's size — the four-C frame and the review output format live
there. Checklists that cannot apply to the object (figures, references,
compile log for a passage) are skipped silently.

## The evaluation frame: four C's

Judge any mathematical text against these four properties. They are the
shared vocabulary for explaining *why* something is wrong:

- **Correct** — grammar, computation, and proof are free of errors
- **Clear** — motivation, definitions, assumptions, and conclusions are all
  visible to the intended reader
- **Consistent** — one notation per concept, conventions of the field, same
  font for the same object throughout
- **Concise** — no excess presentation, computation, or detail beyond what
  the assumed reader needs

## Always-on rules

These apply to any mathematical prose, drafting or reviewing. (Full detail
and examples in `proof-writing.md`.)

- Proofs are English prose in paragraphs — complete sentences, correct
  grammar, no naked symbol strings.
- Define every term and symbol before (or at latest within the sentence of)
  first use; make quantifiers explicit.
- Every formula plays a grammatical role — noun or clause — inside its
  sentence. Read aloud to check.
- Displayed formulas take sentence-ending punctuation (periods, commas).
- Never begin a sentence with a symbol; never separate two in-line formulas
  with only a comma.
- Relation symbols connect formulas, not words ("greater than 2", not "> 2",
  in prose); logical symbols (∀, ∃, ⇒) never replace English words.
- No "s.t.", "w.r.t.", "w.l.o.g.", "iff" in formal text; prefer "we" over
  "I"; spell out abbreviations at first use.
- Label results (Theorem/Lemma/Proposition/Corollary) with the label
  matched to the result's role; begin proofs with "Proof", end with ∎.
- Justify every proof step by one of: axiom, prior theorem, definition,
  hypothesis, earlier step, or logic.
- Prefer active voice; state proof type when not a simple direct proof.

## Workflow

**Drafting a proof:**
1. Ask (or infer) who the reader is — this sets the detail level.
2. Write the theorem statement first, as a labeled, self-contained sentence.
3. Draft in prose with the always-on rules; interleave formulas with
   explanations of why steps follow.
4. Proofread end-to-end.

When reporting a review:

- Locate findings by section/eq. number when the document has them; for an
  unnumbered passage, quote the offending phrase or number the sentences.
- A finding that fits several C's is listed once, under the most
  fundamental cause, in the priority order Correct > Clear > Consistent >
  Concise (a sign error is Correct even though it also hurts Clear).

**Reviewing a paper:** follow the four checklists in
`paper-checklist.md` (General → Math → Figures & References → LaTeX) and
report findings grouped by the four C's with locations and fixes, using the
output format defined there.
