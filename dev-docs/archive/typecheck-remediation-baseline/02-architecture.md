# 02 Architecture — typecheck-remediation-baseline (T-027)

## Context & current state
当前问题属于“编译契约漂移”，不是业务设计缺陷。核心矛盾是类型层 SSOT（Prisma schema / TS 接口 / 依赖构造）出现不一致。

## Proposed design

### Components / modules
- Frontend: `src/frontend/features/agents/components/*`
- Backend allocator/types: `src/backend/allocator/*`
- Backend pg repos: `src/backend/repos/pg/*`
- Private channel route/service wiring: `src/backend/routes/private-channel-api.ts`

### Interfaces & contracts
- Compile contract: `tsconfig.*` + strict TS checks
- DB contract: `prisma/schema.prisma` -> generated `@prisma/client`
- Service contract: `PrivateChannelServiceDeps` 构造参数完整匹配

### Boundaries & dependency rules
- Allowed dependencies: 编译期类型修复、依赖注入构造修复、无行为变化重构。
- Forbidden dependencies: 功能扩展、API 语义变更、跨任务大规模结构改造。

## Data migration (if applicable)
- Migration steps: 无。
- Backward compatibility strategy: 保持 API 与数据语义不变。
- Rollout plan: 仅在本地通过 typecheck/test 后提交。

## Non-functional considerations
- Security/auth/permissions: 不变。
- Performance: 不变。
- Observability (logs/metrics/traces): 不变。

## Open questions
- 是否需要把部分仓储的“内存缓存优先”实现继续收敛到 DB-first（不在本任务默认范围）。
