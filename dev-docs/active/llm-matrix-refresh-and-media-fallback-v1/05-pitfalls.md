# 05 Pitfalls (do not repeat) — T-201

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- Do not assume product branding equals upstream API `model_id`; confirm exact IDs before editing registry files.
- Do not use image-generation models for vision semantic extraction just because they share a provider family.
- Do not introduce raw `extra_body` passthrough to satisfy one provider; keep provider-specific controls typed and reviewable.
- Do not model media-generation fallback as a single mutable provider/model string; use explicit primary/fallback routing.
- Do not let Doubao model adoption drift into an unplanned new `voice_line_id`; a new voice line is a separate product/runtime change.
- Do not leave hidden/director line ids named after a provider family once the canonical provider/model strategy changes; hidden lines also need semantic primary keys.

## Pitfall log (append-only)

### 2026-04-14 - Planning bundle baseline
- Symptom:
  - The migration scope touched registries, runtime routing, media generation, and env/docs, making it easy to skip planning and mix low-risk replacements with architectural changes.
- Context:
  - The user asked to align on a roadmap and complete task bundle before implementation.
- What we tried:
  - Reviewed existing provider/runtime and media task context before drafting the bundle.
- Why it failed (or current hypothesis):
  - N/A; this is a preventive baseline entry.
- Fix / workaround (if any):
  - Created a full bundle and separated the work into registry migration, director/vision convergence, media generation failover, and typed provider extensions.
- Prevention (how to avoid repeating it):
  - Keep implementation slices aligned to the roadmap phases and avoid starting runtime changes before the matrix lock is complete.
- References (paths/commands/log keywords):
  - `dev-docs/active/llm-matrix-refresh-and-media-fallback-v1/roadmap.md`

### 2026-04-14 - Visible voice line cannot be all-shadow in provider admission
- Symptom:
  - `validate-llm-registry.mjs` failed with `Visible profile kimi-deep-chat-reply-lite has no admitted candidates in provider_admission.yaml` when Kimi was restored as a visible line with all candidates marked `shadow`.
- Context:
  - During the Doubao/Kimi canonicalization slice, the first attempt kept `kimi-deep-v1` semantically restored but tried to enforce “inactive” entirely through `provider_admission`.
- What we tried:
  - Added a real `doubao-deep-v1` line and moved the active Doubao profiles there, but left the restored Kimi visible line with zero admitted candidates.
- Why it failed (or current hypothesis):
  - Registry contract validation requires every visible profile to retain at least one admitted candidate in its admission pool.
- Fix / workaround (if any):
  - Restored Kimi with admitted fast/balanced candidates, kept the premium thinking model in `shadow`, and enforced inactivity through persona compatibility plus `FAMILY_LINE_PREFERENCE` instead of an invalid all-shadow visible pool.
- Prevention (how to avoid repeating it):
  - When a line must stay semantically real but operationally dormant, do not try to model dormancy by making a visible admission pool entirely shadow; use higher-level routing eligibility instead.
- References (paths/commands/log keywords):
  - `.ai/llm-config/registry/provider_admission.yaml`
  - `src/backend/services/inference-profile-service/compile.ts`
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`

### 2026-04-14 - Hidden director line can drift too, not only visible lines
- Symptom:
  - The hidden director line still carried the technical id `deepseek-director-v1` even after the actual director matrix had been moved to Qwen-led candidates and the catalog already displayed “Qwen Director v1”.
- Context:
  - The earlier migration focused on visible lines and director candidate ordering, so the hidden-only line id and profile ids were left unchanged to reduce churn.
- What we tried:
  - First allowed the old hidden id to persist because it was hidden-only and did not require the same live-data backfill as Doubao/Kimi.
- Why it failed (or current hypothesis):
  - Even hidden-only lines become semantic primary keys inside routing artifacts, callsite contracts, tests, and summary/runtime helpers; keeping the old provider-branded id would recreate the same “name vs reality” drift under a different surface.
- Fix / workaround (if any):
  - Canonicalized the hidden director line to `qwen-director-v1`, renamed profile ids to `qwen-director-*`, regenerated routing artifacts, and updated all active code/tests to use the canonical hidden identity.
- Prevention (how to avoid repeating it):
  - When a line’s actual provider/model family changes, review hidden-only lines with the same rigor as visible lines; hidden status is not a justification for leaving stale semantic ids behind.
- References (paths/commands/log keywords):
  - `src/shared/agent-persona-catalog.ts`
  - `.ai/llm-config/registry/model_profiles.yaml`
  - `src/backend/llm/callsite-inventory.ts`
