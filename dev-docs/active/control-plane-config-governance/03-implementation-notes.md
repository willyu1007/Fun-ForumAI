# 03 Implementation Notes — T-054

## 2026-03-05
- 配置治理仓储与类型升级：
  - `src/backend/repos/community-config-repository.ts`
  - `src/backend/repos/pg/pg-community-config-repository.ts`
  - `src/backend/repos/types/governance.ts`
- 状态机升级：
  - `src/backend/services/community-config-service.ts`
  - `createProposal` 默认 `PROPOSED`
  - `validateProposal` 分流为 `VALIDATED` / `REJECTED`，并发 `COMMUNITY_CONFIG_VALIDATED` / `COMMUNITY_CONFIG_VALIDATION_FAILED`
  - `approveProposal` 与 `rejectProposal` 分离
  - `applyProposal` 支持 `effective_at` -> `SCHEDULED`
  - `processDueScheduled` 支持重试上限与退避，失败写 `COMMUNITY_CONFIG_APPLY_FAILED`
  - apply 后写 `COMMUNITY_CONFIG_ACTIVATED`
- API 切换为文档路径（移除旧路径）：
  - `GET /v1/communities/:id/config`
  - `POST /v1/communities/:id/config/proposals`
  - `POST /v1/communities/:id/config/proposals/:proposalId/validate`
  - `POST /v1/communities/:id/config/proposals/:proposalId/approve`
  - `POST /v1/communities/:id/config/proposals/:proposalId/reject`
  - `POST /v1/communities/:id/config/apply`
  - `POST /v1/communities/:id/config/rollback`
  - `GET /v1/communities/:id/config/history`
- 新增调度器：
  - `src/backend/runtime/community-config-scheduler.ts`
  - 接入 `container/index.ts`、`container/infra.ts`、`app.ts`、`server.ts`
- DevToken 外键修复：
  - `human-auth` 增加 dev token identity sync hook
  - `AuthService.ensureDevIdentity` + `PgUserRepository.upsertDevIdentity`
  - 解决 `DB_PERSISTENCE=true` 下 `proposed_by_user_id` FK 500
- 迁移与事件对齐：
  - `prisma/schema.prisma` 与 `prisma/migrations/20260305162000_t054_control_plane_full_alignment/migration.sql`
  - 旧事件名映射到 `ACTIVATED / VALIDATION_FAILED / REJECTED`

## 2026-03-05（代码质量复检修复）
- 修复 proposal 跨社区访问漏洞：
  - `src/backend/services/community-config-service.ts`
    - `validate/approve/reject/apply` 新增 `community_id` 入参并校验 patch 归属社区
  - `src/backend/routes/stage-incubation.ts`
    - `:communityId` 全部透传到 service，避免仅按 `proposal_id` 操作
- 收紧配置提案状态机：
  - `validateProposal` 仅允许 `PROPOSED -> VALIDATED|REJECTED`
  - `approveProposal` 仅允许 `VALIDATED -> APPROVED`
  - `rejectProposal` 仅允许 `PROPOSED|VALIDATED -> REJECTED`
- 补充负向 E2E 覆盖：
  - `src/backend/routes/__tests__/e2e-control-plane.test.ts`
    - 新增跨社区 proposal 操作应 404
    - 新增非法状态迁移（未 validate 直接 approve、REJECTED 后 revalidate/reapprove）应 400
