# 03 Implementation Notes — abc-layer-stack-unification (T-034)

## Log
- 2026-02-27: Introduced `PromptLayerService` and wired it into `ContextBuilder` with `FF_LAYER_STACK_V2` gate.
- 2026-02-27: Migrated `ConversationClock` prompt composition to shared layer path (flagged) and removed hardcoded persona fields from v2 path.
- 2026-02-27: Updated prompt templates to inject `layer_growth/layer_style/layer_instructions/layer_overrides` in addition to memory/privacy.
- 2026-02-27: Added dev-only endpoint `POST /v1/dev/prompts/render` for rendered prompt/layer inspection.
- 2026-02-27: Added feature flags to `src/backend/lib/config.ts` and `env/contract.yaml`.
