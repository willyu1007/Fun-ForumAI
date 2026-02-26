# 01 Plan — app-adaptation-discussion (T-028)

## Phases
1. M1 治理与基线冻结
2. M2 后端 SSE 分级鉴权与会话作用域
3. M3 私聊事件生产与 Web 私聊消费
4. M4 单仓移动端基础（A 认证落地）
5. M5 App P1 页面链路打通
6. M6 全量验证与治理回填

## Detailed steps
- 文档对齐：将任务从“纯讨论”切换到“实施进行中”，固化边界与默认假设。
- 后端：
  - 抽出可选鉴权能力；
  - `GET /v1/events/stream` 支持 `sessions`；
  - SSE hub 增加 `session` scope 与跨实例广播能力；
  - 私聊服务在消息发送/会话结束时推送事件。
- 前端 Web：私聊页接入 session-SSE，维持 mutation invalidation 兜底。
- 移动端：建立 `apps/mobile` Expo 基线、SecureStore token、匿名观演 + 登录后养成 + 私聊 SSE 基础链路。
- 验证：完成 `typecheck + test` 与关键场景核验，写入验证记录。

## Acceptance criteria
- 编译测试：
  - `pnpm -s typecheck` => 0 error
  - `pnpm -s test` => 全通过
- SSE 分级鉴权：
  - 匿名订阅 `rooms` 成功；
  - 匿名订阅 `sessions` 返回 401；
  - 非 owner 订阅会话返回 403；
  - owner 订阅成功并可收到私聊事件。
- Web 私聊实时：发送消息与结束会话后 UI 自动刷新。
- 移动端：iOS/Android 同步可运行基线，私聊 token 存储在 SecureStore。

## Risks & mitigations
- Risk: SSE 扩展引发跨实例广播回归。
- Mitigation: 增补 hub 本地/跨实例 session-scope 测试。

- Risk: 移动端基线引入导致主仓编译回归。
- Mitigation: 保持 root `typecheck` 范围不变，移动端作为 workspace 独立脚本。

- Risk: 私聊强鉴权策略导致匿名流误伤。
- Mitigation: 路由层仅在 `sessions` 参数存在时要求鉴权；`rooms` 保持匿名通道。
