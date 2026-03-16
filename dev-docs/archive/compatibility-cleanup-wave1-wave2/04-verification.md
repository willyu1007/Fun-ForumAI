# 04 Verification — compatibility-cleanup-wave1-wave2

| Date | Command | Result | Notes |
|------|---------|--------|-------|
| 2026-03-16 | `pnpm typecheck` | pass | Baseline before compatibility cleanup. |
| 2026-03-16 | `pnpm lint` | pass | Baseline before compatibility cleanup. |
| 2026-03-16 | `pnpm test` | pass | 195 files / 999 tests passed. |
| 2026-03-16 | `pnpm build` | pass | Non-blocking Vite large-chunk warning persists. |
| 2026-03-16 | `pnpm exec vitest run src/backend/identity/__tests__/agent-identity.test.ts src/backend/services/__tests__/agent-service.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts src/backend/stage/__tests__/stage-spec.test.ts src/backend/stage/__tests__/stage-template-ops.test.ts src/backend/routes/__tests__/stage-template-scripts.test.ts src/backend/services/__tests__/community-config-service.test.ts src/backend/services/__tests__/chatroom-local-intent-service.test.ts src/backend/services/__tests__/room-program-engine.test.ts src/backend/services/__tests__/chatroom-control-service.test.ts src/backend/services/__tests__/room-program-projector.test.ts` | pass | 11 files / 70 tests passed after Wave 2 edits. |
| 2026-03-16 | `rg -n --hidden -S "\\bdevUser\\b|ModelCatalogEntry" src --glob '!**/node_modules/**'` | pass | No live `devUser` or `ModelCatalogEntry` references remain in `src/`. |
| 2026-03-16 | `rg -n --hidden -S "director_goal_compat|config_json\\.style|toLegacyStyleRecord\\(|next\\.style =|min_comments|min_human_vote_score" src docs scripts --glob '!**/node_modules/**'` | pass with expected leftovers | Remaining hits are limited to explicit read-compat, migration/test fixtures, unrelated repository threshold field names, and negative assertions. |
| 2026-03-16 | `pnpm typecheck` | pass | Re-run after implementation; caught and then cleared a stale `devUser` test mock. |
| 2026-03-16 | `pnpm lint` | pass | Clean after removing an unused destructuring placeholder in StageSpec read-compat normalization. |
| 2026-03-16 | `pnpm exec vitest run src/backend/routes/__tests__/e2e-control-plane.test.ts` | pass | Updated control-plane E2E proposal payloads to canonical `stage_spec_v1` form. |
| 2026-03-16 | `pnpm test` | pass | 195 files / 1002 tests passed after compatibility cleanup and test updates. |
| 2026-03-16 | `pnpm build` | pass | Non-blocking Vite large-chunk warning still persists. |
