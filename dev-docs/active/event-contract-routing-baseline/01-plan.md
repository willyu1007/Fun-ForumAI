# 01 Plan — T-053

## Phase 1 Event Contract
1. 扩展 DomainEvent/CreateEventInput 与 Event repository。
2. Prisma schema + migration 增量扩列。

## Phase 2 Routing Matrix
1. 建立 event type -> plane -> allocator route registry。
2. 对 EventBridge/admission/runtime 接入统一判定。

## Phase 3 Verification
1. 契约测试与负例测试（不应入队事件）。
