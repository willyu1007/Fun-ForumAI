# 03 Implementation Notes — T-056

## 2026-03-05
- 新增 RoleAssignment 仓储与类型：
  - `src/backend/repos/role-assignment-repository.ts`
  - `src/backend/repos/pg/pg-role-assignment-repository.ts`
  - `src/backend/repos/types/governance.ts`
- 新增服务：
  - `src/backend/services/role-assignment-service.ts`
  - 支持 assign/update，并发出 `ROLE_ASSIGNED/ROLE_REVOKED/ROLE_EXPIRED` 事件。
- 控制面 API：
  - `POST /v1/communities/:id/role-assignments`
  - `PATCH /v1/communities/:id/role-assignments/:assignmentId`
- 读取 API：
  - `GET /v1/posts/:postId/aside-seats`
- allocator 集成：
  - `src/backend/container/allocator.ts`
  - 在 `roleAssignmentV1` 开启时，仅允许 post scope aside seats 在该 post 进入候选池。

## 2026-03-05（T-056 深度核查补强）
- 修复跨社区越界更新：
  - `PATCH /v1/communities/:communityId/role-assignments/:assignmentId` 传递 `community_id` 到 service。
  - service 内新增 assignment 所属社区一致性校验，不一致返回 `404 NOT_FOUND`。
- 修复 `scope=COMMUNITY` 语义漂移：
  - `assign` 新增校验 `scope_id === community_id`，不满足返回 `400 VALIDATION_ERROR`。
- 引入 Membership 强约束：
  - `RoleAssignmentService` 注入 `membershipRepo`。
  - assign 前要求 `findCurrent(agent, community)` 且状态必须为 `ACTIVE`；否则返回 `409 CONFLICT`。
- 新增自动过期与审计事件：
  - repo 增加 `listDueForExpiration(now, limit)`（内存 + Pg）。
  - service 增加 `processDueExpirations`，将到期 assignment 从 `ACTIVE` 转 `EXPIRED`。
  - 过期事件写入 `ROLE_EXPIRED`，`actor_type=system`、`actor_id=role-expiry-scheduler`，并携带幂等键 `role-expired:<assignment_id>`。
  - 新增 `RoleAssignmentExpiryScheduler` 并接入 container/app/server 生命周期。
  - 新增配置：
    - `ROLE_ASSIGNMENT_EXPIRY_INTERVAL_MS`（默认 30000）
    - `ROLE_ASSIGNMENT_EXPIRY_STARTUP_DELAY_MS`（默认 5000）
    - `ROLE_ASSIGNMENT_EXPIRY_BATCH_LIMIT`（默认 100）
- 新增/扩展测试覆盖：
  - e2e：跨社区 patch 404、COMMUNITY scope mismatch 400、BANNED membership 409。
  - scheduler 单测：到期转 EXPIRED 且只发一次 `ROLE_EXPIRED`。
  - 事件路由单测：`ROLE_ASSIGNED/ROLE_REVOKED/ROLE_EXPIRED` 走 CONTROL 且不入 allocator。
- Pg 全量 e2e 稳定性修复：
  - e2e helper 增加 `createTestCommunity()`，优先使用 `createPersisted` 避免持久化竞争。
  - 新增 `scripts/e2e-pg-isolated.mjs` 与 `pnpm test:e2e:pg:isolated`，采用“隔离数据库 + 自动清理”回归。

## 2026-03-05（代码质量修复）
- 修复到期迁移并发覆盖风险（CAS）：
  - `UpdateRoleAssignmentInput` 增加 `expected_status`。
  - InMemory/Pg `roleAssignmentRepo.update` 支持按 `id + expected_status` 条件更新；条件不满足返回 `null`。
  - `RoleAssignmentService.update` 将 `expected_current_status` 下推到仓储层，失败时返回最新状态而不是盲写。
- 修复 `ROLE_EXPIRED` 幂等键过于粗粒度：
  - 由 `role-expired:<assignment_id>` 调整为 `role-expired:<assignment_id>:<updated_at_ms>`，支持 re-activate 后再次过期审计。
- 收紧 Pg 隔离脚本行为：
  - `scripts/e2e-pg-isolated.mjs` 移除默认 `db push` fallback，迁移失败直接失败，避免假阳性。
- 补齐高优先级测试缺口：
  - control-plane e2e 新增非 admin 调 role-assignment 控制面返回 `403`。
  - control-plane e2e 新增 `MUTED/LEFT/无 membership` assign 返回 `409`。
  - read-api e2e 新增“过期处理后 aside seats 不再可见 + assignment 状态为 EXPIRED + ROLE_EXPIRED 事件存在”。
  - scheduler 单测新增“re-activate 后再次过期会产生新的 ROLE_EXPIRED 事件（幂等键不同）”。
