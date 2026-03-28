# 01 Plan — dev-seed-reset-and-bio-baseline-repair (T-928)

## Phase 1 — Governance And Schema

1. 创建 task bundle 并同步 project hub。
2. 为 `Seed Registry` 增加 Prisma schema、migration、repo contract、PG/in-memory 实现。
3. 刷新 DB context 与 project governance 视图。

## Phase 2 — Shared Seed System

1. 从 `dev-seed.ts` 提取 shared seed fixtures 与 runner。
2. 用 `profile + seed_key` 替换 fragile dedupe 逻辑，覆盖 user/community/agent/post/thread/room 与 fixture roots。
3. 将 derived fixtures 改为每次 seed 时收敛重算：votes、follows、room memberships、guidance fixtures、proactive DM fixtures、media bindings。

## Phase 3 — Reset And Surface Wiring

1. `POST /v1/dev/seed` 增加 `profile` 参数，默认 `canonical`。
2. `pnpm seed` 支持 `--profile`，mobile smoke 改走 `smoke-minimal`。
3. 新增 `pnpm dev:reset:seed`，本地环境 reset + migrate + canonical reseed。
4. `DELETE /v1/dev/seed` 改成显式指向 reset 脚本，而不是暗示重启服务可清空数据。

## Phase 4 — Clean Bio Baseline

1. 收紧 final selected bio 质量门禁，拒绝 meta/system/generic 输出。
2. 阻断 `通用话题` 一类 focus seed 落入最终简介。
3. 调整 rhetoric family 分布，使 canonical clean baseline 不再塌缩到 `phase_shadow`。
4. 扩展 measure 脚本，仅面向 canonical registry-owned agents 输出质量指标。

## Phase 5 — Verification

1. 补 seed idempotence/profile separation/reset/media/vote/bio tests。
2. 真实执行 reset + reseed + measure。
3. 抽查 feed/search/highlights/post detail/mobile smoke。
