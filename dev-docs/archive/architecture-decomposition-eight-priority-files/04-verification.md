# 04 Verification — architecture-decomposition-eight-priority-files

## Key Checks
- `pnpm exec tsc -p tsconfig.node.json --pretty false` — passed after Wave 1 / Wave 2 service splits.
- `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/inference-profile-service.test.ts src/backend/services/__…` — passed after restoring shadow-review evidence window semantics.
- `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/inference-profile-service.test.ts` — passed after restoring shadow-review evidence window semantics.
- `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services/…` — passed after reintroducing façade wrapper methods for the class-level test seams.
- `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/conversation-clock.test.ts` — passed after reintroducing façade wrapper methods for the class-level test seams.
- `pnpm vitest run --maxWorkers=1 src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx` — passed.

## Coverage
- Baseline
- Phase 1
- `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/inference-profile-service.test.ts src/backend/services/_…
- Phase 2
- `pnpm vitest run --maxWorkers=1 src/backend/services/__tests__/chat-service.policy-gateway.test.ts src/backend/services…
