# 01 Plan

## Phases
1. Register the follow-up task bundle and capture the review findings as implementation targets. `[done]`
2. Remove the confirmed residual runtime fallback branches and update the affected tests. `[done]`
3. Re-assess rollout/evidence modules; delete only the ones that are now obsolete, otherwise reduce the change to naming/test cleanup. `[done]`
4. Run targeted suites, then full repo verification, and record the outcomes. `[done]`

## Detailed steps
- Create the task bundle and sync project governance. `[done]`
- Remove the `CommunityPromptProfileCompiler` legacy provenance path and rewrite its tests to assert canonical behavior only. `[done]`
- Remove the `ContextBuilder` manual legacy layer assembly path and replace it with an explicit invariant when prompt composition services are absent. `[done]`
- Inspect rollout/evidence modules and their route/service consumers to decide between deletion and naming cleanup. `[done]`
- Rename outdated tests that still refer to `legacy AgentMemory`, `legacy envelopes`, or similar stale terminology when the underlying behavior is now canonical. `[done]`
- Run targeted tests for runtime/context-memory/admin surfaces, then run full repo gates. `[done]`

## Risks & mitigations
- Risk: deleting a fallback branch that still has a live runtime caller.
- Mitigation: inspect constructor wiring/import graph before deleting, and prefer an explicit failure over silent fallback when composition deps are absent.
- Risk: rollout/evidence code may still back an admin/debug surface.
- Mitigation: only delete it if all remaining consumers are transitional; otherwise keep the runtime and only clean stale naming/tests in this pass.
- Risk: test cleanup may hide a real behavior gap.
- Mitigation: update tests only alongside code-path review and rerun targeted suites before full verification.
