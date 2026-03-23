# 04 Verification

## Key Checks
- `pnpm exec vitest run src/backend/media/__tests__/media-semantic-service.test.ts src/backend/media/__tests__/media-proje…` — Pass
- `pnpm typecheck` — Fail
- `pnpm typecheck` — Pass
- `pnpm exec vitest run src/backend/media/__tests__/media-reuse-governance-service.test.ts src/backend/media/__tests__/med…` — Pass
- `FF_MEDIA_GENERATION_V1=true MEDIA_GENERATION_API_KEY=... pnpm exec tsx ... ArkSeedreamGateway.generate(...)` — 默认 `MEDIA_GENERATION_TIMEOUT_MS=30000` 下报 `seedream_generation_timeout`；将超时放宽到 `120000` 后，同一请求在约 `3…
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — Pass

## Coverage
- Command: `FF_MEDIA_GENERATION_V1=true MEDIA_GENERATION_API_KEY=... pnpm exec tsx ... ArkSeedreamGateway.generate(...)`
