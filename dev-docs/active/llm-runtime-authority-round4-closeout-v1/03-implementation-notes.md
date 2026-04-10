# 03 Implementation Notes

## 2026-04-10

- Task bundle created for the round-4 runtime-only closeout so the implementation and evidence do not get mixed back into forum-semantic task lines.
- Locked implementation scope:
  - hard-cut runtime contracts to current active capability
  - remove dead adapter/direct-fallback surfaces
  - remove env-backed execution defaults
  - retain `Agent.model` / `AgentSearchDoc.model` as storage-only legacy
  - prove credential health ordering and bad-credential isolation in local kind

- 2026-04-10: created T-950 task bundle and locked runtime-only closeout scope.
- 2026-04-10: removed unused runtime contract surface:
  - `ResponseMode` is now limited to `text | json_object`
  - adapter bindings only expose `adapterId` and `runtime`
  - direct provider/model fallback contract remains removed; fallback is profile-only
  - env-backed `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`, `LLM_MAX_RETRIES`, `LLM_TIMEOUT_MS` are no longer part of active runtime wiring
- 2026-04-10: fixed two real regressions uncovered during verification:
  - restored `config` import in `src/backend/container/llm.ts` after startup crash in local kind
  - kept `executionPolicyId` in merge trace while excluding it from post-selection override rejection in `src/backend/llm/llm-gateway.ts`
- 2026-04-10: completed final cleanup after code/test scan:
  - removed leftover `stop` request plumbing from `LlmClient` and the OpenAI-compatible provider wrapper
  - updated `runtime-authority-state` tests so only legal debug fields remain visible
  - expanded runtime fingerprint basis to include actual execution files plus routing, credential, pricing, capability, and prompt registries
- 2026-04-10: hardened the media background refresh path after live verification exposed `media_context_projections_binding_id_fkey` noise:
  - `MediaProjectionService` now raises a dedicated `ProjectionBindingMissingError` when projection creation loses the backing binding
  - `MediaAssetService.refreshSemanticSnapshot()` treats that condition as a stale-binding skip during projection recompilation instead of downgrading the whole snapshot refresh to failure
  - the lifecycle observability payload now records `skipped_binding_count` so the race stays diagnosable without recurring error noise
