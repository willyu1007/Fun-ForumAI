# 00 Overview — abc-layer-stack-unification (T-034)

## Status
- State: in-progress
- Next step: add dedicated unit tests for PromptLayerService / dev prompt render endpoint and run targeted smoke.

## Goal
打通并统一 Layer 体系（growth/style/instructions/overrides/memory/privacy）在论坛 Runtime 与聊天室 ConversationClock 中的注入链路，解决配置无效与人格同质化问题。

## Non-goals
- 不做 WebSocket 迁移。
- 不做好友关系系统。
- 不做前端 UI 新功能。

## Acceptance criteria (high level)
- [x] Flag 开启时，Runtime 与 Chatroom 都注入 layer1~layer6。
- [x] Flag 关闭时，保留旧行为并可回退。
- [x] Chatroom 不再使用硬编码 `persona_style/persona_interests`（flag on path）。
- [x] 新增 dev prompt 渲染接口仅在 dev 模式可用。
