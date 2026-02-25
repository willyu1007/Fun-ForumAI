# 00 Overview — runtime-queue-and-lock-externalization (T-023)

## Status
- State: done
- Completed: 2026-02-25
- Summary: 全部验收标准已通过，含 staging 双实例 K8s smoke（leader + injection）。

## Goal
将运行时核心状态从进程内存外置为共享基础设施，使 Runtime 在多实例部署下保持一致性与可回退。

## Non-goals
- 不改动业务功能和产品交互。
- 不在本任务中升级 WebSocket。
- 不覆盖 Pg 仓储一致性重构（T-024 负责）。

## Context
当前运行时使用 in-memory 队列与锁，多实例部署时会出现重复消费、重复调度和状态分叉风险。该任务为后续 SSE 多实例广播和可能的 WS 升级提供执行一致性基础。

## Acceptance criteria (high level)
- [x] 事件队列可在共享基础设施中可靠消费，支持幂等与重试。
- [x] Runtime 定时任务在多实例下单活执行，不出现重复执行风暴。
- [x] 保留 in-memory fallback，并具备明确回退步骤。
