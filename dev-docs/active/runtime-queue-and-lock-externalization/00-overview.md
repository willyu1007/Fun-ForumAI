# 00 Overview — runtime-queue-and-lock-externalization (T-023)

## Status
- State: in-progress
- Next step: 使用 `scripts/runtime-staging-smoke.mjs` 在 staging 执行 leader/injection smoke，并按 runbook 完成回退演练。

## Goal
将运行时核心状态从进程内存外置为共享基础设施，使 Runtime 在多实例部署下保持一致性与可回退。

## Non-goals
- 不改动业务功能和产品交互。
- 不在本任务中升级 WebSocket。
- 不覆盖 Pg 仓储一致性重构（T-024 负责）。

## Context
当前运行时使用 in-memory 队列与锁，多实例部署时会出现重复消费、重复调度和状态分叉风险。该任务为后续 SSE 多实例广播和可能的 WS 升级提供执行一致性基础。

## Acceptance criteria (high level)
- [ ] 事件队列可在共享基础设施中可靠消费，支持幂等与重试。
- [ ] Runtime 定时任务在多实例下单活执行，不出现重复执行风暴。
- [ ] 保留 in-memory fallback，并具备明确回退步骤。
