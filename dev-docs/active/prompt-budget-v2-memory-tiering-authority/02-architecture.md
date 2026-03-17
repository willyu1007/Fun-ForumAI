# 02 Architecture

## Context & current state
- Current memory retrieval already uses slot-based packing, but `PromptLayerService` still renders a final string before `PromptOrchestrator` decides scene budget.
- `public_memory_budget` currently enters runtime allocation through privacy settings, then gets clamped by memory ability, which still leaves authority split across layers.
- `PromptOrchestrator` counts memory against its trim threshold but cannot request a smaller or more compact memory render.

## Proposed design

### Structured memory contract
- Replace final-string memory output with a structured bundle:
  - slot metadata
  - ranked items
  - disclosure metadata
  - token estimates by slot
  - `renderHints` for title/bullet/summary fallback
- The orchestrator requests a final render through `MemoryContextRequest`:
  - `scene`
  - `topicHints`
  - `disclosureLevel`
  - `topK`
  - `tokenCeiling`
  - `bucketTarget`
  - `memoryTier`
- `bucketTarget` is the orchestrator-owned target token count for the `memory` bucket after `hard_control + compact_control + current_context` floors are secured. `tokenCeiling` remains the absolute cap.
- `PromptLayerService` MUST expose enough structure for renderer downgrade without re-running retrieval. Retrieval/ranking may refresh the pack, but renderer downgrade cannot require a second prompt-shaping pass.

### Memory tier model
- Supported tiers:
  - `full`
  - `compact`
  - `sparse`
  - `minimal`
  - `drop_low_value`
- Fixed degradation order:
  1. shorten titles and bullets
  2. reduce slot count
  3. reduce items per slot
  4. collapse card bullets into summaries
  5. remove low-salience / low-relevance / low-scene-value sections
- V2 does not introduce a separate scene-specific attenuation algorithm by default. If cohort review shows chronic over-saturation after tiering, attenuation becomes an explicit follow-up deliverable owned by Package 2, not a Package 3 concern.

### Authority model
- Runtime ceiling derives from:
  - scene budget config
  - agent memory ability
  - remaining budget after `hard_control + compact_control + current_context`
- Runtime memory decision order is frozen:
  1. reserve `hard_control.guaranteed`
  2. reserve `compact_control.guaranteed`
  3. reserve `current_context.guaranteed`
  4. compute `memory.bucketTarget = min(scene.memory.preferred ceiling, remaining budget after floors)`
  5. compute `memory.tokenCeiling = min(scene.memory.max ceiling, agent memory ability, local hard ceiling remainder)`
  6. choose the highest memory tier that fits within `bucketTarget`, then compact further if `tokenCeiling` still demands it
- `public_memory_budget` remains a stored preference and UI/API field, but it does not decide final runtime allocation.
- The system MUST record divergence between owner preference and runtime-applied ceiling for explainability.
- Owner/runtime divergence MUST include a reason code:
  - `scene_memory_ceiling`
  - `agent_memory_ability`
  - `remaining_budget_after_floors`
  - `hard_ceiling_guard`
  - `manual_scene_policy`

### Overflow taxonomy
- Replace misleading single-cause trim names with:
  - `budget_exceeded_after_control_trim`
  - `budget_exceeded_due_to_memory`
  - `budget_exceeded_due_to_privacy_and_memory_floor`
  - `control_floor_exceeds_target_budget`
  - `current_context_exceeds_target_budget`
  - `hard_ceiling_enforced_memory_compacted`
  - `soft_overflow_applied`
- `budget_exceeded_due_to_privacy_and_memory_floor` is reserved for cases where required privacy/boundary content plus remaining memory floor exceed the target budget after current-context floor is honored.
- `hard_ceiling_enforced_memory_compacted` is reserved for cases where the request is still valid, but memory had to compact further solely to remain within the hard ceiling.

### Observability
- Extend prompt audit / persona observation / runtime metrics with:
  - `actual_input_estimate`
  - `target_budget / soft_ceiling / hard_ceiling`
  - `memory_tier_applied`
  - `bucketTarget`
  - `bucket_tokens.memory`
  - owner/runtime divergence
  - owner/runtime divergence reason
  - `overflow_rate_by_scene`
  - `bucket_survival_ratio`
  - memory-survival metrics

### Package 2 review gate
- Package 3 is blocked until the following artifacts exist and are reviewed:
  - low / medium / high-memory cohort evidence across `forum_post`, `private_chat`, `chat_room`, and `proactive_dm`
  - signed-off overflow taxonomy with all seven reason codes exercised or explicitly justified
  - confirmed owner/runtime divergence reason-code table
  - explicit conclusion on whether memory-rich attenuation is still unnecessary after tiering
  - proof that `hard_control` and `current_context` floors survive before memory spends beyond `bucketTarget`

## Boundaries & dependency rules
- Package 2 depends on Package 1's `PromptBudgetDecision` and V2 bucket contract.
- Package 2 must not reintroduce owner preference as a hidden runtime budget override.
- Package 3 consumes Package 2's structured memory interface when migrating sensitive scenes.

## Exit criteria
- memory is rendered only after orchestrator budget authority decides its ceiling and tier.
- audit can distinguish memory-driven overflow from current-context-driven overflow.
- owner preference remains visible but is no longer runtime-authoritative.
- Package 2 review gate has been executed and closed before Package 3 starts.

## Open questions
- none
