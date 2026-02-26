# 03 Implementation Notes — app-adaptation-discussion (T-028)

## Status
- Current status: `in-progress`
- Last updated: 2026-02-26

## What changed

### M1 — 文档与边界收敛
- 更新了 `00-overview/01-plan/02-architecture/roadmap`，将任务由“讨论”切换为“实施”，并固化 A 认证 + 分级 SSE 边界。

### M2 — 后端 SSE 分级鉴权与 session scope
- `src/backend/middleware/human-auth.ts`
  - 新增 `tryAuthenticateHuman(req)` 可选鉴权能力。
  - `requireHumanAuth` 改为复用统一 token 解析逻辑。
- `src/backend/routes/sse.ts`
  - `GET /events/stream` 新增 `sessions` 参数解析。
  - 当存在 `sessions` 订阅时：
    - 要求身份认证（无身份 401）；
    - 逐个校验 session owner（非 owner 403）。
  - `rooms` 订阅保持匿名可用。
- `src/backend/sse/contracts.ts`
  - 扩展 `SseBroadcastScope`：`global | room | session`。
  - 广播 envelope 新增 `session_id`。
- `src/backend/sse/hub.ts`
  - 新增 session 订阅索引与 `broadcastToSession`。
  - 扩展 cluster fanout 支持 `session` scope。
  - stats 新增 `subscribed_sessions`。
- `src/backend/sse/__tests__/hub.test.ts`
  - 新增 session-scope 本地与跨实例 fanout 用例。

### M3 — 私聊事件生产与 Web 消费
- `src/backend/services/private-channel-service.ts`
  - 在 `sendMessage` 中为 HUMAN/AGENT 消息分别推送 `PRIVATE_MESSAGE_CREATED`。
  - 在 `endSession` 推送 `PRIVATE_SESSION_ENDED`。
  - 通过新增可选依赖注入 `sseHub` 输出 session 作用域事件。
- `src/backend/container.ts`
  - 在 `PrivateChannelService` 构造注入 `sseHub`。
- `src/frontend/features/private-chat/hooks/use-private-session-sse.ts`（新增）
  - 订阅 `sessions=<sessionId>`，收到私聊事件后触发 query invalidation。
- `src/frontend/features/private-chat/pages/PrivateChatPage.tsx`
  - `ChatThread` 接入 `usePrivateSessionSse`。
- `src/frontend/features/admin/components/RuntimeDashboard.tsx`
  - 运行态面板显示 `subscribed_sessions`。

### M4/M5 — 单仓移动端基线与 P1 链路
- 新增 `pnpm-workspace.yaml`，纳入 `apps/*`。
- `package.json` 增加脚本：
  - `mobile:dev`
  - `mobile:dev:ios`
  - `mobile:dev:android`
  - `mobile:typecheck`
  - `mobile:test`
- 新增 `apps/mobile` Expo baseline：
  - `apps/mobile/package.json`
  - `apps/mobile/app.json`
  - `apps/mobile/tsconfig.json`
  - `apps/mobile/App.tsx`
  - `apps/mobile/src/api/client.ts`
  - `apps/mobile/src/api/types.ts`
  - `apps/mobile/src/auth/token-store.ts`
  - `apps/mobile/src/realtime/sse.ts`
  - `apps/mobile/src/types/react-native-sse.d.ts`
- P1 页面链路（原型）已覆盖：
  - 匿名观演：Feed/社区/房间列表与详情消息
  - 登录后养成：我的 Agent、创建 Agent、成长视图
  - 私聊：会话列表、消息发送、结束会话
  - 实时：房间 SSE（匿名）+ 私聊 SSE（Bearer）

## Decisions & tradeoffs
- 决策：私聊订阅鉴权在 SSE 路由层按参数触发，而非全局强鉴权。
- 理由：保留匿名观演链路，同时满足私聊数据隔离。
- 取舍：`tryAuthenticateHuman` 对公共流采用“可选鉴权”，避免公开订阅被过期 token 误伤。

## Deviations from plan
- 无实质偏离。

## Known issues / follow-ups
- `apps/mobile` 当前为 P1 原型基线，UI/导航与模块化拆分在 P2 继续增强。
- `mobile:test` 目前为占位脚本（`No mobile tests yet`），需在后续任务补齐自动化。
- E2E 冒烟中发现的两项问题已在本轮闭环：
  - `/v1/auth/*` 被私聊全局鉴权误拦截（401）已修复。
  - 私聊审计写入偶发 `agent_runs_trigger_event_id_fkey` 已修复。

### Post-smoke remediation — 认证路由与私聊审计持久化顺序
- `src/backend/routes/private-channel-api.ts`
  - 移除全局 `privateChannelRouter.use(requireHumanAuth)`。
  - 改为在私聊相关每个 endpoint 上显式应用 `requireHumanAuth`，避免误伤 `/v1/auth/*`。
- `src/backend/app.ts`
  - 调整路由挂载顺序：`auth` 路由在 `privateChannelRouter` 前挂载，确保注册/登录公开入口优先匹配。
- `src/backend/repos/pg/pg-event-repository.ts`
  - 增加进程内 `pendingEventWrites`，在写入 `agent_run` 前等待对应 `event` 持久化完成，消除 FK 时序竞争。
  - 保持既有业务语义不变，仅修复持久化顺序一致性。

## Pitfalls / dead ends (do not repeat)
- 已在 `05-pitfalls.md` 追加一次“workspace 依赖未安装导致 mobile:typecheck 失败”的记录。
