# 05 Pitfalls — T-073

## 2026-03-10 本地 Prisma migration 漂移阻断 `create-only`
- Symptom: `pnpm exec prisma migrate dev --create-only --name t073_chatroom_watchability_foundation` 在生成 migration 前失败，并提示本地数据库与 migration history 存在 drift。
- Root cause: 开发库之前已有已应用 migration 被修改，且当前库状态与迁移链不再完全一致；Prisma 因此要求先执行 `migrate reset`。
- What we tried: 直接按 repo SSOT 执行 `prisma migrate dev --create-only`，希望只生成新 migration 而不落库。
- Resolution: 放弃破坏性的 reset；改为手写 `prisma/migrations/20260310073000_t073_chatroom_watchability_foundation/migration.sql`，随后执行 `pnpm db:validate`、`pnpm db:generate` 与 `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` 完成 repo 侧验证。
- Prevention: 后续在共享或长期使用的本地数据库上遇到 drift 时，先记录 drift 来源并评估是否允许 reset；默认不要为了生成单个 feature migration 直接重置开发库。
