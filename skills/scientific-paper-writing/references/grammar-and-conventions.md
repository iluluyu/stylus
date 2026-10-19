# Grammar and Physics Conventions — codes G1–G9, C1–C5

These are usually minor fixes. In Fast mode, list them grouped by code. In Learn mode, list them without discussion, unless the same issue appears three or more times; then teach it once as a full item.

---

## Grammar (common issues for non-native writers)

### G1 — Articles (a / an / the / none)

- A singular countable noun needs an article: *we prepare ~~quantum state~~* → *we prepare a quantum state*.
- **the**: something specific, already mentioned, or unique (*the ground state*, *the Hamiltonian in Eq. (1)*, *the device used here*).
- **a / an**: one of many, or first mention (*a Hamiltonian of the form ...*, *an ancilla qubit*).
- **No article**: general plurals and uncountable nouns used generally (*Qubits decohere ...*, *Entanglement is a resource ...*, *quantum computing*).
- Self-check: *Is this noun singular and countable? Then it needs "a" or "the".*

### G2 — Agreement

- Subject and verb must agree, even when separated (see S1).
- *The number of qubits **is** ...*; *a number of qubits **are** ...*; *a set of circuits **is** ...*
- *data*: treat consistently, plural is standard in physics (*the data show*).
- Self-check: *What is the head noun of the subject?*

### G3 — which / that

- **that** (no comma): restricts which one you mean. *The circuits that contain mid-circuit measurements fail.* (only those)
- **, which** (with comma): adds information about all of them. *The circuits, which contain mid-circuit measurements, fail.* (all of them)

### G4 — Dangling modifiers

The opening phrase must describe the subject that follows.

- Wrong: *Using zero-noise extrapolation, the energy error decreases.* (the error does not use ZNE)
- Right: *Using zero-noise extrapolation, we reduce the energy error.*

### G5 — "respectively"

Use only to pair two lists of equal length, in order.

- *The T1 and T2 times are 120 and 95 μs, respectively.*
- Do not use it with a single item, or when the pairing is already obvious.

### G6 — Comma splices

Two complete sentences cannot be joined by a comma alone.

- Wrong: *The gate fidelity is 99.7%, this exceeds the threshold.*
- Right: *... 99.7%, which exceeds the threshold.* / *... 99.7%; this exceeds ...* / two sentences.
- "however" is not a conjunction: *..., however, ...* joining two sentences → *...; however, ...* or a new sentence.

### G7 — Repeated connectors

Do not start consecutive sentences with *Moreover / Furthermore / In addition / Besides*. Usually the link is already clear from the topic position (S2), or a more specific connector fits better (*therefore*, *in contrast*).

### G8 — Vague endings

Avoid *etc.*, *and so on*, *...* in formal text. List all items, or use *such as* / *including* for examples.

### G9 — Word choice and collocation

| Unidiomatic                          | Idiomatic                                   |
|--------------------------------------|---------------------------------------------|
| make an experiment                   | perform / carry out an experiment           |
| discuss about                        | discuss                                     |
| has a good agreement with            | agrees well with                            |
| the reason is because                | because / the reason is that                |
| comprise of                          | comprise / consist of                       |
| according to the results             | the results show                            |
| with the development of ...          | (delete; start with the content)            |
| In recent years, ... (as an opener)  | (delete, or state the specific development) |
| obviously / clearly                  | (delete; if it is obvious, no need to say)  |
| more and more                        | increasingly                                |

---

## Physics conventions

Follow the target journal's style guide where it differs from the defaults below.

### C1 — Symbols defined, notation consistent

- Define every symbol at first use, in the text near the equation.
- Use the same symbol for the same quantity in text, equations, figures, and the Supplemental Material.
- Italic for variables; roman for labels, operators like exp and Tr, and multi-letter subscripts that are words (e.g., *E*<sub>gs</sub>, not *E*<sub>*gs*</sub>).

### C2 — Units

- Space between number and unit: *10 μs*, not *10μs*.
- Units in roman type (use `\mathrm{}` or `siunitx` in LaTeX).
- No plural units (*5 ns*, not *5 nss*); consistent units throughout.
- Ranges: *1–10 GHz* (en dash), not *1-10 GHz*.

### C3 — Equations punctuated

Display equations are part of the sentence: end them with a comma or period as the grammar requires. After an equation, continue with lowercase *where* if the sentence continues.

### C4 — Figure, equation, and reference citations

- Cite every figure in the text, in numerical order.
- APS style: *Fig. 1* within a sentence, *Figure 1* at the start; *Eq. (1)*; *Ref. [1]*. Check the target journal for its own style.
- Each figure caption should state the claim of the figure (P3), not only describe the axes.

### C5 — Abbreviations defined

- Define at first use, separately in the abstract and the main text.
- Do not define an abbreviation that is used only once.
- Even common field abbreviations (NISQ, VQE, QAOA) need definition at first use in the main text.
