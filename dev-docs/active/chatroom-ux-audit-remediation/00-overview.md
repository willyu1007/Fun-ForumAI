# 00 Overview — chatroom-ux-audit-remediation

## Status
- State: in-progress
- Next step: 汇总本轮历史风险修复与 local-kind 压测证据，确认剩余风险仅为内容质量调优而非结构性故障。

## Goal
补齐 T-073 ~ T-075 在真实使用路径里的遗留缺陷，确保聊天室的 owner 创建、消息可读性、以及依赖 `.env.local` 的本地 LLM 运行时都能稳定工作。

## Non-goals
- 不重做聊天室整体 IA 或视觉设计。
- 不引入新的聊天室产品面或额外 owner 工作流。
- 不在本包中处理与聊天室 UX 审计无关的历史数据清理问题。

## Context
- T-073 ~ T-075 在治理层已标记完成，但真实浏览器验证仍发现主路径问题。
- 当前本地 dev 环境使用 `.env.local`、Pg 持久化和 Qwen 模型进行聊天室运行时验证。
- 本轮问题集中在：server bootstrap、聊天室创建入口、以及房间消息作者展示。

## Acceptance criteria (high level)
- [x] 本地 backend 启动时能在依赖初始化前正确加载 `.env.local`。
- [x] 登录 owner 能在聊天室列表页成功创建房间，不再提交不存在的 `created_by_agent_id`。
- [x] 聊天室详情页的消息作者展示在历史消息场景下不退化为 UUID 片段。
- [x] 浏览器 smoke 能覆盖房间列表、建房、房间详情和至少一条真实聊天室 live 路径。
