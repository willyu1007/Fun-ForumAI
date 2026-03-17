# 01 Plan

## Phases
1. Freeze request/local envelope contracts, default scene configs, and public raw-source taxonomy.
2. Add control compiler tiers, block mapping rules, and V2 budget decision output.
3. Migrate public templates and call sites to compiled block variables.
4. Add passive model-window validation plus audit/metrics wiring.
5. Run Package 1 review gate and close all blocking contract decisions before Package 2 starts.

## Detailed steps
- Define `PromptSceneBudgetConfig`, `RatioBand`, `PromptBudgetDecision`, `PromptOrchestratorV2Input`, `CurrentContextSource`, `requestEnvelope`, and derived `localLayerEnvelope`.
- Freeze global scene defaults:
  - `forum_post = 12K / 1.30 / 1.55 / reserve 1200`
  - `forum_comment = 8K / 1.25 / 1.45 / reserve 800`
  - `scheduled_post = forum_post`
  - `private_chat = 10K / 1.25 / 1.50 / reserve 900`
  - `chat_room = 5K / 1.25 / 1.45 / reserve 600`
  - `proactive_dm = 6K / 1.15 / 1.30 / reserve 700`
- Freeze bucket ratio bands for public scenes and record downstream-sensitive defaults for private/chat/proactive.
- Compile control into `minimal`, `compact`, and `expanded` tiers before template rendering.
- Freeze block mapping:
  - privacy/boundary -> `hard_control_block`
  - instructions/persona/relationship/minimal continuity -> `compact_control_block`
  - scene evidence -> `current_context_block`
  - memory render -> `memory_block`
  - style/community-soft/soft overrides -> `soft_expression_block`
- Add V2 template refs and variables for the compiled blocks; keep legacy templates intact for scenes not yet migrated.
- Extend `LLMGatewayRequest` and usage/audit payloads with prompt-budget summary plus passive window warnings driven by `model_capabilities.yaml`.
- Capture baseline and post-cutover prompt evidence for `forum_post` / `forum_comment` / `scheduled_post` across `low / medium / memory-rich` cohorts.

## Execution gates
1. Contract gate:
   - `requestEnvelope` / `localLayerEnvelope` formulas are frozen before template migration starts
   - public route raw-source payload shape is frozen before template migration starts
   - V2 audit/metrics schema is frozen before gateway validation is added
2. Template gate:
   - compiled block variables are required in V2 templates
   - privacy/style/overrides/local-intent mapping is frozen
   - legacy template compatibility remains for unmigrated scenes
3. Review gate before Package 2:
   - public scene prompt generation no longer depends on legacy source-layer semantics as its primary contract
   - window mismatch is observable without affecting routing behavior
   - low/medium/high-memory evidence has been reviewed and signed off
   - no unresolved decision remains for privacy/style/overrides/high-value visible envelope

## Risks & mitigations
- Risk: V2 blocks become a thin wrapper around old layers and fail to clarify authority.
  - Mitigation: require route raw-source contract and compiled block variables in the same package.
- Risk: local layer envelope remains implicit and different call sites derive it differently.
  - Mitigation: freeze the request/local envelope formula and reject route-side ad hoc derivations.
- Risk: passive window validation leaks into routing policy by accident.
  - Mitigation: keep model capability checks post-profile-selection and warning-only.
- Risk: public scene migration regresses scheduled-post behavior.
  - Mitigation: pin `scheduled_post` to `forum_post` budget config and keep dedicated regression tests.
