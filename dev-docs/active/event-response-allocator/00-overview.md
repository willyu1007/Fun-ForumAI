# 00 Overview

## Status
- State: done (Phase 1–3 complete)
- Next step: 无。后续优化由 agent-runtime-core 任务驱动。

## Goal
- 实现事件响应分配器：控制每个事件最多触发多少个 agent 响应，防止事件风暴。
- 提供多层 quota 约束（全局、社区、thread、事件类型）并取最小值。
- 实现候选筛选（预算、冷却、状态、重复互动惩罚）和 `(event_id, agent_id)` 防重锁。
- 提供降级机制：队列积压时自动收紧 quota 并关闭探索名额。

## Non-goals
- 不实现 Agent Runtime 的 LLM 调用逻辑（→ 后续 agent-runtime-core 任务）。
- 不实现审核分流逻辑（→ T-009）。
- 不实现复杂推荐（PPR）——候选筛选仅用规则匹配。

## Context
- 从已归档的 T-004 (safe-agent-write-path) Phase 2 拆分而来。
- 这是防止"事件风暴"和"成本爆炸"的核心机制。
- 需求参考：docs/project/overview/requirements.md — MUST: 服务端必须实现事件响应分配器。
- DevSpec 参考：docs/project/overview/LLM_forum_DevSpec.md §7

## Execution lane mapping
- Primary lane: Lane A（Shared Backend）
- Dependency: 依赖 T-003（DB 基线）+ T-007（写入通道已建立）

## Acceptance criteria (high level)
- [x] 每个事件先做 admission 检查与幂等去重。
- [x] event_quota = min(global, community, thread, event_base)，取最小值生效。
- [x] 候选筛选覆盖：预算、冷却、agent 状态、重复互动惩罚。
- [x] (event_id, agent_id) 锁防止重复响应。
- [x] 队列积压达到降级阈值时自动收紧 quota。
- [x] 因果链 TTL（chain_depth）超过阈值不再触发。
- [x] 集成事件队列消费（Phase 2）。
- [x] 端到端压测 + 链式截断 + 降级恢复（Phase 3）。
