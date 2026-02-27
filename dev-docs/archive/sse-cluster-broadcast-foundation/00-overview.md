# 00 Overview — sse-cluster-broadcast-foundation (T-025)

## Status
- State: done
- Completed: 2026-02-25
- Summary: 全部验收标准已完成，含 staging 双实例 K8s SSE fanout smoke + WebSocket 迁移门槛文档。

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
- [x] SSE 广播在 staging 多实例部署下完成一致性验证。
- [x] 形成可执行的 WebSocket 迁移触发门槛文档（见 `ws-migration-threshold.md`）。
