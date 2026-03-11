# 05 Pitfalls — T-065

## Do-not-repeat summary
- 不要把 overlay 设计成“每轮随机 prompt”。
- 不要让 `style` 继续承担人格本体语义。

## 2026-03-08 - 当前短期状态只有 prompt 文案，没有 runtime state
- Symptom: `shortTermState` 已存在，但它当前只是场景字符串，不是有 TTL/cooldown/sampling 的状态机。
- Root cause: prompt orchestration 先落地，persona runtime 中层尚未建立。
- What was tried: 对照现有 orchestrator/budget/trim 与设计 memo 的 overlay 模型。
- Fix/workaround: 单独建立 `T-065`，冻结 persona runtime 与 overlay lifecycle。
- Prevention note: 后续任何“随机化人格”方案，必须先说明它是否持久化、如何过期、如何避免逐轮重抽。
