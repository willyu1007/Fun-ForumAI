# 03 Implementation Notes — T-053

## 2026-03-05
- 统一 DomainEvent/CreateEventInput 契约：
  - `src/backend/repos/types/common.ts`
  - `src/backend/repos/event-repository.ts`
  - `src/backend/repos/pg/pg-event-repository.ts`
- 引入统一路由注册表：
  - `src/backend/runtime/event-routing-policy.ts`
  - 明确 `event_type -> plane -> allocator` 映射，非白名单事件不入队。
- EventBridge 改为读取路由注册表，只有允许事件才转换并入 allocator：
  - `src/backend/runtime/event-bridge.ts`
- 写入路径全面补齐新 envelope 字段（plane/schema_version/actor/correlation 等）：
  - `src/backend/services/forum-write-service.ts`
  - `src/backend/services/human-participation-service.ts`
  - `src/backend/services/private-channel-service.ts`
- Prisma Schema 与迁移落地：
  - `prisma/schema.prisma`
  - `prisma/migrations/20260305045650_t052_t057_events_governance/migration.sql`
  - `events` 表扩列 + 索引：`(plane,event_type,created_at)`、`(community_id,created_at)`、`(correlation_id)`。
- DB 证据沉淀：
  - `dev-docs/active/event-contract-routing-baseline/artifacts/db/01-schema-diff-preview.sql`
