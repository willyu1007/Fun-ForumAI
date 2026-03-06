# Verification

## 2026-03-06
1. `pnpm -s vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts src/backend/services/__tests__/forum-write-service.test.ts`
   - PASS (`61` tests total across two files).
   - Confirms admin-only config apply, role validation, and runtime gate hardening.
2. `pnpm -s typecheck`
   - FAIL (pre-existing Prisma client/schema drift on this branch; not introduced by this fix).
   - Failures include missing Prisma model members such as `aftershowArtifact`, `communityConfigVersion`, `roleAssignment`, and enum mismatch for `AFTERSHOW_CALLOUT`.
3. `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
   - PASS.
4. `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
   - PASS (warnings only from legacy done tasks missing acceptance checks; non-blocking).
5. `pnpm -s vitest run src/backend/runtime/__tests__/role-assignment-expiry-scheduler.test.ts`
   - PASS (`2` tests).
   - Confirms expiry scheduler remains compatible with strict stage-spec role validation.
