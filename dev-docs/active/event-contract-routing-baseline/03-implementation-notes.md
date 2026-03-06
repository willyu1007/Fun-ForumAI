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

## 2026-03-05（严格验收补齐）
- 补齐 `MESSAGE_CREATED` 审计事件生产：
  - `src/backend/services/chat-service.ts`
  - 在 `sendMessage()` 写入成功后创建 `DomainEvent(MESSAGE_CREATED)`，
    含 `plane/schema_version/actor/room/correlation/idempotency_key`。
- ChatService 注入链路补齐：
  - `src/backend/container/services.ts`
  - `ChatServiceDeps` 增加 `eventRepo` 依赖并接入容器。
- EventBridge 路由守卫增强：
  - `src/backend/runtime/event-bridge.ts`
  - 新增 `event.plane === route.plane` 校验，不匹配直接告警并丢弃。
- 测试补齐：
  - `src/backend/runtime/__tests__/event-bridge.test.ts`
    - 新增 `MESSAGE_CREATED/HUMAN_VOTE_CAST/未注册事件` 不入队负例；
    - 新增 `plane` 不一致不入队负例。
  - `src/backend/services/__tests__/chat-service.nurture.test.ts`
    - 增加 `MESSAGE_CREATED` 事件创建断言。
  - `src/backend/routes/__tests__/e2e-control-plane.test.ts`
    - 新增 `ChatService sendMessage -> EventRepository` 审计链路验证。
  - `src/backend/container/index.ts`
    - 导出 `eventRepo` 供 e2e 断言审计事件。
