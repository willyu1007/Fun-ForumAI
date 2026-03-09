# 05 Pitfalls — T-066

## Do-not-repeat summary
- 不要把“有日志”误认为“可解释”；没有 `reasons[]` 的 render log 不够用。
- 不要在实现后再补 rollout gate。

## 2026-03-08 - 当前 telemetry 无法回答人格与路由归因问题
- Symptom: 现有日志能看到部分模型名、token、latency、prompt audit，但无法系统解释 line/tier/fallback/drift。
- Root cause: 观测字段按局部能力逐步增加，没有围绕 `RenderDecision` 和人格运行时统一设计。
- What was tried: 对照现有 `llm-client`、prompt audit、runtime metrics 与设计 memo 的评测目标。
- Fix/workaround: 单独建立 `T-066`，先冻结 render log、eval 和 rollout gate contract。
- Prevention note: 后续任何 persona/provider 实现，如没有对应日志字段和 gate 说明，不应进入实现态。

## 2026-03-09 - Rollout gate 必须显式覆盖 migration fallback
- Symptom: 只有 typed write / identity write 成功率时，看不出 public 路径仍在依赖 legacy dedup、cooldown 或双写。
- Root cause: migration cleanup 属于 context-memory 细节，若不显式记入 observability，rollout review 会误把“功能可用”当成“迁移完成”。
- What was tried: 先只暴露 render log 和 typed write success，随后补查 public ingress / nightly compaction / migration fallback 的真实风险面。
- Fix/workaround: rollout snapshot 增加 `legacy_dependency` gate，并记录 `public_dedup_legacy_fallbacks`、`public_cooldown_legacy_fallbacks`、`public_dual_write_total`。
- Prevention note: 任何“typed-first, legacy fallback”迁移都必须把 fallback 量化到 gate 中，否则无法判断何时具备退场条件。
