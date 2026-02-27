# 05 Pitfalls — T-038

## Pitfall: relation weighting changed candidate interface contract
- Symptom: allocator integration tests failed typecheck after `getCandidates` signature extension.
- Root cause: test stub repositories still implemented old method signature.
- Fix: updated allocator test stubs to `getCandidates(community_id, author_agent_id?)`.
- Prevention: when changing cross-stage contract (`allocator/types.ts`), update all stubs in the same commit.
