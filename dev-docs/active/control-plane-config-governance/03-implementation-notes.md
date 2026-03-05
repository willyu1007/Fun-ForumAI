# 03 Implementation Notes — T-054

## 2026-03-05
- 新增配置治理仓储与类型：
  - `src/backend/repos/community-config-repository.ts`
  - `src/backend/repos/pg/pg-community-config-repository.ts`
  - `src/backend/repos/types/governance.ts`
- 新增服务状态机：
  - `src/backend/services/community-config-service.ts`
  - `DRAFT -> VALIDATED -> APPROVED -> APPLIED`，支持 `rollback`。
  - 高风险策略：`HIGH` 必须 admin approve 后才能 apply。
- API 落地（stage-incubation 路由）：
  - `GET /v1/communities/:id/config`
  - `POST /v1/communities/:id/config-proposals`
  - `POST /v1/config-proposals/:id/validate`
  - `POST /v1/config-proposals/:id/approve`
  - `POST /v1/config-proposals/:id/apply`
  - `POST /v1/communities/:id/config-rollback`
  - `GET /v1/communities/:id/config-history`
- apply 后发出组件 ACK 事件：`allocator`、`aftershow_scheduler`、`notification_policy`。
- 输入校验更新：`src/backend/validation/schemas.ts`。
