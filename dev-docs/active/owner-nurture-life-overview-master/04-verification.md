# 04 Verification

## Planned checks
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
- targeted backend/frontend test runs recorded by the execution bundles

## 2026-03-16
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: passed (`[ok] Sync complete.`)
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed with one pre-existing warning on `T-103 personality-compiler-inference-profile-v1` missing acceptance checkboxes
- Cross-package planning review completed for:
  - execution order and handoff gates
  - owner-home aggregate ownership
  - preview/deep-dive semantic consistency
  - privacy/degraded-state acceptance coverage
- `pnpm vitest run src/backend/services/__tests__/owner-life-overview-service.test.ts src/backend/routes/__tests__/private-owner-life-overview-auth.test.ts src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx`
  - Result: passed
- `pnpm test -- --run src/backend/services/__tests__/achievement-chronicle-service.test.ts`
  - Result: passed
- `pnpm exec eslint src/shared/owner-life-overview.ts src/backend/services/chronicle-story-meta.ts src/backend/services/achievement-chronicle-service.ts src/backend/services/owner-breathing-signals-service.ts src/backend/services/owner-life-overview-service.ts src/backend/routes/private-channel-api.ts src/frontend/api/hooks/agent.ts src/frontend/api/query-keys.ts src/frontend/api/types.ts src/frontend/features/agents/components/OwnerLifeOverviewPanel.tsx src/frontend/features/agents/pages/AgentProfilePage.tsx src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx src/backend/services/__tests__/owner-life-overview-service.test.ts src/backend/routes/__tests__/private-owner-life-overview-auth.test.ts`
  - Result: passed
- `pnpm typecheck`
  - Result: failed on pre-existing `src/backend/services/__tests__/inference-profile-service.test.ts` type errors around `UsageLedgerEntry.scene`

## 2026-03-16 — closure audit remediation
- `pnpm vitest run src/backend/services/__tests__/owner-life-overview-service.test.ts src/backend/routes/__tests__/private-owner-life-overview-auth.test.ts src/frontend/features/agents/components/__tests__/GuidanceExplanationPanels.test.tsx src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx`
  - Result: passed
- `pnpm exec eslint src/shared/owner-life-overview.ts src/backend/services/owner-life-overview-service.ts src/backend/services/__tests__/owner-life-overview-service.test.ts src/frontend/api/hooks/nurture.ts src/frontend/features/agents/components/OwnerLifeOverviewPanel.tsx src/frontend/features/agents/components/AchievementChroniclePanel.tsx src/frontend/features/agents/components/__tests__/GuidanceExplanationPanels.test.tsx src/frontend/features/agents/pages/AgentProfilePage.tsx src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx`
  - Result: passed
- `pnpm typecheck`
  - Result: still fails on pre-existing `src/backend/services/__tests__/inference-profile-service.test.ts` type errors around `UsageLedgerEntry.scene`; no new typecheck failure introduced by the owner-life changes
- `curl -H 'Authorization: Bearer <dev-user-token>' http://127.0.0.1:4000/v1/private/agents/03cebe01-61c5-4e77-9706-15e5ff839c00/life-overview`
  - Result: passed; verified non-empty `recent_story_beats`, `recent_achievement_seals`, and `nurture_suggestions`
- `curl -H 'Authorization: Bearer <dev-user-token>' 'http://127.0.0.1:4000/v1/private/agents/03cebe01-61c5-4e77-9706-15e5ff839c00/chronicle-feed?limit=5'`
  - Result: passed; verified owner story-beat payload returns chapter/source/seal data
- Local browser validation via Chrome DevTools against `http://127.0.0.1:4173/agents/03cebe01-61c5-4e77-9706-15e5ff839c00`
  - Result: initially blocked by backend `GET /v1/agents/:id/profile` 500 (`agent_inference_profiles` table missing in the local DB)
- `pnpm db:migrate:deploy`
  - Result: passed; applied `20260315110000_t103_personality_compiler_inference_profile` and `20260315124500_t103_inference_shadow_review` to local `llm_forum_dev`
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - Result: passed; regenerated `docs/context/db/schema.json`
- `pnpm db:migrate:status`
  - Result: passed; local DB schema is up to date
- `curl -H 'Authorization: Bearer <dev-user-token>' http://127.0.0.1:4000/v1/agents/03cebe01-61c5-4e77-9706-15e5ff839c00/profile`
  - Result: passed; profile route recovered to HTTP 200 after migrations
- Local browser validation via Chrome DevTools against `http://127.0.0.1:4173/agents/03cebe01-61c5-4e77-9706-15e5ff839c00`
  - Result: passed; verified owner overview renders `此刻` / `最近三段经历` / `来自你的投影`, and `?tab=achievements` renders the story-beat chronicle deep dive with filters and chapter block
