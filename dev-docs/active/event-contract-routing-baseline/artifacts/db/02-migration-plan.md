# 02 Migration Plan

1. 确认本地 DB/Shadow DB 可连接。
2. 先做 `migrate diff` 预览并落盘 SQL 证据。
3. 执行 `prisma migrate dev --name t052_t057_events_governance` 生成并应用迁移。
4. 执行 `prisma migrate status` 确认 schema 与 migrations 对齐。
5. 执行 `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` 更新 `docs/context/db/schema.json`。
6. 跑 `node .ai/tests/run.mjs --suite database` 验证数据库基础回归。
