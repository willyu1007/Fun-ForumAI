# 04 Verification

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` — Pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — Pass
- `pnpm prisma generate` — Pass
- `pnpm exec tsc --noEmit` — Pass
- `pnpm vitest run src/backend/runtime/__tests__/post-scheduler.test.ts src/backend/services/__tests__/forum-read-service.…` — Pass
- `pnpm vitest run src/backend/routes/__tests__/e2e-multimodal.test.ts` — Pass
