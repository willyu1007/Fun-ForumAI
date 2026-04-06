# 04 Verification

## 2026-04-06

- `pnpm exec vitest run src/backend/media/__tests__/media-generation-service.test.ts src/backend/media/__tests__/surface-media-planning-service.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/media/__tests__/media-asset-service.test.ts src/backend/media/__tests__/media-write-bridge.test.ts`
  - Passed.
  - Confirms:
    - stale running media-generation jobs are reclaimed and retried correctly
    - missing-object assets are rejected for owner-pool/public attachment reuse
    - `canonical` dev seed now produces a `hot-arena` agent with an owner-private pool candidate
    - runtime scheduled post can bridge owner-pool media and derive a public-safe generated attachment
- `pnpm exec tsc --noEmit`
  - Passed.
- `pnpm exec vitest run scripts/lib/__tests__/launch-readiness.test.ts scripts/ci/__tests__/check-image-launch-proof.test.ts`
  - Passed.
  - Confirms local-kind launch readiness now enforces:
    - `VITE_FF_MULTIMODAL_AGENT_MEDIA_V1=true` in launch frontend proof
    - local-kind media persistence wiring via PVC and `/var/media-assets`

### Live kind E2E

- Environment:
  - kind context: `kind-funforum`
  - namespace: `funforum`
  - model credentials injected:
    - Qwen primary: `dashscope-openai`
    - Seedream image generation: `ark-seedream`
- Real live checks completed:
  - `/v1/admin/runtime/features` and backend startup logs both reported:
    - `multimodalAgentMediaV1: true`
    - `mediaGenerationV1: true`
    - `mediaRolloutControllerV1: true`
  - Chrome DevTools on `http://127.0.0.1:3001/communities` showed canonical creator slugs only:
    - `/c/creator-recommendation`
    - `/c/creator-relationship`
  - Created a live agent, uploaded a `private_only` owner-pool image, triggered `POST /v1/dev/runtime/post`, and observed:
    - post `ba61f24f-5cf1-41c6-b494-daee7e7ad6d4`
    - generated public attachment asset `cmnn7ajys023l0mjkk7tzie00`
    - media URL `/v1/media/local/db4492cc-54d2-43af-bd20-dafaad273bd4%2F2026-04-06%2Ffe1e49cc-1e07-4540-b051-5e5b9e8e305e.jpg`
  - Verified the generated JPG before restart:
    - `HEAD` returned `200 OK`
    - backend pod contained both the original PNG and derived JPG under `/var/media-assets/...`
  - Restarted `deploy/backend`, re-established port-forward, and re-verified the same JPG URL:
    - `HEAD` again returned `200 OK`
    - confirms PVC-backed local media persistence is working across pod recreation
  - Chrome DevTools on `http://127.0.0.1:3001/posts/ba61f24f-5cf1-41c6-b494-daee7e7ad6d4` confirmed the post detail page rendered the same `/v1/media/local/...jpg`
    - browser image natural size: `1920x2400`

### Live canonical seed validation

- Rebuilt and redeployed current code to kind with `pnpm k8s:staging:local -- --k8s-context kind-funforum --skip-db-migrate`.
- Verified canonical seed data now includes a hot-stage owner-private candidate without manual bootstrap:
  - agent `洛芙蕾丝` owns `seed-owner-media-asset-owner-media-lovelace-hot-arena-stage`
  - active membership includes `hot-arena`
- This closes the earlier gap where live verification required manually creating a new multimodal seed agent.

## 2026-04-06 — archive prep and cleanup

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Passed.
  - Result: `T-938` moved from active tracking into archive state and project hub derived views were refreshed.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Passed.
- `pnpm exec vitest run src/backend/media/__tests__/media-generation-service.test.ts src/backend/media/__tests__/surface-media-planning-service.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts src/backend/runtime/__tests__/post-scheduler.test.ts src/backend/lib/config.test.ts scripts/lib/__tests__/launch-readiness.test.ts scripts/lib/__tests__/k8s-process-cleanup.test.ts scripts/ci/__tests__/check-image-launch-proof.test.ts ops/packaging/scripts/__tests__/frontend-build-profile.test.ts src/frontend/shared/config/__tests__/frontend-flags.test.ts`
  - Passed (`11` files, `48` tests).
  - Confirms the retained repo-side tests are regression coverage, not one-off closeout artifacts.
- `pnpm exec tsc --noEmit`
  - Passed.
- `git diff --check`
  - Passed.
