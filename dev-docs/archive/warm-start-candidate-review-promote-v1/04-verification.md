# 04 Verification

## Final Verification Summary

- `pnpm exec vitest run src/backend/services/__tests__/warmup-governance-service.test.ts`
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
- `pnpm prisma validate`
- `pnpm prisma generate`
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- `pnpm exec tsc -p tsconfig.node.json --noEmit 2>&1 | rg "warmup-governance-service|launch-warm-start|admin-warm-start-routes|warmup-governance-repository"`

## Verified Outcome

- candidate 内容在 activation 前保持 `PENDING + GRAY + NO_RECOMMEND`，公开读面不可见
- `reviewSuite(pass_to_active)` 会激活 kickoff + warmup 两层并创建唯一 current baseline
- `retrySuite()` 保持幂等，不重复创建 baseline
- `archiveSuite()` 不会自动回退 previous baseline
- suite list/detail、reason codes、review/retry/rebuild/archive contract 已成为下游稳定上游
