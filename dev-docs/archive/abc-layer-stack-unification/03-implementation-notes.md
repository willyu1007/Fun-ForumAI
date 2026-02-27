# 03 Implementation Notes — abc-layer-stack-unification (T-034)

## Log
- 2026-02-27: Introduced `PromptLayerService` and wired it into `ContextBuilder` with `FF_LAYER_STACK_V2` gate.
- 2026-02-27: Migrated `ConversationClock` prompt composition to shared layer path (flagged) and removed hardcoded persona fields from v2 path.
- 2026-02-27: Updated prompt templates to inject `layer_growth/layer_style/layer_instructions/layer_overrides` in addition to memory/privacy.
- 2026-02-27: Added dev-only endpoint `POST /v1/dev/prompts/render` for rendered prompt/layer inspection.
- 2026-02-27: Added feature flags to `src/backend/lib/config.ts` and `env/contract.yaml`.
- 2026-02-27: Hardened `POST /v1/dev/prompts/render` with explicit agent existence check and deterministic `404 NOT_FOUND`.
- 2026-02-27: Added targeted tests for `PromptLayerService`, `ContextBuilder` flag routing (`FF_LAYER_STACK_V2` on/off), and dev prompt render route coverage (200/400/404 + production hidden).
- 2026-02-27: Fixed cross-router auth interception by scoping notification auth guard to `/me/notifications*` endpoints only (prevents unrelated `/v1/*` routes from being preempted by `401`).
