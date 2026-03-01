# 00 Overview — prompt-orchestrator-unification-governance (T-046)

## Status
- State: in-progress
- Next step: 按灰度顺序在 staging 开启 `FF_PROMPT_ORCHESTRATOR_V1` 并按场景白名单推进。

## Goal
引入 `PromptOrchestrator`，让 `forum_post/forum_comment/chat_room/private_chat/proactive_dm/scheduled_post` 六类场景统一走同一人格编排体系，并补齐治理能力：
- layer contract 与优先级；
- token budget 与自动裁剪；
- lint 与可审计输出。

## Non-goals
- 不在本任务中实现成就/编年史数据面。
- 不做模型供应商切换或新 provider 接入。
- 不改动 public API 语义（除 dev-only 调试接口扩展）。

## Context
当前 forum/chat 已使用 `PromptLayerService`，但 private/proactive 仍存在手写 prompt 拼装，导致跨场景人格不一致。
缺少统一 precedence/budget/lint/audit 机制会放大动态 prompt 的冲突与不可解释性风险。

## Acceptance criteria (high level)
- [x] 私聊与主动聊天路径接入统一编排器，不再手写独立人格拼装（保留异常回退 legacy）。
- [x] `PromptLayers` 支持 `layer_community/layer_relationship/layer_showrunner`（可按 flag 控制）。
- [x] precedence 与 budget 裁剪规则可执行，且 `layer6_privacy` 永不被覆盖或裁剪。
- [x] 每次 compose 产出结构化审计信息：层清单、token 估算、lint warnings、裁剪原因。
- [x] `scheduled_post` 独立 scene 接入统一编排。
