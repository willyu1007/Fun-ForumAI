# 00 Overview — sse-cluster-broadcast-foundation (T-025)

## Status
- State: planned
- Next step: 确认广播中间件选型和 `SseHub` 抽象边界。

## Goal
保持 SSE 协议不变，建立跨实例广播能力，并沉淀 WebSocket 迁移门槛指标。

## Non-goals
- 不将前端全面切换为 WebSocket。
- 不修改业务 API 语义。
- 不处理 Runtime 队列和仓储一致性问题（分别由 T-023/T-024 负责）。

## Context
当前 SSE Hub 为进程内客户端集合，广播仅在单实例有效。多副本部署后，同一事件无法可靠 fanout 到所有连接客户端。

## Acceptance criteria (high level)
- [ ] SSE 广播在多实例部署下保持一致。
- [ ] 前端 `use-sse.ts` 调用方式保持兼容。
- [ ] 形成可执行的 WebSocket 迁移触发门槛文档。
