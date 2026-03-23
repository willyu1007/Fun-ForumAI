# 04 Verification

## Key Checks
- ``pnpm exec vitest run src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/foru…` — pass
- ``pnpm exec vitest run src/backend/services/__tests__/hot-topic-policy-service.test.ts src/backend/services/__tests__/po…` — pass
- ``pnpm exec eslint src/backend/services/chat-service.ts src/backend/services/forum-read-service.ts src/backend/services/…` — pass
- ``pnpm exec vitest run src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/f…` — pass
- ``python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --repo-root . --run-id t091-hot-topic-fixes-2…` — pass
- ``pnpm vitest run src/backend/services/__tests__/hot-topic-policy-config.test.ts src/backend/services/__tests__/hot-topi…` — pass

## Coverage
- `policy-gateway-service.test.ts`
- `chat-service.policy-gateway.test.ts`
- `forum-write-service.policy-gateway.test.ts`
- Evidence
