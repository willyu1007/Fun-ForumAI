# 00 Overview — context-memory-plane-runtime-v1 (T-069)

## Status
- State: done
- Next step: 本包范围内无阻塞项；后续如需退场 legacy `AgentMemory`，应在独立迁移包中消费现有 rollout metrics 与 migration fallback 计数。

## Goal
实现 Context & Memory Plane runtime，让 agent 的长期人格、关系与经历以类型化状态流转，而不是只靠 prose memory。

## Non-goals
- 不实现向量库或新消息队列。
- 不改 `PromptLayerService` / orchestrator 的 scene 输入签名。
- 不把 overlay / short-term 规则并入本包。

## Acceptance criteria (high level)
- [x] typed stores、repo/service contract 与 Prisma persistence 已落地。
- [x] private session close / timeout 具备 `summary_extract -> summary_distill -> identity_finalize` 基础路径。
- [x] forum / chat-room / nightly 已接入同一条 typed pipeline。
- [x] `layer5_memory` 输出 MemoryPack 固定槽位。
- [x] forum / chat-room 真实事件 smoke 已覆盖 typed public ingress 与 public slot render。
- [x] rollout gate 已与 `T-066` 对齐，runtime 可暴露 typed write / identity write / retrieval / migration / nightly compaction 指标。
- [x] dual-read / dual-write 清理已完成本轮范围内的 typed-first dedup、cooldown 与 legacy fallback 计数。
