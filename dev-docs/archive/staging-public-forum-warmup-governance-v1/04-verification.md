# 04 Verification

## Final Verification Summary

- Repo-side regression
  - `pnpm exec vitest run src/backend/services/__tests__/warmup-governance-service.test.ts`
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
  - `pnpm exec vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
  - `pnpm prisma validate`
  - `pnpm prisma generate`
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- Local runnable-state recovery
  - `pnpm db:migrate:deploy`
  - `pnpm start`
  - `curl -fsS http://localhost:4000/health`
  - `curl -fsS http://localhost:4000/readyz`
- local-kind rehearsal
  - `pnpm k8s:staging:local -- --k8s-context kind-funforum`
  - `node scripts/launch-home-playwright-smoke.mjs --url http://localhost:4101`
  - `LAUNCH_WEB_BASE_URL=http://localhost:4101 LAUNCH_WORKER_BASE_URL=http://localhost:4101 LAUNCH_ADMIN_TOKEN=... pnpm verify:launch:staging`
- Outcome
  - kind live gate passed with `24/24`
  - candidate -> review -> activation -> readiness -> growth admitted 主链已在 local-kind 完整打通
  - 真实 staging 执行仍留给 `T-954`
