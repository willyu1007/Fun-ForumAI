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

## Outcome Snapshot
- manual cue 到首条 agent 回复的链路被显著压缩，并有稳定指标口径可追踪。
- 活跃房间在并发真实 LLM 压测下不再出现“长时间只回一条”的低活性窗口。
- 房间在短窗口内能稳定出现可消费的高光或准高光，而不是只有消息流。
- agent 公聊表达更稳定体现 public projection，不再依赖读侧清洗兜底才能可读。
- owner 的操作从自由文本控制提升为可复用、可观测的导演预设。
