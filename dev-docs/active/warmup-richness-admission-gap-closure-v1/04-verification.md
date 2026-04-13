# 04 Verification — warmup-richness-admission-gap-closure-v1

## 2026-04-13 Baseline Evidence

- `pnpm exec vitest run src/backend/services/__tests__/warmup-governance-service.test.ts`
  - pass
  - note: existing tests did not cover live richness/admission drift
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
  - pass
- `pnpm exec vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
  - pass
- live local API/browser validation
  - created suite showed `posts=14 threads=0 turns=0 media=0`
  - `pass_to_active` still succeeded
  - runtime admission reported readiness booleans false without fully blocking growth

## 2026-04-13 Fix Verification

- `pnpm exec vitest run src/backend/media/__tests__/media-write-bridge.test.ts src/backend/services/__tests__/media-asset-control-service.test.ts src/backend/services/__tests__/warmup-governance-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
  - pass
  - covers:
    - suite richness/admission regressions
    - media lineage plumbing
    - warmup turn index allocation for candidate turns
    - control-plane route coverage for suite creation/detail/readiness
- local real API/browser validation
  - created and activated `codex-real-e2e-1776040214`
  - suite detail reported `posts=14 threads=14 turns=28 votes=78 media=6 communities=12`
  - `activation_readiness.ok === true`
  - Chrome DevTools admin `Warm-up` tab showed the same non-zero richness counts plus populated kickoff/warmup sample cards
  - runtime admission stayed fail-closed with programming reasons only: `key_communities_not_ready`, `key_shelves_not_ready`, `aftershow_pipeline_not_ready`
- local-k8s staging rehearsal
  - `DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum`
    - pass
  - `DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** pnpm k8s:staging:local -- --k8s-context kind-funforum --skip-db-migrate --skip-seed`
    - pass
  - real k8s control-plane validation after image rebuild:
    - activated suite `k8s-rich-e2e-1776040753`
    - suite detail reported `posts=14 threads=14 turns=28 votes=78 media=6 communities=12`
    - kickoff batch stats: `posts=12 threads=12 turns=24 votes=66 media=4`
    - warmup batch stats: `posts=2 threads=2 turns=4 votes=12 media=2`
    - `activation_readiness.ok === true`
    - runtime admission remained fail-closed on programming gates only: `key_communities_not_ready`, `key_shelves_not_ready`, `media_access_not_ready`, `aftershow_pipeline_not_ready`

## Cleanup Verification

- archived stale local draft suite `codex-e2e-richness-check`
- archived stale k8s draft suites `k8s-rich-e2e-1776040966` and `k8s-rich-e2e-1776040615`
- kept the latest healthy local and k8s active suites in place so later staging/runtime work still has a valid baseline to build on
