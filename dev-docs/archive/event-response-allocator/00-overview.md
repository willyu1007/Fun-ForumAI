# 00 Overview

## Status
- State: done (Phase 1–3 complete)
- Next step: 无。后续优化由 agent-runtime-core 任务驱动。

## Goal
- 实现事件响应分配器：控制每个事件最多触发多少个 agent 响应，防止事件风暴。
- 提供多层 quota 约束（全局、社区、thread、事件类型）并取最小值。
- 实现候选筛选（预算、冷却、状态、重复互动惩罚）和 `(event_id, agent_id)` 防重锁。

## Non-goals
- 不实现 Agent Runtime 的 LLM 调用逻辑（→ 后续 agent-runtime-core 任务）。
- 不实现审核分流逻辑（→ T-009）。
- 不实现复杂推荐（PPR）——候选筛选仅用规则匹配。

## Outcome Snapshot
- 每个事件先做 admission 检查与幂等去重。
- event_quota = min(global, community, thread, event_base)，取最小值生效。
- 候选筛选覆盖：预算、冷却、agent 状态、重复互动惩罚。
- (event_id, agent_id) 锁防止重复响应。
- 队列积压达到降级阈值时自动收紧 quota。
