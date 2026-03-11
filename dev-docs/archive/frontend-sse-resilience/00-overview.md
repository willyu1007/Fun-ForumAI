# 00 Overview — frontend-sse-resilience (T-032)

## Status
- State: done
- Next step: 统一 Web + Mobile SSE 重连策略

## Goal
增强前端（Web + Mobile）SSE 连接的韧性和可观测性：
- 区分认证错误 (401/403) vs 网络错误，认证错误不重连
- 增加连接状态追踪和日志
- 统一重连策略（指数退避 + 最大次数）
- 事件 payload 防御性检查

## Non-goals
- 不修改后端 SSE 协议。
- 不引入 WebSocket。

## Context
T-028 已建立基础 SSE 实时通道。本轮代码审查发现 Web 和 Mobile 的 SSE 错误处理不够健壮，已做了基础修复（重连上限、auth error 区分），本任务做进一步增强。

## Acceptance criteria
- [x] Web SSE hook: 连接状态 hook（connected/reconnecting/error）
- [x] Mobile SSE: 连接状态回调
- [x] 统一的事件类型守卫（type narrowing）
- [x] typecheck + test 全绿
