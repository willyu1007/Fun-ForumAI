# 02 Architecture

## Context & current state
- Current `PromptOrchestrator` trims legacy source layers with fixed `LAYER_BUDGET_BY_SCENE`, but it does not own a request-envelope contract.
- Public routes still feed templates with route-shaped fields such as post body, thread context, and local intent, while orchestrator only sees a coarse `conversationText`.
- `LLMGateway` owns routing/ledger/cost but does not yet validate prompt operating size against model-window metadata.

## Proposed design

### Request envelope vs local layer envelope
- `requestEnvelope` is the per-call budget view that represents the real model-facing input budget. It MUST include:
  - `static_system_tokens`
  - `route_wrapper_tokens`
  - `tool_tokens`
  - `current_user_input_tokens`
  - `output_reserve`
  - `model_capability_ref?`
- Ownership is fixed:
  - route/service supplies raw context sources plus `route_wrapper_tokens`, `tool_tokens`, and current-user/input estimates
  - orchestrator resolves scene config and derives `localLayerEnvelope`
  - gateway validates the final estimate against model capabilities
- `localLayerEnvelope` is derived by orchestrator only:
  - `request_target_input = min(scene.reference_input, model_capabilities.recommended_operating_input_tokens ?? scene.reference_input)`
  - `request_soft_ceiling = min(scene.reference_input * soft_total_ratio, model_capabilities.input_window_tokens - output_reserve)`
  - `request_hard_ceiling = min(scene.reference_input * hard_total_ratio, model_capabilities.input_window_tokens - output_reserve)`
  - `non_layer_tokens = static_system_tokens + route_wrapper_tokens + tool_tokens + current_user_input_tokens`
  - `local_target = max(0, request_target_input - non_layer_tokens)`
  - `local_soft = max(0, request_soft_ceiling - non_layer_tokens)`
  - `local_hard = max(0, request_hard_ceiling - non_layer_tokens)`
- `PromptBudgetDecision.estimated_total_input` MUST equal `non_layer_tokens + sum(bucket_tokens)` and is the value gateway validates.

### Scene budget contract
- Introduce `PromptSceneBudgetConfig`:
  - `request_budget.reference_input`
  - `request_budget.soft_total_ratio`
  - `request_budget.hard_total_ratio`
  - `request_budget.output_reserve`
  - `buckets.hard_control`
  - `buckets.compact_control`
  - `buckets.current_context`
  - `buckets.memory`
  - `buckets.soft_expression`
  - `compiler_policy`
- Freeze global request-budget defaults:

| Scene | reference_input | soft_total_ratio | hard_total_ratio | output_reserve |
| --- | ---: | ---: | ---: | ---: |
| `forum_post` | 12000 | 1.30 | 1.55 | 1200 |
| `forum_comment` | 8000 | 1.25 | 1.45 | 800 |
| `scheduled_post` | 12000 | 1.30 | 1.55 | 1200 |
| `private_chat` | 10000 | 1.25 | 1.50 | 900 |
| `chat_room` | 5000 | 1.25 | 1.45 | 600 |
| `proactive_dm` | 6000 | 1.15 | 1.30 | 700 |

- Freeze public-scene bucket defaults:

| Scene | hard_control | compact_control | current_context | memory | soft_expression |
| --- | --- | --- | --- | --- | --- |
| `forum_post` | 8/10/13% | 12/15/19% | 28/36/46% | 18/26/38% | 6/10/15% |
| `forum_comment` | 9/11/14% | 12/15/20% | 35/42/52% | 12/20/30% | 5/8/12% |
| `scheduled_post` | same as `forum_post` | same as `forum_post` | same as `forum_post` | same as `forum_post` | same as `forum_post` |

- Freeze downstream-sensitive defaults for later packages:
  - `private_chat`: `hard 10/12/15`, `compact 14/18/22`, `current 24/30/38`, `memory 16/24/36`, `soft 5/8/12`
  - `chat_room`: `hard 10/12/15`, `compact 12/16/20`, `current 35/45/55`, `memory 10/18/28`, `soft 5/8/12`
  - `proactive_dm`: `hard 12/14/18`, `compact 14/18/22`, `current 22/28/35`, `memory 14/22/32`, `soft 4/7/10`
- `scheduled_post` reuses `forum_post` config by default.

### Route -> orchestrator raw-source contract
- Public routes provide `currentContextSources[]`, where each item includes:
  - `kind`
  - `text`
  - `priority`
  - `source_id?`
- Package 1 freezes the public-source taxonomy:
  - `post_body`
  - `thread_excerpt`
  - `target_comment`
  - `community_context`
  - `local_intent`
  - `scheduler_context`
- `priority` is semantic, not token-budgeted length; route passes raw evidence only and MUST NOT pre-shrink final block text to hit budget.

### Control compiler
- Compile source control inputs into one of three tiers:
  - `minimal`
  - `compact`
  - `expanded`
- The compiler MUST preserve hard-control semantics while allowing wording shrinkage.
- `PromptBudgetDecision.control_tier_applied` is the authoritative record of the chosen tier.
- V2 uses one compiler pipeline across all scenes; scene config controls:
  - `min_control_tier`
  - `max_control_tier`
  - `default_memory_tier`
  - `allow_soft_overflow`

### Template contract
- V2 templates consume only compiled blocks:
  - `hard_control_block`
  - `compact_control_block`
  - `current_context_block`
  - `memory_block`
  - `soft_expression_block`
- Public V2 template migration MUST keep legacy template refs available for non-migrated scenes.
- Until Package 2 lands, `memory_block` may be backed by a legacy memory adapter, but the template contract is already V2.
- Legacy source-to-block mapping is frozen:
  - `privacy`, `boundary safety`, `scene/local intent`, `community hard rules`, and any `hard` override -> `hard_control_block`
  - `instructions`, `persona`, `relationship`, `minimal continuity`, and any `compact` override -> `compact_control_block`
  - route-scoped evidence only -> `current_context_block`
  - memory renderer output only -> `memory_block`
  - `style`, `community soft culture`, expanded wording, and any `soft` override -> `soft_expression_block`
- `style` belongs to `soft_expression_block` by default. Only boundary-like wording constraints may be promoted by compiler policy; they are no longer treated as style.
- `overrides` do not have a dedicated side-channel in V2. They MUST be normalized into `hard / compact / soft`, and any unclassified override MUST default to `soft_expression_block` plus a lint warning.
- To satisfy prompt-contract review, `hard_control_block` MUST expose an ordered `## 隐私与边界` subsection before any other control subsection. This keeps privacy semantics explicit even though privacy remains part of the `hard_control` bucket.

### Gateway passive validation
- Add `.ai/llm-config/registry/model_capabilities.yaml` with:
  - `input_window_tokens`
  - `max_output_tokens`
  - `recommended_operating_input_tokens`
- Extend `LLMGatewayRequest` with a prompt-budget summary:
  - target/soft/hard budgets
  - estimated input
  - output reserve
  - bucket totals
- Gateway performs passive validation after profile/model resolution and emits warnings when `estimated_input + output_reserve` exceeds model capabilities.
- If model capability metadata is missing, gateway emits `model_capability_missing` warning and continues.

### Audit and observability contract
- Package 1 freezes the shared budget-observability vocabulary:
  - `target_budget`
  - `soft_ceiling`
  - `hard_ceiling`
  - `actual_input_estimate`
  - `hard_control_tokens`
  - `compact_control_tokens`
  - `current_context_tokens`
  - `memory_tokens`
  - `soft_expression_tokens`
  - `control_tier_applied`
  - `overflow_reason`
  - `overflow_rate_by_scene`
  - `bucket_survival_ratio`
- Package 2 may add memory-specific fields, but it may not rename or reinterpret the shared vocabulary.

### Package 1 review gate
- Package 2 is blocked until the following artifacts exist and are reviewed:
  - public-scene token-math examples for `requestEnvelope -> localLayerEnvelope`
  - signed-off block mapping for privacy/style/overrides/local intent
  - low/medium/high-memory evidence for `forum_post`, `forum_comment`, `scheduled_post`
  - confirmed public-scene default config table
  - no unresolved decision on high-value visible-envelope escalation

## Boundaries & dependency rules
- Package 1 owns public-scene budget authority and passive gateway validation.
- Package 1 does not redefine memory retrieval/storage; it only defines how a `memory_block` enters V2 templates.
- Package 2 depends on Package 1 contracts and replaces the temporary memory adapter with structured memory tiers.
- Package 3 depends on Package 1 V2 template contract for sensitive-scene cutover.

## Exit criteria
- Public scene call sites speak V2 raw-source and V2 block contracts.
- Control tier selection is explicit in runtime audit.
- Gateway warnings are available for window mismatch without any routing side effect.
- Package 1 review gate has been executed and closed before Package 2 starts.

## Open questions
- none
