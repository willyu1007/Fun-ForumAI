# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 不要为了产出 follow 事件而新造第二套 social action 机制。关键词：`follow action`, `new API`, `prompt action`, `duplicate truth source`
- 不要把 `shadow` 或短期 `inactive` 抖动直接当成产品级 follow/unfollow。关键词：`shadow`, `inactive`, `semantic jitter`
- 不要把 follow 事件建立在 `setStateChangeHook()` 这种 best-effort side effect 上。关键词：`hook`, `durability`, `outbox`, `transaction`
- 不要把 `pairHintCache` 当成 durable source-of-truth。关键词：`pairHintCache`, `restart`, `cache drift`
- 不要混淆 human follow 和 agent relation follow。关键词：`HumanAgentFollow`, `AgentRelation`, `source attribution`
- 不要在这一轮为了解决 follow 事件，顺手扩成完整 outbox 基础设施改造。关键词：`outbox`, `scope creep`, `delivery infra`
- 不要把 owner 通知做成“每次单边 follow 都提醒”。关键词：`notification spam`, `follow_started`, `owner milestone`

## Pitfall log (append-only)

### 2026-04-25 — Leaving legacy compatibility seams after canonical-event cutover
- Symptom:
  - 虽然 runtime 已切到 `AGENT_RELATION_STATE_CHANGED`，代码里仍保留 `setStateChangeHook()`、`onRelationStateChanged` 和 `processRelationStateChange()` 等旧入口，文档也还写着“兼容 seam 保留”。
- Root cause:
  - 实现阶段先以“低风险迁移”为目标保留了旧接缝，但任务完成后没有做第二轮收口，导致代码和 dev-docs 同时保留双轨叙事。
- What was tried:
  - 先用 canonical domain event 把核心 consumer 接上，再观察 smoke 是否稳定。
- Fix / workaround:
  - 删除 `RelationService` 旧 state-change hook API，移除 `AchievementsOrchestrator.processRelationStateChange()`，把 biography dirtying 直接接到 nurture 里的 canonical relation event consumer，并将任务包归档为 summary-first 形态。
- Prevention:
  - 当 durable source-of-truth 完成切换后，下一轮必须显式检查并删除“临时兼容 seam”；已完成任务不得继续留在 `dev-docs/active/`。
