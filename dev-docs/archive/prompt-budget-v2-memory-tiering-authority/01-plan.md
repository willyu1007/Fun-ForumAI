# 01 Plan

## Phases
1. Freeze structured memory interfaces and compatibility path.
2. Implement memory tier renderer plus deterministic degradation order.
3. Move memory ceiling authority into orchestrator budget decisions.
4. Add divergence audit, overflow taxonomy, and regression coverage.
5. Review low / medium / high-memory cohorts and close Package 2 before Package 3 starts.

## Detailed steps
- Define structured memory payloads and `MemoryContextRequest` with `tokenCeiling`, `bucketTarget`, and `memoryTier`.
- Split memory pack generation from rendering so orchestrator can choose final tier based on remaining budget.
- Replace legacy `public_memory_budget` runtime use with `scene ceiling + memory ability` decisions while preserving API/storage compatibility.
- Emit owner/runtime divergence, reason codes, `bucketTarget`, and `memory_tier_applied` into prompt audit and observability outputs.
- Rename overflow reasons to distinguish memory-driven, current-context-driven, privacy-floor-driven, and hard-ceiling-enforced compaction.
- Run low / medium / high-memory cohort review against at least `forum_post`, `private_chat`, `chat_room`, and `proactive_dm` configs; if low-budget scenes still show chronic memory saturation, absorb attenuation design in this package instead of deferring it.

## Execution gates
1. Interface gate:
   - structured memory contract is frozen before renderer changes start
   - compatibility adapter from old `layer5_memory` is temporary and explicit
2. Authority gate:
   - no code path may directly use `public_memory_budget` as the final runtime ceiling
   - memory ceiling always derives from orchestrator budget decisions
3. Saturation review gate:
   - low-budget scenes do not show persistent `memory ~= max_ratio` for memory-rich cohorts without an explicit mitigation decision
   - Package 3 is blocked until the saturation review is signed off
4. Exit gate:
   - low-budget scenes compact memory before sacrificing control floor
   - audit explains both owner preference and runtime decision

## Risks & mitigations
- Risk: memory tiers collapse back to binary keep/drop behavior.
  - Mitigation: enforce five named tiers and test each degradation step.
- Risk: owner preference becomes invisible once it leaves allocation authority.
  - Mitigation: emit explicit owner/runtime divergence metrics and audit fields.
- Risk: structured memory rollout breaks existing public/private disclosure semantics.
  - Mitigation: keep disclosure metadata contract stable while changing only packing/render authority.
- Risk: memory-rich agents still swamp low-budget scenes even after tiering.
  - Mitigation: make cohort review a blocking gate and add attenuation logic here if tiering alone is insufficient.
