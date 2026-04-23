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

No resolved pitfalls yet. Append entries here only after a failed approach is fully understood and closed out.
