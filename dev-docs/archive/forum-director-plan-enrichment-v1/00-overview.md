# 00 Overview — forum-director-plan-enrichment-v1 (T-987)

## Status
- State: done
- Depends on: existing `director_plan` registry lane, `PublicSceneSelectorService`, `ForumSceneContinuityService`
- Current status: root-only forum `director_plan` enrichment is implemented, regression coverage passes, and local-k8s runtime validation is complete. The hidden planner now executes successfully in the deployed runtime on `token-plan-openai/qwen3.6-plus`, admin/browser regressions found during staging validation have been fixed, and the media fallback path was validated end-to-end with a one-off `qwen-image-2.0` provider key.
- Next step: no further code work is required for `T-987`; any follow-up should be tracked separately as provider credential rotation/runtime alignment work if the environment needs persistent `qwen-image-2.0` coverage without one-off overrides.

## Goal
Add a robust forum-first hidden `director_plan` entrypoint that enriches root public scene payloads without changing scene authority or introducing thread-level replanning.

## Non-goals
- Do not add thread-aware tactical replanning for `forum_thread_followup`.
- Do not let the model rewrite scene selection, binding, phase, or targeting fields.
- Do not expose thick hidden director text to visible actor prompts.
- Do not add new public APIs, new env keys, or new routing profiles/policies.

## Context
The repo already has a registry-owned hidden `director_plan` lane on `qwen-director-v1`, but no prompt template ref, no prompt template registry entry, and no real forum callsite. Forum root scenes are currently built deterministically in `PublicSceneSelectorService`, and thread continuity inherits root scene payloads. This makes the gap a product-entry wiring problem, not a model-matrix gap.

## Acceptance criteria (high level)
- [x] Root forum scenes (`scheduled_post`, `forum_post_seed`) call a hidden `director_plan` enrichment service and merge only allowed fields.
- [x] `forum_thread_followup` continues without LLM replanning and inherits enriched `target_mood` / `must_hit_points` / `avoid_repeat`.
- [x] Prompt/template registry and prompt ref wiring exist for `internal-forum-scene-plan@1`.
- [x] `planning_audit.director_plan_enrichment` records applied and fail-closed outcomes.
- [x] Continuity hard/soft constraint shaping stays within public-director contract limits.
- [x] Targeted selector, continuity, search projection, and callsite inventory tests pass.
