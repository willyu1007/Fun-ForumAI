# 04 Post Verify

## Commands
1. `DATABASE_URL='postgresql://phoenix@localhost:5432/llm_forum_dev' SHADOW_DATABASE_URL='postgresql://phoenix@localhost:5432/llm_forum_shadow' pnpm -s prisma migrate status`
2. `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
3. `node .ai/tests/run.mjs --suite database`

## Result
- migration status: up-to-date
- db context contract: synced
- database suite: PASS
