# 00 Overview — context-memory-plane-runtime-v1 (T-069)

## Status
- State: in-progress
- Next step: 继续做 forum/chat-room 的真实运行烟测、nightly rollout gate，以及 dual-write 迁移清理。

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
