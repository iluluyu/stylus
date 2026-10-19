# Sentence Structure (Gopen & Swan) — codes S1–S8

**Core idea:** readers take meaning partly from *where* information sits in a sentence. Put each piece of information where the reader expects it.

Two positions matter most:

- **Topic position** (the start): tells the reader whose story this is, and links back to what came before.
- **Stress position** (the end; also the end of a clause before a colon or semicolon): where the reader places emphasis.

**Quick diagnostic for any sentence:** Whose story is it? Is that at the start? What is new? Is that at the end?

---

## S1 — Subject close to its verb

A long interruption between the grammatical subject and its verb forces the reader to wait before learning what the sentence is about.

- Before: *The fidelity of the two-qubit gate, which was measured using interleaved randomized benchmarking over 500 random sequences on the device described in Ref. [12], reached 99.7%.*
- After: *Using interleaved randomized benchmarking over 500 random sequences, we measured a two-qubit gate fidelity of 99.7%.*

Fix: move the interruption to the start or end of the sentence, or into a separate sentence.

- Self-check: *How many words separate the subject from its verb? More than a short phrase → restructure.*

## S2 — Topic position: whose story, linked backward

Begin the sentence with the entity the sentence is about, and with information the reader already has (usually from the previous sentence).

- Before: *We prepare a GHZ state on 20 qubits. Parity oscillations, measured by rotating each qubit about an axis in the equatorial plane, quantify the coherence of this state.*
- After: *We prepare a GHZ state on 20 qubits. Its coherence is quantified by parity oscillations, which we measure by rotating each qubit about an axis in the equatorial plane.*

The passive voice is acceptable when it puts the familiar entity in the topic position.

- Self-check: *Does the first phrase connect to the previous sentence?*

## S3 — Stress position: new and important information at the end

End the sentence with what you want emphasized: the new result, the number, the conclusion.

- Before: *A 40% reduction in circuit depth compared with standard transpilation is achieved by our compilation scheme.*
- After: *Compared with standard transpilation, our compilation scheme reduces circuit depth by 40%.*

Common fault: ending on a reference, a method name, or a qualifier ("..., as shown in Fig. 3", "..., in this work") when the key result sits in the middle.

- Self-check: *Is the most important word in this sentence near its end?*

## S4 — One emphasis per stress position

If a sentence has more important points than stress positions, split it.

- Before: *The protocol reduces the two-qubit gate count by 35%, is robust to coherent over-rotation errors, and requires no ancilla qubits, which makes it suitable for near-term devices.*
- After: *The protocol reduces the two-qubit gate count by 35%. It is also robust to coherent over-rotation errors and requires no ancilla qubits. These properties make it suitable for near-term devices.*

- Self-check: *How many things in this sentence deserve emphasis? More than one → split, or use a semicolon.*

## S5 — Action in verbs, not nouns

Express the action as a verb, not as a noun paired with a weak verb (perform, carry out, conduct, achieve, make, obtain).

| Nominalized                                   | Verb-based                         |
|-----------------------------------------------|------------------------------------|
| An optimization of the parameters was performed | We optimized the parameters      |
| We carried out a comparison of A and B        | We compared A and B                |
| A decrease in fidelity is observed            | The fidelity decreases             |
| This leads to an improvement of the accuracy  | This improves the accuracy         |
| We make the assumption that                   | We assume that                     |

Warning signs: nouns ending in *-tion, -ment, -ance, -ence, -ization* next to a weak verb.

- Self-check: *Where is the real action? Is it the verb?*

## S6 — Context before new information

Tell the reader what a quantity is before giving its value; introduce a concept before using it.

- Before: *A value of 0.92 was obtained, which corresponds to the overlap between the prepared and target states.*
- After: *The overlap between the prepared and target states is 0.92.*

- Self-check: *When the reader meets the number or new term, do they already know what it refers to?*

## S7 — Consistent topic strings

Within a paragraph, the topic positions of consecutive sentences should refer to the same entity, or form a clear chain (A→B, then B→C). Abrupt topic switches lose the reader.

- Before: *Noise limits current quantum processors. To address this, error mitigation techniques have been proposed. Zero-noise extrapolation is one of them. A large sampling overhead is required by these methods.*
- After: *Current quantum processors are limited by noise. Error mitigation reduces the effect of this noise without the qubit overhead of full error correction. Its most widely used variant, zero-noise extrapolation, requires a sampling overhead that grows rapidly with circuit size.*

Chain: processors → noise → error mitigation → zero-noise extrapolation → overhead (new information at each end).

- Self-check: *Underline the first few words of each sentence in the paragraph. Do they tell a connected story?*

## S8 — Explicit logical links

State how each sentence relates to the previous one: cause (because, therefore), contrast (however, in contrast), purpose (to ...), consequence (as a result).

- Before: *The barren plateau problem limits trainability. Our ansatz uses local cost functions.*
- After: *Barren plateaus limit the trainability of deep variational circuits. To avoid them, our ansatz uses local cost functions, whose gradients, for shallow circuits, vanish at most polynomially with the number of qubits [CITE].*

Do not overuse connectors at every sentence start (see G7). Often a well-chosen topic position (S2) makes the link clear without one.

- Self-check: *Could the reader explain why this sentence follows the previous one?*
