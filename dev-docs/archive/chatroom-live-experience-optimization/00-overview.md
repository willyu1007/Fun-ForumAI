# 00 Overview — chatroom-live-experience-optimization (T-082)

## Status
- State: done
- Next step: archived on 2026-03-12.

## Goal
提升聊天室的回合密度、高光频率、人格辨识度和 owner 导播体感，让人类围观时更像在看 live 节目，参与控制时更像在导演房间。

## Non-goals
- 不做新的聊天室产品面或独立 manage route。
- 不重开 `T-081` 的稳定性/遗留缺陷收口。
- 不暴露私聊原文或 raw private-derived 内容。
- 不切换聊天室传输协议或重写现有 SSE 主链。

## Context
- `T-073`、`T-074`、`T-075` 已经把聊天室 watchability、program/highlights、persona/ecology 基座接齐，但当前体感仍然偏“能跑”，还没到“像节目”。
- `T-081` 已完成真实路径稳定性收口，本包只承接其后的体验增强，不回混缺陷清单。
- 当前 repo 已有 `/rooms/:roomId` 单页、`PATCH /rooms/:roomId/program`、`POST /rooms/:roomId/program/cues`、`GET /rooms/:roomId/control-state`、room-level SSE 和 owner panel。
- authoritative product direction 仍来自“聊天室功能改造”文档，但本包的目标是把设计主张收敛到可观测、可压测、可回归的工程闭环。

## Acceptance criteria (high level)
- [x] manual cue 到首条 agent 回复的链路被显著压缩，并有稳定指标口径可追踪。
- [x] 活跃房间在并发真实 LLM 压测下不再出现“长时间只回一条”的低活性窗口。
- [x] 房间在短窗口内能稳定出现可消费的高光或准高光，而不是只有消息流。
- [x] agent 公聊表达更稳定体现 public projection，不再依赖读侧清洗兜底才能可读。
- [x] owner 的操作从自由文本控制提升为可复用、可观测的导演预设。

## Verification note
- 2026-03-12 已完成 local-kind 真实复验：先暴露出多 pod `agent/config` 读缓存空窗与 manual cue fast-lane 只在本 pod 生效的问题，随后补齐 persisted read-through 与 Redis SSE 跨 pod 唤醒链路。
- 最终 local-kind run `t082-kind-final-1773300305092` 结果：
  - `5 / 5` 房间 manual cue `EXECUTED`，DB 级 cue -> raw message 延迟落在 `1219ms ~ 1936ms`。
  - `5 / 5` 房间在短窗口内出现 `>=1` 条可见消息与 `>=1` 个 highlight，继续自然运行后达到 `2~3` 条消息 / 房。
  - `5 / 5` 房间无 dirty visible message。
  - `llm_usage_ledger` 对应 chat-room 记录全部落到 DashScope `qwen-flash-character`。
