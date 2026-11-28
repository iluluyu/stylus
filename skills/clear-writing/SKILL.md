---
name: clear-writing
description: "Write or revise explanations and technical prose in clear, concise English or Chinese, inspired by Karpathy's ASD-STE100 suggestion. Use whenever the user asks for clear prose, technical explanations, simplified rewriting, plain-language editing, an ASD-STE100 draft, or 中文清晰写作、技术解释、通俗改写、简化表达、去冗余或去AI腔润色."
license: MIT
metadata:
  author: iluluyu
  version: "0.1.0"
---

# Clear writing / 清晰写作

Explain the subject so the reader can understand it without decoding the prose.
Follow Karpathy's suggestion to get "80% of the way to ASD-STE100."
That phrase describes a style preference, not a compliance score.

Match the user's language (English or Chinese) unless another language is requested:
- For **English**, read [the ASD-STE100 reference](references/asd-ste100.md) for the exact standard,
  examples, and corrections to [the tweet's attached image](references/karpathy-asd-ste100.png).
  The baseline is **ASD-STE100 Simplified Technical English, Issue 9 (2025-01-15)**.
- For **Chinese (中文)**, read [the Chinese clear-writing reference](references/chinese-clear-writing.md)
  for Chinese-specific rules (splitting nested "的" clauses, removing nominalizations and AI-style
  filler, sentence length guidelines, and before/after examples).

## Default (English): readable, STE-inspired

1. Identify the reader's question and the facts that answer it.
2. Give the main idea, then build the explanation in a useful order.
3. Use common words, concrete subjects, and active verbs. Define necessary terms.
4. Keep one name for each concept. Remove decorative synonyms and stock phrases.
5. Aim for 25 words or fewer per descriptive sentence and 20 per instruction.
   Keep one topic per paragraph; split paragraphs longer than six sentences.
6. Give one instruction per sentence. Put a prerequisite before the action.
   Break long noun groups into phrases that show how the parts relate.
7. Remove needless words, then read for meaning. Preserve facts, uncertainty,
   units, exceptions, and the user's voice. Keep natural phrasing when it helps.

Return the requested text. Add explanation about edits only when useful or requested.

## Default (中文): 借鉴 STE 原则的清晰叙述

用直白、克制、逻辑顺畅的现代汉语把事情讲清楚，让读者一眼看懂主干与因果，不必“解码”句子。

1. **先明问题，结论先行**：先锁定读者要解决的问题，用 1–2 句话给出核心结论或整体心智模型，再展开细节。
2. **由已知推未知，按序推进**：按“前提/原因 → 机制/动作 → 结果/影响”或“总览 → 分步”的顺序叙述；每句尽量承接前文已知信息，把新信息放在句末，不跳步。
3. **主语明确，动词直接**：谁做动作谁当主语，少用无主句和欧化“被”字句；把“进行检查”“加以优化”改回“检查”“优化”。必要术语首次出现时用一句话说清。
4. **控制句长，杜绝流水句**：说明句尽量控制在 35 字以内（不宜超过 45 字），指令句控制在 25 字以内；能用句号断句的地方不要“一逗到底”。拆分超过两层的“的”字长定语；每段只讲一个主题，超过 5–6 句时分段。
5. **一句一指令，条件前置**：操作步骤每句只写一个动作；条件、范围或例外放在动作之前，用逗号隔开（如“缓存未命中时，直接查询数据库。”）。3 项以上的并列要点或步骤改用列表。
6. **术语一致，去掉 AI 腔**：同一概念全篇固定一个名称；删去空泛起手式、元话语与虚假递进（如“值得注意的是”“综上所述”“这不仅是 A，更是 B”）。
7. **区分事实与推断，保留原意**：明确区分已验证事实、推断与未覆盖边界；删赘词后通读，保留数据、单位、不确定性、例外情况与自然语气。

直接输出改写或撰写后的文本；仅在有帮助或用户要求时补充修改说明。

## When the user requests strict ASD-STE100

Read the relevant writing rules **and** dictionary in an official copy of the
requested issue. Otherwise use Issue 9, after checking the official site for updates.
Identify technical nouns and verbs from the user's subject field or approved glossary.
Check words by their approved meaning, part of speech, and allowed form.
Apply the procedural or descriptive rules as appropriate, including the standard's
word-count conventions. Use the reference's rule map to locate the relevant sections.

If the official rules, dictionary, or required terminology are unavailable, produce
a clearly labeled STE-inspired draft and state what remains unverified. Request the
missing reference when strict verification is needed. Do not claim compliance from
short sentences, a model's memory, or the attached image. For a strict draft, report
the issue used and the checks completed; distinguish drafting from verified compliance.

Note for Chinese: ASD-STE100 is an English-only controlled language standard with no
official Chinese dictionary. For Chinese text, apply its structural and clarity principles
as a style guide; do not claim ASD-STE100 compliance for Chinese output.

## Examples

### English

Before: "It is imperative that the operator ensures the valve is closed prior to operation."

After: "Before you start the operation, close the valve."

This illustrates the style; it is not a claim that the complete document is compliant.

### 中文

**操作指令**
- 改前：“操作人员在进行正式运行之前，务必要确保阀门处于关闭状态。”
- 改后：“开始运行前，先关闭阀门。”

**技术说明**
- 改前：“值得注意的是，该系统通过对高并发场景下的用户输入数据进行实时清洗处理，从而实现了响应速度的显著提升。”
- 改后：“该系统在高并发场景下实时清洗用户输入，因此响应更快。”
