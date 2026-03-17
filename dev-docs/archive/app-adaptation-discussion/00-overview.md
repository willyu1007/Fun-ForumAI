# 00 Overview — app-adaptation-discussion (T-028)

## Status
- State: done
- Next step: 无；本包已归档。移动端自动化测试留待后续任务。
- 文档状态（2026-03-17）：经 repo 现状校验，6 条验收已满足，已勾选并归档。

## Goal
在保持单仓、单后端的前提下，启动 App 适配实施并打通 P1 主链路：
- 匿名观演；
- 登录后养成主链路；
- 聊天室与私聊均基于 SSE 实时更新；
- 认证采用 A 策略（Bearer JWT + SecureStore）。

## Non-goals
- 不新增数据库 schema / migration。
- 不修改现有 REST 语义。
- 不将 Admin 面板纳入普通用户 App 导航。
- P1 不引入 WebSocket。

## Context
已完成决策收敛并进入实施：
- SSE 鉴权边界：公开房间订阅可匿名，私聊会话订阅强鉴权（且校验 owner）。
- 后端策略：最小增量改动，集中在 SSE 订阅边界与私聊事件。
- 工程策略：维持单仓，引入 `apps/mobile` Expo managed baseline。

## Acceptance criteria (high level)
- [x] 后端 SSE 支持 `sessions` 订阅并落实分级鉴权。（`sse.ts` 解析 `sessions`、无身份 401、非 owner 403、`hub.subscribeSession`；03 记录 M2。）
- [x] 私聊消息与会话结束具备 SSE 事件推送。（`private-channel-service` 内 `broadcastToSession(PRIVATE_MESSAGE_CREATED|PRIVATE_SESSION_ENDED)`；03 记录 M3。）
- [x] Web 私聊页接入 SSE 自动刷新（不依赖轮询）。（`usePrivateSessionSse` 订阅 `?sessions=`，收到事件后 invalidate 消息/会话 query；`ChatThread` 内调用；03 记录 M3。）
- [x] 单仓移动端基线建立完成（含 SecureStore token 管理）。（`apps/mobile` 存在，`token-store.ts` 使用 `expo-secure-store`；03 记录 M4/M5。）
- [x] `pnpm -s typecheck` 与 `pnpm -s test` 全绿。（04-verification 已记录 PASS；mobile:typecheck/mobile:test 亦已通过或占位通过。）
- [x] 治理文档与项目同步命令执行完成。（01/02/03/04 与 project hub 已存在；sync 命令见 `.ai/scripts/ctl-project-governance.mjs`。）
