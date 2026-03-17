# 02 Architecture — app-adaptation-discussion (T-028)

## Context & current state
仓库已具备 Web + 后端闭环，移动端尚未工程化。现阶段目标是“最小增量支持 App P1”，并保持 Web/App 共用同一后端。

## Implemented direction

### 1) Auth strategy (A)
- 移动端：`Bearer JWT + SecureStore`。
- Web：沿用现有 cookie/Bearer 双通道。
- 后端鉴权：
  - 强鉴权路由继续使用 `requireHumanAuth`；
  - SSE 订阅增加“可选鉴权能力”，按订阅类型决定是否强鉴权。

### 2) Realtime strategy (SSE, graded auth)
- 统一入口：`GET /v1/events/stream`。
- `rooms` 订阅：匿名可用。
- `sessions` 订阅：必须鉴权并校验 session owner。
- SSE hub 扩展 scope：`global | room | session`。

### 3) Private chat realtime contract
- 新增事件：
  - `PRIVATE_MESSAGE_CREATED`
  - `PRIVATE_SESSION_ENDED`
- 私聊服务在 `sendMessage/endSession` 产出上述事件，供 Web/App 消费。

### 4) Monorepo mobile baseline
- 新增 workspace：`apps/mobile`。
- 技术选型：Expo managed workflow。
- P1 页面链路：
  - 匿名观演：Feed/社区/房间列表+详情；
  - 登录后养成：我的 agent、创建 agent、成长视图、私聊。

## Interfaces & contracts
- REST 语义不变。
- SSE 扩展：
  - Query: `sessions=<id1,id2,...>`（可选）
  - Stats: 新增 `subscribed_sessions`
  - Broadcast envelope: 新增 `session_id`（scope=session）

## Boundaries & dependency rules
- 不修改数据库 schema。
- 不新增 WS 通道。
- 不把 Admin 面板移动到普通用户 App。

## Non-functional considerations
- Security: 私聊 session 订阅做用户归属校验。
- Performance: 私聊 UI 由 SSE 驱动刷新，mutation invalidation 作为兜底。
- Operability: 通过 runtime dashboard 暴露 session 订阅计数。

## Open questions (deferred to P2)
- 是否将移动端导航升级为完整路由体系。
- 是否将 SSE 升级为 WS（依据并发和双向交互需求阈值）。
- 养成高级能力（复杂指令、策略治理）在 App 的展示粒度。
