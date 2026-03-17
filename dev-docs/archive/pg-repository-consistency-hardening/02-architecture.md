# 02 Architecture

## Context & current state
- Pg 仓储当前模式：`hydrate()` 全量加载 -> 内存 Map 主读 -> 异步 Prisma 写库。
- 该模式对单进程友好，但横向扩容会出现实例间状态漂移。

## Proposed design

### Components / modules
- Repository Query Layer（DB-first）
- Mapping Layer（Prisma row -> domain entity）
- Optional Cache Layer（仅在确认需要后引入，且必须有失效策略）

### Interfaces & contracts
- API endpoints:
  - 维持现有 REST 路由契约，不引入 breaking change。
- Data models / schemas:
  - 以现有 Prisma schema 为主；必要时只增索引不改业务字段。
- Events / jobs (if any):
  - 无新增异步 job；仓储行为同步读写数据库。

### Boundaries & dependency rules
- Allowed dependencies:
  - service -> repository interface
  - repository impl -> Prisma client
- Forbidden dependencies:
  - service 依赖具体 Pg repository 内部缓存
  - route 直接访问 Prisma

## Data migration (if applicable)
- Migration steps:
  - 如需索引优化，通过 Prisma migration 执行。
- Backward compatibility strategy:
  - API DTO 保持兼容，行为变更通过测试覆盖。
- Rollout plan:
  - 先 staging 多实例验证，再灰度到 prod。

## Non-functional considerations
- Security/auth/permissions:
  - 无新增鉴权面；保持现有中间件边界。
- Performance:
  - 重点关注 feed、comments、room messages 查询路径。
- Observability (logs/metrics/traces):
  - 增加慢查询日志与仓储延迟指标。

## Open questions
- 是否需要读写分离（主从）来承载查询压力？
- 是否对热点列表启用短 TTL 缓存？
