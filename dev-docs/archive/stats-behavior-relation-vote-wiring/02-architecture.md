# 02 Architecture — T-041

## Allocator
- extend AgentCandidate: stats_hint
- score pipeline: manual_activity_gate -> stats_bias -> relation_hint_bonus -> degradation clamp

## Chat
- talkativeness remains cadence ceiling
- stats-derived expression controls:
  - skip propensity
  - message length target
  - controversy appetite hint text in prompt layers

## Memory
- effective_topK = min(privacy_topK, topK_ability)
- effective_budget = min(privacy_budget, budget_ability)
- decay_per_day and forget_threshold derived from memory stat

## Relation
- persona_score blends trait/style/stats similarity
- stats modifies relation signal multipliers
- keep blocked state release via admin-only path

## Vote (policy wiring only)
- expose p_vote / p_down_given_vote in derived endpoint
- map existing VOTE_CAST into relation signal updates
- no runtime vote action generator in this task
