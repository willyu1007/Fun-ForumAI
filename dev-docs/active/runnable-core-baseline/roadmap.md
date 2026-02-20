# Goal 01 — Runnable Core Baseline Roadmap

## Goal
- 把仓库从“模板占位”升级为“可运行的最小前后端 + DB SSOT 基线”。

## Scope
- `package.json` 脚本实化（build/dev/lint/test/typecheck）。
- `src/backend/` 最小服务（health + 基础中间件）。
- `src/frontend/` 最小只读壳（首页与占位路由）。
- `prisma/schema.prisma` 与首个 migration。

## Non-goals
- 复杂业务逻辑实现。
- 聊天室与高级推荐能力。

## Phases
1. **Phase 1: Dev foundation**
   - Deliverable: 本地开发命令可用
   - Acceptance criteria: `pnpm dev`、`pnpm typecheck` 可执行
2. **Phase 2: Minimal app skeleton**
   - Deliverable: 前后端最小可跑壳
   - Acceptance criteria: `/health` 返回正常，前端可打开首页
3. **Phase 3: DB baseline**
   - Deliverable: Prisma schema + 初始 migration
   - Acceptance criteria: schema 可校验，迁移可生成

## Step-by-step plan
### Phase 0 — Discovery
- 检查现有目录占位与脚本空缺
- 确认 Node/pnpm/TS 版本兼容性

### Phase 1 — Scripts and toolchain
- 替换占位脚本
- 增加 lint/test/typecheck 的最小链路
- Verification: 关键脚本全部可运行
- Rollback: 恢复脚本到上一提交

### Phase 2 — Backend/Frontend scaffold
- 后端：建立应用入口、health 路由、错误处理基线
- 前端：建立应用入口与只读首页
- Verification: 本地启动并可访问
- Rollback: 分模块回退 scaffold 提交

### Phase 3 — Prisma baseline
- 新建 `prisma/schema.prisma`
- 生成初始 migration
- Verification: `prisma validate` / migration 命令通过
- Rollback: 回滚 migration 与 schema 变更

## Verification and acceptance criteria
- 命令：`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`
- DB: `prisma validate`、`prisma migrate dev`（本地）
- Acceptance:
  - 前后端壳可运行
  - DB SSOT 不再空壳

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 脚本改造破坏现有约定 | medium | medium | 先最小化替换并分步提交 | CI/本地命令失败 | 回退脚本变更 |
| Prisma 初始化与现有契约不一致 | medium | high | 先对齐 `db-ssot.json` | context/db 校验失败 | 回退 schema/migration |
