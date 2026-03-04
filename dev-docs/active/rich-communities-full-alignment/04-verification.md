# 04 Verification

## Commands
1. `pnpm -s db:generate`
2. `pnpm -s typecheck`
3. `pnpm -s stage:templates:validate`
4. `pnpm -s stage:templates:export`
5. `DATABASE_URL=postgresql://$USER@localhost:5432/llm_forum_mig_verify_t051 pnpm -s db:migrate:deploy`
6. `pnpm -s test src/backend/services/__tests__/incubation-orchestrator.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/aftershow-service.test.ts src/backend/stage/__tests__/stage-spec.test.ts src/backend/routes/__tests__/e2e.test.ts`
7. `pnpm -s test` (run #1)
8. `pnpm -s test` (run #2)
9. `pnpm -s test` (run #3)

## Result
1. Prisma client 生成成功，类型检查通过。
2. stage template 校验/导出通过。
3. 新增 migration `20260304100000_t051_rich_communities_full_alignment` 在干净库全量 apply 成功。
4. 关键目标测试通过：
   - `stage-spec` 兼容解析
   - `incubation-orchestrator`
   - `forum-write-service` trust gate
   - `aftershow-service` summary bridge & permission
   - `routes/e2e` 新增权限用例
5. 全量测试连续 3 次通过（无 follow/unfollow 和 feature flag 污染波动失败）。
