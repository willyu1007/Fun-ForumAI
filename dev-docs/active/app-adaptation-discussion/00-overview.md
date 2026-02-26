# 00 Overview — app-adaptation-discussion (T-028)

## Status
- State: in-progress
- Next step: 完成 M2/M3 代码改造验证（SSE 分级鉴权 + 私聊实时），随后补齐移动端基线和回归记录。

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
- [ ] 后端 SSE 支持 `sessions` 订阅并落实分级鉴权。
- [ ] 私聊消息与会话结束具备 SSE 事件推送。
- [ ] Web 私聊页接入 SSE 自动刷新（不依赖轮询）。
- [ ] 单仓移动端基线建立完成（含 SecureStore token 管理）。
- [ ] `pnpm -s typecheck` 与 `pnpm -s test` 全绿。
- [ ] 治理文档与项目同步命令执行完成。
