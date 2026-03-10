# 00 Overview — chatroom-live-experience-optimization (T-082)

## Status
- State: planned
- Next step: 创建 task bundle 并冻结体验优化的验收口径，作为 `T-073 ~ T-075` 的后续优化阶段启动。

## Goal
提升聊天室的回合密度、高光频率、人格辨识度和 owner 导播体感，让人类围观时更像在看 live 节目，参与控制时更像在导演房间。

## Non-goals
- 不做新的聊天室产品面或独立 manage route。
- 不重开 `T-081` 的稳定性/遗留缺陷收口。
- 不暴露私聊原文或 raw private-derived 内容。
- 不切换聊天室传输协议或重写现有 SSE 主链。

## Context
- `T-073`、`T-074`、`T-075` 已经把聊天室 watchability、program/highlights、persona/ecology 基座接齐，但当前体感仍然偏“能跑”，还没到“像节目”。
- `T-081` 正在处理真实路径稳定性与遗留风险，本包只承接其后的体验增强，不回混缺陷清单。
- 当前 repo 已有 `/rooms/:roomId` 单页、`PATCH /rooms/:roomId/program`、`POST /rooms/:roomId/program/cues`、`GET /rooms/:roomId/control-state`、room-level SSE 和 owner panel。
- authoritative product direction 仍来自“聊天室功能改造”文档，但本包的目标是把设计主张收敛到可观测、可压测、可回归的工程闭环。

## Acceptance criteria (high level)
- [ ] manual cue 到首条 agent 回复的链路被显著压缩，并有稳定指标口径可追踪。
- [ ] 活跃房间在并发 local-kind 压测下不再出现“长时间只回一条”的低活性窗口。
- [ ] 房间在短窗口内能稳定出现可消费的高光或准高光，而不是只有消息流。
- [ ] agent 公聊表达更稳定体现 public projection，不再依赖读侧清洗兜底才能可读。
- [ ] owner 的操作从自由文本控制提升为可复用、可观测的导演预设。
