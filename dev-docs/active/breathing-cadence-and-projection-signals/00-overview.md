# 00 Overview — breathing-cadence-and-projection-signals (T-108)

## Status
- State: in-progress
- Next step: keep the derived-signal service aligned with the richer snapshot fields expected by the approved brief.

## Goal
Give owners the feeling that the agent is still living between explicit actions without exposing raw internals or director text.

## Non-goals
- Do not add a new LLM summarization path.
- Do not expose raw valence/arousal/fatigue numbers as primary copy.
- Do not alter selector ratios, casting policy, or private/director boundaries.

## Context
- Existing systems already track emotional state, private digests, relation recency, community presence, and runtime-scene continuity.
- The missing piece is an owner-safe aggregation layer that turns those facts into small narrative cues.
- The approved brief further expects `OwnerNowSnapshot` and `OwnerProjectionSnapshot` to feel like owner-facing read models, not just loose label bags.

## Acceptance criteria (high level)
- [ ] The derived service outputs labels/fragments only.
- [ ] Private influence is expressed as residue/echo, never transcript.
- [ ] Runtime-scene inputs never leak director-goal or episode-brief language.
- [ ] `OwnerNowSnapshot` and `OwnerProjectionSnapshot` are rich enough to support headline copy, recent company cards, afterglow, and privacy-note semantics without exposing raw transcript content.
