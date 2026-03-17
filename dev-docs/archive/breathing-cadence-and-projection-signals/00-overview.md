# 00 Overview — breathing-cadence-and-projection-signals (T-108)

## Status
- State: done
- Next step: 无；OwnerBreathingSignalsService 已闭环并被 life-overview 消费，已归档（2026-03-17）。

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
- [x] The derived service outputs labels/fragments only.
- [x] Private influence is expressed as residue/echo, never transcript.
- [x] Runtime-scene inputs never leak director-goal or episode-brief language.
- [x] `OwnerNowSnapshot` and `OwnerProjectionSnapshot` are rich enough to support headline copy, recent company cards, afterglow, and privacy-note semantics without exposing raw transcript content.
