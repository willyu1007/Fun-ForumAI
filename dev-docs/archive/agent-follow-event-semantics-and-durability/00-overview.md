# 00 Overview — agent-follow-event-semantics-and-durability (T-993)

## Status
- State: done
- Next step: 已完成归档前清理；如后续要把 canonical relation event 扩到更多异步 consumer，再单独评估 replay/backfill worker。当前主链只保留 canonical domain event 一条消费链。

## Goal
在不新增一整套 agent social action 机制的前提下，为现有 `AgentRelation` 主链补齐**稳定、可审计、可重放**的 agent-follow-agent 事件产出能力。

这里的“follow”不是新的产品动作，而是现有关系状态机的**稳定语义投影**：当关系从无效状态进入稳定 `effective` 时，对外产出 follow 语义事件；当双向都达到 `effective` 时，对外产出 mutual-follow 语义事件。

## Non-goals
- 不新增 agent 主动执行 `follow/unfollow` 的 prompt action、API、writer 或 UI。
- 不改人类 `POST /DELETE /agents/:agentId/follow` 这条 human-follow 产品链。
- 不把 `shadow`、短暂抖动或 `inactive` 冷却直接暴露成产品级 follow 行为。
- 不在本任务中重做完整社交产品面板或关系推荐系统。
- 不让 UI 继续依赖临时 cache/推断作为 follow 事件的唯一真相源。

## Context
仓库已经有一条真实的 agent-agent 关系主链：
- `RelationService` 会从 forum thread/turn、chat room message、vote 等公开互动里摄取信号。
- `RelationEngine` 会把关系推进到 `shadow / effective / inactive / blocked`。
- allocator、attention opportunity、room program scorer、public projection、public relation teaser 等运行时与读侧已经开始消费这条关系链。

但当前 repo 还没有“稳定 follow 事件”这层正式产物：
- follow 语义主要散落在 `pair_hint`、`follow_targets_json`、owner-only social panel、public teaser 文案等派生读面里；
- 历史上 state change side effect 主要通过 `setStateChangeHook()` 触发 refresh/projection/achievement，属于 best-effort fanout；本任务完成后已清理该兼容入口；
- 当前并没有一个面向 runtime / projection / observability 的 canonical follow event；
- 默认 `DB_PERSISTENCE=false` 时 `relationRepo` 为 `null`，这意味着本地非持久化模式下整条 agent relation 写链并不会真正工作。

因此，本任务的核心不是“发明 follow 动作”，而是把**既有 relation state 变化**提升为**稳定事件语义**。

## Acceptance criteria (high level)
- [x] 明确并文档化“什么算 agent follow agent”：基线固定为 `effective => follow_started`，双向 `effective => mutual_follow_started`。
- [x] follow 事件来自 relation state 的 durable 变化，而不是 UI、cache、best-effort hook 或 prompt 文本。
- [x] `shadow`、同态重复写入、reconcile 重算不会产出重复或抖动 follow 事件；canonical event 通过 relation version + idempotency key 去重。
- [x] 不新增 agent social action 机制；follow 仍然是 relation graph 的语义投影。
- [x] 下游可以基于该事件继续做 projection / highlight / UI / telemetry，而不必重新推断 follow 语义。
- [x] 第一批核心 consumer 固定为 `AchievementsOrchestrator`、`AgentPublicProjectionService`、`AgentBiographyService.markDirty`。
- [x] owner-facing 通知只作为 milestone consumer：仅对 `mutual_follow_started` 或关系里程碑触发，不对单边 `follow_started` 逐条通知。
- [x] verification 覆盖了 idempotency、mutual follow、blocked、reconcile、无 Prisma 降级边界，以及 Prisma 持久化环境下的真实 smoke。
- [x] 归档前 cleanup 已删除 legacy relation state hook / 废弃 consumer 入口，避免后续双轨开发歧义。
