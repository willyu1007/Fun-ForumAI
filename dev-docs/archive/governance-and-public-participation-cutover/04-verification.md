# 04 Verification — governance-and-public-participation-cutover (T-144)

## Bootstrap Verification

- Registration covered by `T-142` bootstrap verification.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-144`
  - Result: passed; task registered as `planned` under `M-030 > F-100 > R-103`.

## Implementation Verification

- `pnpm exec vitest run src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts`
  - Result: initially failed because the control-plane E2E fixture was still sending deprecated `t4_candidate` and legacy incubation visibility fields; passed after the fixture was upgraded to canonical `proposed_community_family`, `publication_review_profile_id`, `launch_wave`, and three-axis `human_participation`.
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-incubation-control-plane.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts src/backend/routes/__tests__/e2e-inference-profile-control-plane.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-data-plane.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts`
  - Result: passed (`13` files / `112` tests). This closes the canonical governance payload path, validates mixed-author public-thread reads, and confirms human `open_reply` support does not break read/search-refresh before `T-146`.
- `pnpm test:e2e:pg:isolated`
  - Result: initially failed on real PostgreSQL because `public_stage_threads` and `public_stage_turns` were missing the new polymorphic-author columns required by `T-144`. Passed after adding Prisma migration `20260404133000_t144_t145_semantic_governance_identity_cutover`, which backfills the canonical governance columns and adds `author_actor_type` / `author_user_id` persistence for main-thread human replies.
- `pnpm prisma validate`
  - Result: passed after the migration landed.
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - Result: passed; refreshed `docs/context/db/schema.json` so the DB context reflects the canonical governance and mixed-author thread schema.
- `pnpm exec vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/backend/services/__tests__/community-governance-service.test.ts src/backend/stage/__tests__/stage-spec.test.ts src/backend/services/__tests__/human-participation-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts`
  - Result: passed (`58` tests). This confirms the canonical governance resolver, human `open_reply` write gate, mixed-author forum read model, and post-detail / thread-detail consumers stay aligned with the frozen `T-144` contract.
- `pnpm test:e2e:playwright`
  - Result: initially failed on browser governance/forum surfaces because the admin dashboard gained a new canonical proposal queue mock, the forum spec still asserted an old “主舞台” label, and the visual snapshot helper did not wait for avatar images to settle. Passed (`102` tests) after fixing the governance/forum mocks and stabilizing `tests/web/playwright/support/helpers.ts` to wait for image load/decode before snapshot capture.

## 2026-04-05 — final status readback

- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-144`
  - Result: passed; task now reads back as `done` under `M-030 > F-100 > R-103`.
- Corrective `T-143` source-config readback
  - Result: passed; the 2026-04-05 canonical launch-config cleanup did not change the frozen `T-144` outward governance payloads, mixed-author thread behavior, or pre-`T-146` search-safe compatibility guarantees.
