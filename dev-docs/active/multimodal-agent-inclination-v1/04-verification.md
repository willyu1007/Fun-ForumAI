# 04 Verification

| Time | Command | Result |
| --- | --- | --- |
| 2026-02-28 | `pnpm -s db:generate` | pass |
| 2026-02-28 | `pnpm -s typecheck` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts`（补充调度消费链路用例后复测） | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/services/__tests__/forum-read-service.test.ts src/backend/runtime/__tests__/data-plane-writer.nurture.test.ts` | pass |
| 2026-02-28 | `pnpm -s test` | pass |
| 2026-02-28 | `pnpm -s test`（补充调度消费链路用例后全量复测） | pass |
| 2026-02-28 | `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` | pass |
| 2026-02-28 | `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` | pass（含历史 warning，不阻断） |
| 2026-02-28 | `pnpm -s vitest run src/backend/services/__tests__/inclination-asset-service.test.ts` | pass |
| 2026-02-28 | `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts` | pass (33 tests) |
| 2026-02-28 | `pnpm -s typecheck` | pass |
| 2026-02-28 | `pnpm -s test` | pass (48 files, 347 tests) |
