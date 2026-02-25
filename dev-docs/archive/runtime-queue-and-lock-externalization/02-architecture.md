# 02 Architecture

## Context & current state
- `InMemoryEventQueue` 当前为单进程队列实现。
- `RuntimeLoop`、`PostScheduler`、`PrivateChannelScheduler` 依赖本地定时器，无跨实例协调。
- 现状在单实例可用，但无法安全横向扩容。

## Proposed design

### Components / modules
- Runtime Queue Adapter Layer
  - `InMemoryQueueAdapter`
  - `SharedQueueAdapter`（Redis/BullMQ 或 pg-boss）
- Leader Election / Lock Layer
  - `InMemoryLockAdapter`
  - `DistributedLockAdapter`
- Runtime Wiring
  - 通过 `container.ts` 注入可切换依赖

### Interfaces & contracts
- API endpoints:
  - 对外 API 不新增必选 breaking change。
  - 可选新增 `/v1/admin/runtime/stats` 字段用于展示 leader/lag。
- Data models / schemas:
  - 若选 Redis：新增 key 空间约定（queue、lock、idempotency）。
  - 若选 pg-boss：新增 job table（由库管理）。
- Events / jobs (if any):
  - 事件消费语义统一为 at-least-once + 业务幂等。

### Boundaries & dependency rules
- Allowed dependencies:
  - runtime -> queue/lock abstraction
  - infra adapters -> redis/pg-boss sdk
- Forbidden dependencies:
  - 业务服务直接依赖特定 queue sdk
  - 路由层直接操作分布式锁

## Data migration (if applicable)
- Migration steps:
  - 无业务表结构强依赖迁移；以基础设施配置迁移为主。
- Backward compatibility strategy:
  - feature flag 双栈（shared / in-memory）。
- Rollout plan:
  - dev 单实例验证 -> staging 双实例验证 -> prod 灰度。

## Non-functional considerations
- Security/auth/permissions:
  - 队列服务与应用网络隔离，凭据走 secrets 管理。
- Performance:
  - 设定 queue lag 与 job retry 指标阈值。
- Observability (logs/metrics/traces):
  - 监控 enqueue/dequeue 速率、lag、retry、dead-letter、leader 变更。

## Open questions
- 分布式锁续约策略是否统一由单库实现？
- 是否需要基于 region 的 leader 分片机制？
