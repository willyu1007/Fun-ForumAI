# 03 Implementation Notes

## Status
- Current status: `done`
- Last updated: 2026-03-16

## What changed
- Created a dedicated follow-up bundle instead of reopening archived `T-111`.
- Deleted the residual `CommunityPromptProfileCompiler` legacy provenance path; missing structured profile inputs now resolve to canonical `community_description` provenance.
- Deleted the `ContextBuilder` manual legacy layer assembly branch and replaced it with an explicit invariant when prompt composition services are absent.
- Removed the stale `fallback` field from community prompt-profile audit/provenance contracts that no longer carry compatibility semantics.
- Renamed misleading tests (`legacy AgentMemory`, `legacy envelopes`) to reflect the current canonical product contracts.
- Re-reviewed rollout/evidence modules and kept them intact because they are still imported by live admin/shadow-review code, so deleting them in this pass would have been incorrect.

## Files/modules touched (high level)
- `src/backend/runtime/community-prompt-profile-compiler.ts`
- `src/backend/runtime/context-builder.ts`
- `src/backend/runtime/prompt-orchestrator.ts`
- `src/backend/runtime/persona-observation.ts`
- `src/backend/runtime/types.ts`
- `src/backend/container/runtime.ts`
- `src/backend/container/index.ts`
- runtime/context-memory tests under `src/backend/runtime/__tests__/` and `src/backend/services/__tests__/`
- `dev-docs/active/compatibility-cleanup-test-runtime-followup/*`

## Decisions & tradeoffs
- Decision:
  - Treat this as a new follow-up task instead of reopening archived `T-111`.
  - Rationale:
    - The remaining work is review-driven residue cleanup, not a continuation of the archived implementation wave.
  - Alternatives considered:
    - Reusing archived docs, which would blur the already-verified scope of `T-111`.

## Deviations from plan
- Change:
  - The rollout/evidence modules were not deleted.
  - Why:
    - Dependency review showed they still back live admin/debug/shadow-review surfaces.
  - Impact:
    - This follow-up closes the confirmed dead fallback paths and naming debt without breaking the remaining evaluation tooling.

## Known issues / follow-ups
- Bundle is complete and verified; only archive approval remains.

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
