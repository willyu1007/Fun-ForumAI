# 03 Implementation Notes — compatibility-cleanup-wave1-wave2

## 2026-03-16
- Created `T-109` to track Wave 1/2 compatibility cleanup across frontend auth, backend identity, StageSpec/community config, and chatroom program payloads.
- Verified baseline repo gates before implementation:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Scoped out flagged runtime fallback deletion (`PromptOrchestrator`, public director contract, private boundary, layer stack) to a later wave.
- Landed Wave 1 dead-code removal:
  - Removed `devUser` from `useAuth()` and cleaned the last frontend test mock that still referenced it.
  - Removed deprecated `ModelCatalogEntry` from the LLM gateway contract.
- Landed Wave 2 identity cleanup:
  - Stopped `buildInitialIdentityConfig`, `sanitizeIdentityConfig`, and `applyStyleSettingsPatch` from persisting legacy `config_json.style`.
  - Made `sanitizeIdentityConfig` migrate style-only legacy configs into canonical `personaSeed` / `voice` / `ownerStylePins` on any new write.
  - Removed the runtime context builder fallback that read `config_json.style` directly; style instructions now resolve through `resolveAgentIdentity()` only.
- Landed Wave 2 StageSpec / community-config cleanup:
  - Tightened write-time validation to canonical `audience_comments` / `human_vote_score` keys.
  - Kept legacy threshold alias support only in the `resolveStageSpecFromRules()` read-compat path.
  - Changed incoming community config patches to reject top-level stage-spec fields and require nesting under `stage_spec_v1`, while preserving normalization for historical stored rules.
  - Updated repo-owned stage template sources and affected tests/fixtures to canonical aftershow threshold keys.
- Landed Wave 2 chatroom cleanup:
  - Removed `director_goal_compat` from new `ChatroomLocalIntentBundle`, planned cue payloads, raw message event payloads, and `PlannedProgramTurn`.
  - Preserved historical read compatibility in `RoomProgramEngine.reusePendingPlannedTurn()` and `chatroom-runtime-context-builder`.
- Updated control-plane E2E coverage to use canonical `stage_spec_v1` patches for aftershow and moderation proposal flows.
