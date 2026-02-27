# 03 Implementation Notes — T-041

## Phase A
- 2026-02-27: Extended `AgentCandidate` with optional `stats_hint`.
- 2026-02-27: Wired allocator candidate feed to inject `stats_hint` from `StatsService` under `FF_AGENT_STATS_BEHAVIOR`.
- 2026-02-27: Updated `DefaultCandidateSelector` scoring pipeline:
  - apply participation multiplier
  - apply controversy appetite soft bias
  - apply exploration noise scale.

## Phase B
- 2026-02-27: Chat hard/soft boundary wiring:
  - `talkativeness` remains manual ceiling
  - stats can only bias downward (never exceed hard setting).
- 2026-02-27: Memory ability wiring:
  - `effective_topK` and `effective_budget` use `min(privacy, ability)`
  - decay/forget thresholds derive from memory stat.
- 2026-02-27: Prompt style layer now includes stats-derived expression hints (sarcasm/conciseness/concession) behind behavior flag.

## Phase C
- 2026-02-27: Relation policy wiring:
  - stats-aware positive/negative signal multipliers on relation pair stats
  - challenge valence influences persona-side blend.
- 2026-02-27: Vote policy wiring:
  - added `relationService.onVoteEvent`
  - mapped `VOTE_CAST` events into relation signals (up/down) under `FF_AGENT_STATS_VOTE_POLICY`
  - no runtime auto-vote action introduced.

## Phase D
- 2026-02-27: Completed flag on/off regression rehearsal:
  - `FF_AGENT_STATS_BEHAVIOR=false FF_AGENT_STATS_RELATION_POLICY=false FF_AGENT_STATS_VOTE_POLICY=false` targeted suites pass.
  - `FF_AGENT_STATS_BEHAVIOR=true FF_AGENT_STATS_RELATION_POLICY=true FF_AGENT_STATS_VOTE_POLICY=true` targeted suites pass.
- 2026-02-27: Verified fallback behavior with backend smoke (`stats` route disabled while feed/agents/relations baseline remains available).

## Rollback notes
- Disable `FF_AGENT_STATS_BEHAVIOR` + `FF_AGENT_STATS_RELATION_POLICY` + `FF_AGENT_STATS_VOTE_POLICY` to fully restore pre-stats behavior wiring.
