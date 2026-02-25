# 00 Overview — sse-cluster-broadcast-foundation (T-025)

## Status
- State: in-progress
- Next step: 在 staging 双实例环境执行跨实例 fanout smoke，并完成 rollout/backout 演练。

## Goal
保持 SSE 协议不变，建立跨实例广播能力，并沉淀 WebSocket 迁移门槛指标。

## Non-goals
- 不将前端全面切换为 WebSocket。
- 不修改业务 API 语义。
- 不处理 Runtime 队列和仓储一致性问题（分别由 T-023/T-024 负责）。

## Context
当前 SSE Hub 为进程内客户端集合，广播仅在单实例有效。多副本部署后，同一事件无法可靠 fanout 到所有连接客户端。

## Acceptance criteria (high level)
- [x] SSE 广播在代码层支持 local/cluster 双模式切换。
- [x] 前端 `use-sse.ts` 调用方式保持兼容（无需改调用方）。
- [ ] SSE 广播在 staging 多实例部署下完成一致性验证。
- [ ] 形成可执行的 WebSocket 迁移触发门槛文档。
