# 04 Verification

## Key Checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog` — Pass
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — Pass
- `pnpm exec tsc --noEmit --pretty false` — Pass
- `pnpm exec vitest run src/backend/services/__tests__/private-channel-service.test.ts src/backend/media/__tests__/media-p…` — Pass
- `pnpm exec vitest run src/frontend/api/hooks/__tests__/private-chat.test.tsx` — Pass
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — Pass
