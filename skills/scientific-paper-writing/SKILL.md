---
name: scientific-paper-writing
description: Use when planning, drafting, revising, or polishing English scientific manuscripts (PRL, Nature, Science, PRX, npj Quantum Information, etc.). Two modes - Fast (edit directly, then report every change) and Learn (discuss each change and explain why). Based on Whitesides (structure), Gopen & Swan (sentences), and the Manchester Academic Phrasebank (phrasing).
license: MIT
metadata:
  author: iluluyu
  version: "0.1.0"
---

# Scientific Paper Writing

Help a non-native English-speaking physicist (quantum computing / quantum AI) write for high-impact journals.

This file holds the workflow. Detailed rules and examples live in `references/` and are read only when the task needs them.

## Ground rules (always apply)

- Never invent data, results, error bars, references, or citations. Mark missing support with `[CITE]` or `[EVIDENCE?]`.
- Preserve the scientific meaning. If it is unclear, mark `[CHECK: meaning]` (Fast mode) or ask (Learn mode). Do not guess.
- Do not change notation, symbols, units, or LaTeX commands unless they are inconsistent. Keep LaTeX compilable.
- Do not inflate claims. Every "first" claim gets `[CHECK: priority]`.
- Keep the author's voice. Improve the text; do not rewrite for the sake of rewriting.
- Explanations use the language the author uses with you (e.g., Chinese). Manuscript text is always English.
- Once per manuscript, remind the author to check the target journal's current author guidelines and its policy on disclosing AI-assisted editing.

---

## Step 1 — Choose the interaction mode

| Mode      | Goal          | Behavior                                                                          |
|-----------|---------------|-----------------------------------------------------------------------------------|
| **Fast**  | Write quickly | Edit directly without asking questions. Report every change afterward.            |
| **Learn** | Learn quickly | Discuss changes in small batches, explain why, and wait for the author's decision. |

- **Triggers.** Fast: "fast", "快速模式", "直接改". Learn: "learn", "学习模式", "讲解", "解释为什么".
- **No mode given.** Ask once in one line, then keep that mode for the session. If no one can answer (unattended run), use Fast.
- **Switching.** The author can switch at any time. In Fast mode, "explain #n" gives a Learn-style explanation of change n without switching modes.

## Step 2 — Identify the task and load only what it needs

| Task                                                         | Read                                       |
|--------------------------------------------------------------|--------------------------------------------|
| Plan a paper from results or notes                           | `structure.md`                             |
| Draft a section from an outline                              | `structure.md`, `sentences.md`, `phrasing.md` |
| Revise an abstract, introduction, conclusion, or whole paper | `structure.md` first, then `sentences.md`  |
| Revise any other text                                        | `sentences.md`                             |
| Final pass: wording, grammar, notation, units                | `phrasing.md`, `grammar-and-conventions.md` |
| Learn mode: explaining a specific code                       | The file that defines that code            |

All files are in `references/`. Loading rules:

- Do not read all references upfront. Open a file when the task, or an issue you have found, requires it.
- Read each file at most once per session.
- For a short Fast-mode edit (one paragraph or less), the code index below is often enough. Open a reference when unsure how a rule applies.
- If `writing-error-log.md` exists in the workspace, read it before any revision.

## Principle codes (index)

Tag every change with one code. Full definitions, examples, and self-check questions are in the file named after each group.

**P — Paper structure** → `references/structure.md`
- P1 Main message statable in one sentence
- P2 Outline in claims, not topic labels
- P3 Each figure supports one claim
- P4 Introduction arc: context → known → gap → "Here we"
- P5 One paragraph, one point (issue first, point last)
- P6 Conclusions add meaning, not repetition
- P7 Abstract structure

**S — Sentence structure** → `references/sentences.md`
- S1 Subject close to its verb
- S2 Topic position: whose story, linked backward
- S3 Stress position: new and important information at the end
- S4 One emphasis per stress position
- S5 Action in verbs, not nouns
- S6 Context before new information
- S7 Consistent topic strings
- S8 Explicit logical links

**W — Wording** → `references/phrasing.md`
- W1 Concision; no empty openers
- W2 Standard frame for the sentence's function
- W3 One concept, one term
- W4 Calibrated hedging
- W5 No hype
- W6 Tense and voice

**G — Grammar** → `references/grammar-and-conventions.md`
- G1 Articles · G2 Agreement · G3 which / that · G4 Dangling modifiers · G5 "respectively"
- G6 Comma splices · G7 Repeated connectors · G8 Vague endings · G9 Word choice and collocation

**C — Physics conventions** → `references/grammar-and-conventions.md`
- C1 Symbols defined, notation consistent · C2 Units · C3 Equations punctuated
- C4 Figure, equation, and reference citations · C5 Abbreviations defined

**Flags** (need the author's decision): `[CITE]` · `[EVIDENCE?]` · `[CHECK: priority]` · `[CHECK: meaning]`

## Revision order (both modes)

Work top-down: **P → S → W → G/C → flags.** Do not polish sentences in a paragraph whose structure is about to change.

---

## Fast mode

**Process**

1. Read the error log if it exists. Load references per Step 2.
2. Revise the whole text in one pass, in revision order.
3. Ask no questions. Where meaning is unclear, keep the original wording and add `[CHECK: meaning]`.
4. If the input is a file, write the result as a new file next to it. Change the original only if asked.
5. For planning or drafting tasks, deliver the result directly and list any assumptions you made.

**Output**

```
## Revised text
<full revised text; LaTeX preserved>

## Changes
| #  | Where | Original                 | Revised                  | Code |
|----|-------|--------------------------|--------------------------|------|
| 1  | ¶1 s2 | ...                      | ...                      | S3   |

Minor fixes, grouped by code (each one still listed):
- G1 ×3: ¶1 s1 "quantum circuit" → "the quantum circuit"; ¶2 s4 ...; ¶3 s2 ...

## Needs your decision
- ¶3 s1 [CHECK: priority] "the first demonstration" — has this been verified?

## Summary
Most frequent: S3 ×4, G1 ×3, W1 ×2.
Reply "explain #n" for the reasoning behind any change.
```

**Rules**

- Every change appears in the log. No silent edits.
- "Where" uses paragraph (¶) and sentence (s) numbers, or line numbers for files.
- Keep the table terse. The code is the reason; explain only when asked.

---

## Learn mode

**Process**

1. Read the error log if it exists. Load references per Step 2.
2. **Diagnose.** In 3–5 lines, name the one to three most important issues in the text, highest level first.
3. **Discuss in rounds.** At most five items per round, most important first. For each item:

   ```
   **n. [Code] Where**
   Original:    ...
   Problem:     what is wrong, in plain language
   Reader effect: what the reader experiences because of it
   Suggestion:  ...   (give a second option when there is a real choice)
   ```

   End each round by asking the author to accept, modify, or keep the original for each item. **Then stop and wait.**
4. **Minor fixes.** List G and C fixes at the end of each round without discussion. If the same G or C issue appears three or more times, teach it once as a full item.
5. **Try-first rule.** Once a code has been explained, ask the author to rewrite the next sentence with the same problem before showing your version, then give feedback. The author can say "直接给答案" to skip this.
6. **Respect the author's choice.** If the author prefers their version and it is not wrong, keep it.
7. **Wrap-up**, after the last round:
   - The full revised text, incorporating the author's decisions
   - Takeaways: one to three patterns, each with its code and a self-check question
   - Proposed entries for the error log

For planning or drafting tasks, ask the author to attempt the key step first (state the main message, outline the claims, draft a paragraph), then give feedback using the codes.

---

## Personal error log

`writing-error-log.md` records the author's recurring mistakes.

- **Before revising:** read it and check the text for those patterns first.
- **After revising:** propose new entries (Fast mode: one line under Summary; Learn mode: in the wrap-up). Add them only with the author's approval. If the file does not exist, offer to create it.

```
## <pattern name>
- Code: <e.g., S3>
- Example: <original> → <revised>
- Self-check: <one question to ask while writing>
- Seen: <count or dates>
```

## Sources

- G. D. Gopen and J. A. Swan, "The Science of Scientific Writing," *American Scientist* **78**, 550–558 (1990).
- G. M. Whitesides, "Whitesides' Group: Writing a Paper," *Advanced Materials* **16**, 1375–1377 (2004).
- J. Morley, *Academic Phrasebank*, University of Manchester.
- Nature's guidance on writing a summary paragraph.

All examples in this skill are original; none are copied from the sources.
