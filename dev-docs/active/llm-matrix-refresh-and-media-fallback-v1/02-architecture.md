# 02 Architecture — T-201

## Context & current state
The repository uses registry-first LLM routing:

- provider/runtime metadata lives under `.ai/llm-config/registry/`
- execution flows through `src/backend/llm/`
- media generation currently uses a single Ark gateway through `src/backend/media/ark-seedream-gateway.ts`

Current constraints:

- only one adapter runtime exists: `openai_chat_completions`
- provider requests are standardized around `/chat/completions`
- media generation accepts a single `MediaGenerationGateway`
- hidden director, visible social, and media semantics each depend on separate profile families but share the same registry/cost/admission validation rules
- `voice_line_id` is a first-class repo concept that also touches persona compatibility, inference-profile codecs, context-memory behavior, and callsite inventory, so adding a new line is intentionally out of scope for this round

## Proposed design

### Components / modules
- Registry layer:
  - update existing LLM registry files; no new registry category is required for phase 1-3
- LLM runtime:
  - preserve the current gateway structure for phase 1-3
  - optionally add a typed provider-extension contract in phase 4
- Media generation:
  - retain Ark generation gateway as primary
  - add a DashScope `qwen-image-2.0` gateway as fallback
  - add a composite/fallback generation gateway to choose providers in order

### Interfaces & contracts
- API endpoints:
  - no new public HTTP API expected
- Data models / schemas:
  - no DB schema migration expected
  - registry records for model capabilities/pricing/admission must remain internally consistent
  - media generation config must express both primary and fallback generation providers/models
- Events / jobs (if any):
  - existing media generation jobs remain the persistence unit
  - provider/model metadata written to jobs must reflect the selected generation provider, including fallback cases

### Boundaries & dependency rules
- Allowed dependencies:
  - feature code continues to depend on `LLMGateway`, not provider SDKs
  - media generation orchestration depends on gateway interface(s), not provider-specific request code spread across services
- Forbidden dependencies:
  - feature code importing provider SDKs directly
  - raw untyped provider request blobs stored inside business callsites
  - image generation fallback logic duplicated across services
  - introducing a new Doubao `voice_line_id` as a side effect of registry migration

## Data migration (if applicable)
- Migration steps:
  - none expected at database level
- Backward compatibility strategy:
  - keep old routing behavior recoverable by reverting registry files and the media gateway wiring
- Rollout plan:
  - land registry migration first
  - validate hidden/vision routes
  - land media generation failover
  - only then consider typed provider-extension rollout

## Non-functional considerations
- Security/auth/permissions:
  - reuse existing provider secrets where possible
  - no new secret class is required if DashScope generation fallback reuses existing DashScope credentials
- Performance:
  - visible/hidden lane latency may shift with new model lineup; preserve pricing/capability metadata to enforce budgets
  - media generation fallback must not create unbounded retries
- Observability (logs/metrics/traces):
  - usage ledger must show updated provider/model IDs
  - media generation observability must capture which provider/model actually produced the asset

## Open questions
- Do we need a dedicated config contract for generation fallback ordering, or is a two-slot primary/fallback config sufficient?
- Which exact model IDs need one final vendor-side confirmation before phase 1 begins?
