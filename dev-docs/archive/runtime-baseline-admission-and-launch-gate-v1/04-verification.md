# 04 Verification

## Final Verification Summary

- `pnpm exec vitest run src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
- `pnpm exec vitest run src/backend/services/__tests__/warmup-governance-service.test.ts`
- `pnpm exec tsc -p tsconfig.node.json --noEmit 2>&1 | rg "runtime-loop|admin-runtime-routes|launch-warm-start|validation/schemas"`
- `node scripts/launch-home-playwright-smoke.mjs --url http://localhost:4101`
- `LAUNCH_WEB_BASE_URL=http://localhost:4101 LAUNCH_WORKER_BASE_URL=http://localhost:4101 LAUNCH_ADMIN_TOKEN=... pnpm verify:launch:staging`

## Verified Outcome

- `RuntimeLoop` 在无 active baseline 时 fail-close；有 fresh active baseline 时允许自治 public growth
- warm-up top-up 通过 `warmup_context` 继承 `warm_start_batch_id` 与 `generation_mode=warmup_topup_candidate`
- `verify:launch:staging`、runtime stats、runbook 使用同一 activation 口径
- local-kind live gate 已验证 `allow_public_growth=true` 时 `24/24 passed`
