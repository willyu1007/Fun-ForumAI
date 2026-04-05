# 04 Verification — forum-semantic-convergence-governance-program (T-142)

## Bootstrap Verification

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed; regenerated `.ai/project/main/dashboard.md`, `.ai/project/main/feature-map.md`, and `.ai/project/main/task-index.md`.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-142`
  - Result: passed; returned `status=in-progress`, `feature_id=F-100`, `milestone_id=M-030`.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-143`
  - Result: passed; returned `status=planned`, `feature_id=F-100`, `milestone_id=M-030`.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-144`
  - Result: passed; returned `status=planned`, `feature_id=F-100`, `milestone_id=M-030`.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-145`
  - Result: passed; returned `status=planned`, `feature_id=F-100`, `milestone_id=M-030`.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-146`
  - Result: passed; returned `status=planned`, `feature_id=F-100`, `milestone_id=M-030`.

## Coverage Reinforcement Verification

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed after expanding `T-142` to `T-146` bundle scope, requirement coverage, and boundary docs.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed after the documentation reinforcement pass.

## Review-Flow Reinforcement Verification

- Readback review across `T-142` to `T-146` plan/architecture docs
  - Result: passed; every pack now includes required inputs, handoff contract, and an explicit review gate before the next dependent pack starts.
- Readback review across `T-142` architecture and plan
  - Result: passed; the program bundle now defines both the per-pack review workflow and the final overall review after `T-146`.

## T-143 Gate Verification

- Readback review across `T-142` and `T-143` docs after implementation
  - Result: passed; the corrected freeze (`12 family + 4 shell category + 2 publication review profile`, no wave-1 `community_subtype`, `creator_note` not a family) is consistent between program governance and execution bundle docs.
- `pnpm vitest run src/backend/launch/__tests__/semantic-taxonomy-registry.test.ts src/backend/launch/__tests__/programming-contracts.test.ts src/backend/launch/__tests__/system-roster.test.ts src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: passed; `T-143` canonical contract spine is implemented and stable on the main touched surfaces.
- `pnpm vitest run src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-incubation-control-plane.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts src/backend/routes/__tests__/e2e-inference-profile-control-plane.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-data-plane.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts`
  - Result: passed after fixing the incubation-community read regression uncovered during review.
- `pnpm test:e2e:pg:isolated`
  - Result: passed after restoring local PostgreSQL and Docker daemon availability; the previously missing real-PostgreSQL gate is now closed, and the run surfaced plus validated fixes for an agent-search timing gap and a fake-FK E2E fixture.

## T-144 / T-145 Closure Verification

- `pnpm exec vitest run src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-incubation-control-plane.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/routes/__tests__/e2e-role-assignment-control-plane.test.ts src/backend/routes/__tests__/e2e-inference-profile-control-plane.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-data-plane.test.ts src/backend/routes/__tests__/e2e-full-flow.test.ts src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts`
  - Result: passed (`13` files / `112` tests) after fixing the outdated proposal-control-plane E2E fixture to send the canonical `T-144` payload. This closes the governance payload gate and preserves the `T-145` public-read surfaces under the same regression pack.
- `pnpm test:e2e:pg:isolated`
  - Result: initially failed because the real PostgreSQL schema was missing `T-144` / `T-145` persistence columns. Passed after adding migration `20260404133000_t144_t145_semantic_governance_identity_cutover`, which added canonical governance columns plus polymorphic-author support on `public_stage_threads` and `public_stage_turns`.
- `pnpm exec tsc --noEmit`
  - Result: passed after the E2E-driven fixes.
- `pnpm exec vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/backend/services/__tests__/community-governance-service.test.ts src/backend/stage/__tests__/stage-spec.test.ts src/backend/services/__tests__/human-participation-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts`
  - Result: passed (`9` files / `70` tests). This extends the closure proof from route-level E2E into the key service/component seams that directly encode the `T-144` / `T-145` contract boundaries.
- `pnpm test:e2e:playwright`
  - Result: initially exposed two additional quality gaps during full-browser review: stale forum/governance visual fixtures after the contract/UI cutover, and nondeterministic avatar fallback capture because the shared snapshot helper did not wait for images. Passed (`102` tests) after fixing the mocks/spec assertions and stabilizing `tests/web/playwright/support/helpers.ts`.
- Program readback against the frozen review gates
  - Result: passed. `T-144` now has evidence for canonical governance payloads, human-authored main-thread compatibility, and search-safe coexistence before `T-146`; `T-145` now has evidence for split-contract read-source convergence and derived-compat output behavior.

## 2026-04-05 — final closeout recovery verification

- `pnpm exec vitest run src/backend/launch/__tests__/community-rules.test.ts src/backend/launch/__tests__/system-roster.test.ts src/backend/launch/__tests__/programming-contracts.test.ts src/backend/launch/__tests__/visual-rollout.test.ts src/backend/services/__tests__/launch-programming-ops-service.test.ts scripts/lib/__tests__/launch-readiness.test.ts`
  - Result: passed. This is the corrective `T-143` source-config canonicalization gate covering canonical-only fixtures plus explicit alias-ingress behavior.
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/__tests__/community-governance-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - Result: passed. This is the short downstream readback proving the corrective `T-143` pass did not reopen `T-144` / `T-145` / `T-146` semantics.
- `pnpm exec tsc --noEmit`
  - Result: passed after the source-config canonicalization pass and documentation/status resync.
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed; regenerated the project-hub derived views with the final `T-142/T-144/T-145/T-146` task states.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed after the final status sync.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-142`
  - Result: passed; `T-142` reads back as `done`.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-143`
  - Result: passed; `T-143` remains `archived` as the frozen upstream contract bundle, with the corrective pass recorded in its archive docs.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-144`
  - Result: passed; `T-144` reads back as `done`.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-145`
  - Result: passed; `T-145` reads back as `done`.
- `node .ai/scripts/ctl-project-governance.mjs query --project main --id T-146`
  - Result: passed; `T-146` reads back as `done`.
- `rg -n 'T-14[2-6]' .ai/project/main/task-index.md .ai/project/main/dashboard.md .ai/project/main/registry.yaml`
  - Result: passed; the derived project-hub views show the same final state split: `T-142/T-144/T-145/T-146 = done`, `T-143 = archived`.

## 2026-04-05 — post-merge drift cleanup verification

- `pnpm exec vitest run src/backend/launch/__tests__/programming-schedule.test.ts src/backend/launch/__tests__/lightweight-personalization.test.ts src/frontend/features/forum/components/__tests__/PostCard.test.tsx src/frontend/features/forum/components/__tests__/PostCompact.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - Result: passed; canonical creator-note UI badges, launch source-config naming, and alias-ingress normalization remain stable after the drift cleanup.
- `pnpm exec tsc --noEmit`
  - Result: passed after removing `is_t4` from the primary forum read paths and adding the lightweight-personalization normalization test.
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main --changelog`
  - Result: passed; regenerated the project-hub derived views after the milestone / feature / requirement state cleanup.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed after the final project-hub resync.
