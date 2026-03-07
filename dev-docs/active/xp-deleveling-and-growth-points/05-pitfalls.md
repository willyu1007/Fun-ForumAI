# 05 Pitfalls — xp-deleveling-and-growth-points

## Usage
仅记录“已解决”的失败、弯路和防再犯结论；不要记录当前未解决事项。

## Placeholder template
### <pitfall title>
- Symptom:
  - <what failed>
- Root cause:
  - <why>
- What was tried:
  - <attempts>
- Fix / workaround:
  - <final fix>
- Prevention note:
  - <how to avoid repeating>

## Expected pitfalls to watch
1. legacy growth event parsing mismatch
- 关注旧 description 解析 `source` / `dedup_key` 失败导致的迁移脏数据。

2. double-grant in stats sync
- 关注 `granted_points_total` 与 `unspent_points` 不一致导致的重复补点。

3. hidden mobile type dependency on level fields
- 关注 mobile API types 或导航页面仍引用 `level` / `trait_slots` / `instruction_slots`。

### Historical migration not replay-safe on local dev DB
- Symptom:
  - `pnpm db:migrate:deploy` 在本地 `llm_forum_dev` 上被 `P3009/P3018` 阻断，失败 migration 为 `20260305045650_t052_t057_events_governance`。
  - 初始报错为 `index "agent_community_memberships_active_unique_idx" does not exist`；回滚重试后又报 `type "AftershowArtifactStatus" already exists`。
- Root cause:
  - 这条历史 migration 在本地库上发生过“部分执行后失败”，留下 `_prisma_migrations` 失败记录和一部分已创建对象。
  - migration SQL 中早期语句不是幂等写法，包含直接 `DROP INDEX`、`CREATE TYPE` 和 `ALTER TYPE ADD VALUE`。
- What was tried:
  - 先只把 `DROP INDEX` 改成 `DROP INDEX IF EXISTS`，并用 `prisma migrate resolve --rolled-back` 让 Prisma 允许重试。
  - 随后发现前一次失败前创建的 enum 会导致第二次重试卡在 `type already exists`。
- Fix / workaround:
  - 将该 migration 的前置 DDL 全部改为可重放：
    - `DROP INDEX IF EXISTS ...`
    - `CREATE TYPE ...` 包进 `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
    - `ALTER TYPE ... ADD VALUE IF NOT EXISTS ...`
  - 再执行 `prisma migrate resolve --rolled-back 20260305045650_t052_t057_events_governance`，随后 `pnpm db:migrate:deploy` 成功。
- Prevention note:
  - 对历史 migration 做本地 replay 时，不能假设 dev DB 总是“全新库”。
  - 含 enum/index 的 migration 在可预见会重放的本地环境里，应优先写成幂等或至少先在已有数据的 dev DB 上演练一次。

### Prisma client stale after schema rename
- Symptom:
  - 持久化模式下，`/v1/agents/:agentId/xp` 与 `/dashboard` 运行时 500，日志显示 `Cannot read properties of undefined (reading 'findUnique'/'upsert')`。
  - `XpService` 中访问 `prisma.agentXp` / `prisma.xpEvent` 时，delegate 为 `undefined`。
- Root cause:
  - 数据库和 `schema.prisma` 已迁到 `AgentXp/XpEvent`，但本地 `@prisma/client` 生成物仍停留在旧 `AgentGrowth/GrowthEvent`。
  - 因此 runtime client 暴露的是 `agentGrowth/growthEvent`，而不是新 delegate 名。
- What was tried:
  - 先检查 backend 环境变量，确认不是 `DB_PERSISTENCE` 关闭导致的内存模式。
  - 再用 `tsx` 直接打印 `getPrismaClient()` 的 delegate 名，确认 client 生成物过旧。
- Fix / workaround:
  - 执行 `pnpm exec prisma generate`，然后完全重启 backend 进程。
  - regenerate 后再次检查，delegate 已切换为 `agentXp/xpEvent`，HTTP smoke 恢复正常。
- Prevention note:
  - 只改 `schema.prisma` 和 migration 不够；凡是 Prisma model 重命名，都必须把 `prisma generate` 放进本地验证清单。
  - 运行态出现“delegate undefined”时，先检查生成物是否与 schema 同步，不要误判成业务逻辑错误。
