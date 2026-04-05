# 04 Verification — agent-public-identity-projection-proof-alignment (T-145)

## Bootstrap Verification

- Registration covered by `T-142` bootstrap verification.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-145`
  - Result: passed; task registered as `planned` under `M-030 > F-100 > R-104`.

## Implementation Verification

- `pnpm exec vitest run src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-incubation-control-plane.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts src/backend/routes/__tests__/e2e-inference-profile-control-plane.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-data-plane.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts`
  - Result: passed (`13` files / `112` tests). The read/search/profile E2E surfaces stayed green after the split contract cutover, which confirms the backend and UI are consuming `public_identity`, `public_projection`, and `public_proof` without falling back to the old mixed semantics as the primary source.
- `pnpm test:e2e:pg:isolated`
  - Result: passed on real PostgreSQL after the new migration was applied, which proves the split-contract DTO work and mixed-author thread reads survive the non-mock persistence path.
- `pnpm exec tsc --noEmit`
  - Result: passed after the shared author-presentation builder and frontend read-source helpers were wired into profile, forum, and search surfaces.
- `pnpm exec vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/backend/services/__tests__/search-projection-service.test.ts`
  - Result: passed (`32` tests). This confirms the split-contract read sources stay consistent across forum detail, thread rendering, search result chips, agent intro/profile surfaces, and backend search projections.
- `pnpm exec vitest run src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx`
  - Result: passed (`30` tests) after removing the last UI-side `display_badges` fallback. This closes the remaining dual-track risk on touched surfaces by forcing identity chips to come from `public_identity` only.
- `pnpm test:e2e:playwright`
  - Result: passed (`102` tests) after stabilizing avatar image loading in the shared Playwright snapshot helper. The browser regression pack now proves the new identity-first surfaces remain stable across forum, governance, realtime, and agent modal views under all supported viewport/theme variants.

## Review Gate Readback

- Code readback across profile, forum, and search responses
  - Result: passed; the split contract is exposed consistently and the deprecated flat fields remain derived compatibility output only.
- Code readback across `PostCard`, `PostCompact`, thread detail, hover card, and search result rendering
  - Result: passed; identity is the primary chip on feed/search/detail surfaces, while proof remains hover/profile-first and only appears on search when explicitly relevant.

## 2026-04-05 — final status readback

- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-145`
  - Result: passed; task now reads back as `done` under `M-030 > F-100 > R-104`.
- Corrective `T-143` source-config readback
  - Result: passed; the 2026-04-05 canonical launch-config cleanup did not reopen `identity / projection / proof` semantics or change the frozen public DTO / surface read-source contract.
