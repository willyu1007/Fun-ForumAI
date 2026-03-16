# 03 Implementation Notes — compatibility-cleanup-wave3-runtime-fallbacks

## 2026-03-16
- Created `T-110` to track Wave 3 runtime fallback deletion as a follow-up to `T-109`.
- Scoped target areas to:
  - `PromptOrchestrator` / `ContextBuilder` / `ConversationClock` / `PostScheduler`
  - `PrivateChannelService` / `ProactiveInteractionService`
  - `PublicSceneCatalogService` / `PublicSceneSelectorService` / public scene scheduler wiring
- Removed rollout-era fallback branches from prompt composition callsites:
  - `ContextBuilder` now uses `PromptOrchestrator` when present, `PromptLayerService` only as an explicit initialization guard, and no longer silently falls through on compose failures.
  - `ConversationClock` no longer downgrades orchestrator/layer failures into base persona defaults; it only uses lower layers when the higher service is not injected.
  - `PromptOrchestrator` is always scene-enabled for supported scenes and suppresses `layer_showrunner` for `private_chat` / `proactive_dm` without flag gating.
- Removed private/proactive legacy prompt contracts:
  - `PrivateChannelService` no longer builds the hand-written legacy prompt payload; missing orchestrator now raises `PROMPT_ORCHESTRATOR_UNAVAILABLE`.
  - `ProactiveInteractionService` no longer falls back to `internal-proactive-dm-opening-legacy`; the only live callsite is `agent-proactive-dm-opening`.
  - `PromptEngine` now permanently treats `layer_showrunner` as optional for the private-boundary templates.
- Removed public-scene legacy posting fallback:
  - `PublicSceneCatalogService` now reads `docs/stage-templates/dist/launch.json` whenever present, without `publicDirectorContractV1` gating.
  - `PublicSceneSelectorService` now returns `kind: 'skip'` instead of `kind: 'fallback'`; audit `episode_strategy` changed from `fallback_legacy` to `selection_skipped`.
  - `PostScheduler` now skips scheduled posts when no public scene can be selected, always uses `agent-create-post@2` when it proceeds, and no longer writes scheduled-post fallback metadata.
  - `app.ts` now starts `directorHistoryMaintenanceScheduler` whenever Prisma wiring exists; no rollout flag gate remains.
- Updated tests to canonical semantics:
  - Replaced `context-builder.layer-stack-v2.test.ts` with `context-builder.prompt-routing.test.ts`.
  - Rewrote prompt-orchestrator, prompt-engine, private/proactive, public-scene-selector, post-scheduler, and multimodal E2E tests to assert canonical path / skip / fail-fast behavior.

## 2026-03-16 — QA follow-up cleanup
- Reviewed the full Wave 3 diff for semantic drift and cleaned two residual issues after the initial implementation had already landed:
  - `PostScheduler` now reports selector-unavailable / scene-skip outcomes as `triggered: true` failures once an agent has been selected, so `/v1/dev/runtime/post` and runtime tick summaries do not misclassify real scheduled-post failures as “not triggered”.
  - `e2e-multimodal.test.ts` no longer mutates the shared repo `docs/stage-templates/dist/launch.json`; it now stubs `postScheduler`'s injected public-scene selector in-process, which removes cross-test filesystem pollution while still exercising the canonical scheduled-post path.
- Added unit coverage for the selector-service-missing branch in `post-scheduler.test.ts` and reran both the targeted route/runtime tests and the full repository gates after the cleanup.

## 2026-03-16 — Dead flag cleanup follow-up
- Removed the rollout-only flags that became dead after Wave 3 from the backend config surface:
  - deleted `layerStackV2`, `promptOrchestratorV1`, `publicDirectorContractV1`, `privateDirectorBoundaryV1`, `promptOrchestratorScenes`, and `scenePoolAssetOpsV1` from `src/backend/lib/config.ts`
  - removed the corresponding env contract entries from `env/contract.yaml`
- Regenerated all env contract artifacts so the public configuration surface matches the live runtime:
  - `env/.env.example`
  - `docs/env.md`
  - `docs/context/env/contract.json`
- Cleaned live local-kind propagation points so dead flags are no longer injected or asserted:
  - removed the obsolete keys from `ops/deploy/k8s/overlays/local-kind/patch-configmap.yaml`
  - updated `scripts/k8s-local-staging.mjs` to validate only the remaining canonical runtime flags
- Re-ran static dead-flag scans after regeneration and confirmed the removed flag names no longer appear in live `src/`, `env/`, `ops/`, `scripts/`, or generated env artifacts.
