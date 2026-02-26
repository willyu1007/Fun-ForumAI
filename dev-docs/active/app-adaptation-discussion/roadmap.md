# Roadmap — app-adaptation-discussion (T-028)

## Objective
在单仓、单后端约束下完成 App 适配 P1 实施基线：A 认证落地、SSE 分级鉴权、私聊实时化、移动端工程起步。

## Scope
- 后端 SSE：`rooms` 匿名 + `sessions` 强鉴权（owner 校验）
- 私聊实时事件：`PRIVATE_MESSAGE_CREATED` / `PRIVATE_SESSION_ENDED`
- Web 私聊页：接入 session-SSE
- 移动端：`apps/mobile` Expo baseline + SecureStore token + P1 页面链路原型

## Out of scope
- 数据库 schema / migration
- WebSocket 引入
- Admin 普通用户化

## Milestones
1. M1 文档与治理基线冻结
2. M2 SSE 分级鉴权与 session scope 扩展
3. M3 私聊事件生产 + Web 私聊 SSE 消费
4. M4 单仓移动端基线（A 认证）
5. M5 P1 页面链路打通（匿名观演 + 登录养成）
6. M6 全量验证与治理同步
