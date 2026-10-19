# Proof Writing Guidelines

Rules for writing mathematical proofs in English prose. Adapted from John M.
Lee's "Guidelines for Writing Proofs" (Math 300, Univ. of Washington).

**Load this file when**: drafting or rewriting a proof, writing theorem
statements, deciding how much detail to include, or writing formulas inside
prose.

Every rule here admits exceptions in the hands of experienced writers — but a
writer following these rules carefully will rarely go wrong.

## Table of Contents

1. [General principles](#1-general-principles)
2. [Proof structure](#2-proof-structure)
3. [Precision: the two questions](#3-precision-the-two-questions)
4. [Detail and exposition](#4-detail-and-exposition)
5. [Formulas in prose](#5-formulas-in-prose)
6. [Symbols and logical notation](#6-symbols-and-logical-notation)
7. [Chained relations](#7-chained-relations)

## 1. General principles

- **Identify the audience.** Before writing, know what the reader already
  knows. For a course, write as if convincing a fellow student: same
  background, but hasn't seen *this* proof. For publication, write for the
  journal's intended audience.
- **Write in paragraph form.** A proof communicates to a human reader. Prose
  narrative beats terse symbolic statements and two-column formats. If the
  proof was constructed symbolically, convert it to complete sentences
  organized into paragraphs when writing it up.
- **Use proper English.** Mathematical writing follows all ordinary rules of
  grammar, usage, punctuation, and spelling. Period at the end of every
  sentence; no sentence fragments, run-ons, or dangling modifiers; correct
  subject–verb agreement and parallel structure.
- **Write clearly.** Don't be stingy with intuition. For any argument longer
  than a few sentences: say informally what you will do and why, do it, then
  remind the reader what was done. If the proof is anything other than a
  simple direct proof, announce the type ("We will prove the contrapositive,"
  "We will prove this by induction").
- **Include motivation.** For nontrivial or unexpected results, explain how
  one might have been led to the ideas, why the theorem should be believed,
  why the proof is structured as it is, or how the result will be used.
  Place motivation before the theorem, at the start of the proof, or at
  transition points.
- **Use "I" sparingly.** Standard practice is "we", interpreted as "the writer
  and the reader": "We will prove the theorem by induction on $n$." If truly
  referring to yourself alone, "I" is fine ("I learned this technique from…").
- **Avoid most abbreviations.** Never use "s.t.", "w.r.t.", "w.l.o.g." in
  written exposition — reserve them for the blackboard. "i.e." and "e.g." are
  acceptable in formal writing (if used correctly). Treat "iff" as a
  blackboard-only abbreviation too; write "if and only if".
- **Proofread.** Read the finished text from beginning to end. Waiting a
  while, or getting someone else to read it, makes proofreading far more
  effective.

## 2. Proof structure

- **State what you are proving.** Precede every proof with a precise English
  statement of the result. Even for homework, rephrase the problem as a
  theorem statement instead of copying the prompt:

  > Prompt: *Prove that if x is a real number, then x² ≥ 0.*
  > Better opening: **Theorem.** *If $x$ is a real number, then $x^2 \ge 0$.*

- **Label your theorems.** Every stated result gets an identifying tag. The
  tag tells the reader the result's role:
  - **Theorem** — the main event, important in its own right.
  - **Proposition** — interesting in its own right, but less central than a
    theorem.
  - **Lemma** — not necessarily interesting alone, but useful for proving a
    theorem.
  - **Corollary** — follows easily from a theorem, usually the preceding one.

  In typeset text, set the label in boldface and the statement in italics.

- **Mark where proofs begin and end.** Start with the word "Proof"; end with
  a distinctive symbol (∎ or □). "QED" is going out of style.

## 3. Precision: the two questions

For every mathematical statement you write, ask:

### What does it mean?

Every term must be well defined and used according to its definition; every
symbol must be previously defined or appropriately quantified. If you write
"$f(a) > 0$" — is that for **every** $a \in \mathbb{R}$, for **some** $a$, or
for a **particular** $a$ introduced earlier? Make the meaning of each term
and symbol clear before, or at latest within, the sentence of first use.

### Why is it true?

Every statement in a proof must be justified in one of six ways:

1. by an **axiom**;
2. by a **previously proved theorem**;
3. by a **definition**;
4. by a **hypothesis** (including an inductive hypothesis or an assumption
   for contradiction);
5. by a **previous step** in the current proof;
6. by the **rules of logic**.

Sometimes cite the reason directly ("We conclude $AB = AC$ by Theorem 3");
sometimes it is obvious enough to leave out (see below).

## 4. Detail and exposition

- **Include more than just the logic.** A sequence of precise but unexplained
  statements is incomprehensible. Intersperse long formula runs with words
  saying why each step follows or what is being done. Written mathematics is
  never easy to absorb — minimize the reader's work.
- **Include the right amount of detail.** If you think you know roughly how
  an argument goes but haven't worked through it — work through it first.
  Only then can you judge what to omit. Include just enough to give the
  reader the "Aha!" that makes the rest obvious. When unsure what a proof
  should look like, study proofs in a textbook you find readable and emulate
  them.
- **Distinguish formal from informal passages.** Formal parts carry
  definitions, logical steps, justifications; informal parts carry motivation
  and sketches. Keep the boundary easy for the reader to see.

## 5. Formulas in prose

Formulas are indispensable but must be used judiciously. Two placement modes:

- **In-line**: single symbols and short formulas, inside the sentence —
  "If $x$ is a real number, then $x^2 \ge 0$."
- **Displayed**: large or especially important formulas, centered on their
  own line. A formula needs a number only if you will refer to it later, and
  only displayed formulas can be numbered.

### Formulas are grammatical objects

Every formula is part of a sentence — never a standalone sentence. It plays
one of two roles:

1. an expression denoting a mathematical object → functions as a **noun**;
2. a complete symbolic statement → functions as a **clause**.

> "If $x > 2$, we see that $x^2 + x$ must be greater than 6."
> — "$x > 2$" is a clause (its verb is ">"); "$x^2 + x$" and "6" are nouns.

**Test: read the sentence aloud.** Symbols have several readings ("=" can be
"equals", "is equal to", "be equal to"…) — if the spoken version parses as a
sentence, the written one is grammatical.

### Punctuation

- If a displayed formula ends a sentence, **it must be followed by a
  period.** (Yes, really.) Likewise any comma, semicolon, etc. that would
  appear if the formula were in-line must appear at the end of the display.
  Punctuation guides the reader: a period says "a thought is complete,
  absorb it"; a comma says "more is coming".
- **Do not begin a sentence with a symbol** — it hides the sentence
  boundary. Rewrite: "ℓ and m are parallel lines" → "The lines $\ell$ and
  $m$ are parallel." (Bulleted short statements may begin with symbols when
  clearer.)
- **Do not put two formulas side by side separated only by punctuation** —
  they read as one long formula. "If $x \ne 0$, $x^2 > 0$" → "If $x \ne 0$,
  then $x^2 > 0$."

## 6. Symbols and logical notation

- **Relation and operator symbols ($=, >, \in, \subseteq, +, -, \cap$)
  connect formulas only — never words.**

  > If $x$ is a real number that is $> 2$, then $x^2 + x$ must be $> 6$. **(BAD)**
  > If $x$ is a real number such that $x > 2$, then $x^2 + x > 6$. **(GOOD)**
  > If $x$ is a real number greater than 2, then $x^2 + x$ must be greater
  > than 6. **(GOOD)**

- **Logical symbols ($\exists, \forall, \wedge, \vee, \neg, \Rightarrow$,
  $\Leftrightarrow$) never replace the corresponding English words.** Outside
  formal logic itself, write statements out in English.

  Exception: $\Rightarrow$ and $\Leftrightarrow$ are acceptable connecting
  *complete symbolic statements* or statement labels:

  > The fact that $x$ is nonzero $\Rightarrow$ $x^2$ is positive. **(BAD)**
  > We will prove $(a) \Leftrightarrow (b)$ by first showing $(a) \Rightarrow (b)$. **(GOOD)**
  > Therefore $x \ne 0 \Rightarrow x^2 > 0$. **(GOOD)**

- **Built-up expressions** (sums, integrals, matrices, fractions): display
  them, or write them so they fit the line without stretching line spacing.
  An in-line fraction uses a slash: "$x/(y+2)$". A fraction needing a
  horizontal bar must be displayed. Small numerical fractions like
  $\tfrac{1}{2}$ may stay in-line.

## 7. Chained relations

A chain like $a = b = c = d$ asserts each pairwise relation *in the order
shown* and transitively yields $a = d$. Therefore:

- Only chain relations when the steps are provable **in that order**.
- Transitive relations ($=, <, \le, >, \ge$) may be mixed when transitivity
  holds: $a \le b = c < d$ is fine.
- Never chain non-transitive pairs: $a \le b \ge c$ and anything with $\ne$
  is not acceptable.
- In displayed equations, align the relation operators vertically:

$$
\begin{aligned}
(x+y)(x-y) &= x^2 - xy + yx - y^2 \\
           &= x^2 - y^2 \\
           &\le x^2.
\end{aligned}
$$
