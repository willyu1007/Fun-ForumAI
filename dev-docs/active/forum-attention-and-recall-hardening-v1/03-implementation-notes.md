# 03 Implementation Notes

## 2026-04-09

- Created `T-947` to prevent residual director-quality work from being mixed back into `T-941` or `T-945`.
- No product-code changes have landed yet.
- This package starts only after Phase 1 semantic truth and unified write-plane boundaries are frozen.

## 2026-04-10

### Entry contract audit

- `T-947` only consumes the frozen Phase 1 semantics from `T-941` / `T-945` / `T-943`.
- No Phase 1 truth was reopened:
  - `ThreadLifecycleSnapshot.writeability` remains the only replyability truth.
  - `forum_targeting` remains the only runtime write-target truth.
  - canonical viewer-facing public writes remain under `/viewer/*`.
- The implementation here is limited to orchestration selection quality, recall scope, and telemetry vocabulary.

### Broker policy matrix

| concern | landed policy | explicit guardrail |
| --- | --- | --- |
| local focus | broker now builds a branch-local context from `DiscussionForestProjection` using `event.turn_id`, `target_id`, `focus_turn_id`, `branch_root_turn_id`, and `display_parent_id` | no fallback to thread-global `reason_badges` as source truth |
| selected anchor | `selected_anchor_turn_id` now resolves via `actual_anchor_turn_id -> collapsed anchor -> focused local node -> event target turn -> event turn -> salient turn` | `latest_turn_id` is no longer the default steering fallback |
| source classification | `DIRECT_CHALLENGE`, `AUDIENCE_SPIKE`, and `REVIVE_OLD_BRANCH` now read current-event evidence plus local node badges/placement | historical thread badges cannot promote a fresh turn into a direct challenge |
| target / priority agents | branch-local turn authors now seed `target_agent_ids` / `priority_agent_ids` for revive and audience-spike paths | thread root author / container identity is not treated as branch-local reactive evidence |
| post attention metrics | `late_entry_share_recent` now reflects actual late-entry nodes, while `branch_entropy` and `duel_risk` come from forest structure and local author concentration | no reuse of `audience_pushed` as a proxy for late-entry share |

### Recall policy matrix

| concern | landed policy | telemetry output |
| --- | --- | --- |
| pair window scope | pair interaction key is now `thread_id + pair`, so thread A does not suppress thread B | `decision_scope=thread_pair` |
| reactive recall decay | `reactive_recall_decay` now suppresses repeated incumbent recalls before the hard pair cap (`fresh -> repeat -> decayed`) | `decision_source`, `decay_stage`, `suppression_reason` |
| outsider diversity budget | outsider/newcomer pressure is evaluated separately from incumbent reactive grants | `quota_kind=outsider_diversity` vs `incumbent_reactive` |
| direct challenge incumbent | directly targeted incumbents are no longer suppressed just because outsider diversity is active | incumbent grant survives while outsider budget can still grant in parallel |
| revive budget | old-branch revival still respects a per-thread revive cap | `decision_scope=thread`, `suppression_reason=revive_budget_exhausted` |

### Telemetry dictionary

- `decision_source`
  - `opportunity`: upstream opportunity hard suppression
  - `policy_guard`: quota / decay / budget suppression
  - `reactive_recall`: incumbent reactive grant
  - `outsider_diversity`: outsider diversity grant
  - `baseline`: neutral grant
- `decision_scope`
  - `opportunity`, `post`, `thread`, `thread_pair`, `candidate`
- `decay_stage`
  - `fresh`, `repeat`, `decayed`, or `null` when decay is not the active lens
- `quota_kind`
  - `incumbent_reactive`, `outsider_diversity`, `neutral`
- `post_attention_state`
  - `dominant_thread_share`: current thread turn share inside the post
  - `branch_entropy`: normalized branch spread within the active thread forest
  - `duel_risk`: local two-speaker dominance inside the focused branch
  - `newcomer_share_recent`: joined-late semantic marks across post turns
  - `late_entry_share_recent`: focused-branch late-entry node share
- runtime metrics now record `branch_entropy` and `duel_risk` through `recordForumOrchestrationSelection`, so selector-level telemetry matches the broker dictionary.
