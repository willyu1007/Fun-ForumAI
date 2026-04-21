# 00 Overview — agent-biography-llm-dedicated-routing (T-206)

## Status
- State: done
- Depends on: `T-202 agent-biography-book-program`, `T-205 agent-biography-writer-and-factual-audit`, `T-201 llm-matrix-refresh-and-media-fallback-v1`
- Current status: biography-only hidden routing, final model ordering, prompt hardening, deterministic repair, expanded factual audit, telemetry expansion, and persistence updates have all landed.
- Current conclusion: chapter render now runs on `moonshot-v1-128k primary -> kimi-k2.5 rescue/fallback` inside the biography-only lane, while later notes remain on `qwen3.5-plus primary -> kimi-k2.5 fallback`.
- Remaining execution gap: none inside the scoped `T-206` landing; future work can tune prompts or evaluation thresholds without reopening route isolation.

## Goal
Create a dedicated LLM calling lane for agent biography writing that:

- isolates biography chapter writing and later-note rendering from other digest chains
- supports biography-specific model ordering and fallback policy
- keeps all calls inside the existing `LLMGateway` and prompt-registry governance path
- adds a safe rollout/evaluation path before any broad model promotion
- converges on a production-ready chapter-writer configuration instead of stopping at route isolation

## Non-goals
- Do not change non-biography `public_observation_digest` routes.
- Do not globally replace `qwen-director-v1` or `kimi-deep-v1`.
- Do not redesign biography UI, chapter domain, or factual-audit schemas.
- Do not introduce a second biography-specific provider client or bypass `LLMGateway`.

## Context
The current biography writer implementation introduced by `T-205` is operational, but it still resolves through the shared hidden director digest route:

- [biography-writer-service.ts](/Volumes/DataDisk/Project/Fun-ForumAI/src/backend/services/biography-writer-service.ts:309) uses `homeVoiceLineId: 'qwen-director-v1'`
- the route resolution key is `homeVoiceLineId + intent + tier`, not `executionPolicyId`
- the current biography execution policy name is misleadingly shared with agent-social-bio work and does not isolate model selection

This means a biography-specific model strategy cannot be introduced safely by editing only policy defaults or the shared `qwen-director-v1` profile.

## Acceptance criteria
- [x] A biography-only hidden routing entry is defined and justified.
- [x] The task locks whether chapter render and later-note render share one tier or split across dedicated tiers.
- [x] The first rollout isolates routing/profile/policy changes and produces live-provider evidence before prompt/parameter hardening.
- [x] Live-provider evidence now promotes chapter render to `moonshot-v1-128k primary` instead of `Kimi primary`.
- [x] The task freezes biography-only profile ids, policy ids, and fallback posture without modifying unrelated digest callsites.
- [x] The task defines a real-LLM verification path that exercises `LLMGateway -> model -> JSON parse -> audit/fallback` end to end.
- [x] The final landing upgrades chapter prompt, deterministic repair, and style/overreach audit for `moonshot-v1-128k`.
- [x] Chapter render parameters are tuned to the agreed chapter shape: `2-4` body sections, each section `2-4` sentences, with updated output/token/timeout limits.
- [x] `repair` is implemented as a deterministic pre-publish sanitization stage, not a second model call in the first production slice.
