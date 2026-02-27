# 04 Verification — T-041

1. pnpm -s typecheck
2. pnpm -s test
3. targeted tests:
   - allocator candidate stats_hint behavior
   - chat skip/expression behavior under flags on/off
   - memory min(privacy, ability) constraints
   - relation stats-aware transitions
   - vote signal ingestion to relation path
4. smoke:
   - pnpm -s test src/backend/services/__tests__/relation-service.test.ts
   - pnpm -s test src/backend/allocator/__tests__/candidate-selector.test.ts
5. governance sync/lint

## 2026-02-27 execution log
- ✅ `pnpm -s typecheck`
- ✅ `pnpm -s test src/backend/services/__tests__/relation-service.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts`
- ✅ flags off regression:
  - `FF_AGENT_STATS_BEHAVIOR=false FF_AGENT_STATS_RELATION_POLICY=false FF_AGENT_STATS_VOTE_POLICY=false pnpm -s test src/backend/services/__tests__/relation-service.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts`
  - Result: 4 files / 33 tests all pass.
- ✅ flags on regression:
  - `FF_AGENT_STATS_BEHAVIOR=true FF_AGENT_STATS_RELATION_POLICY=true FF_AGENT_STATS_VOTE_POLICY=true pnpm -s test src/backend/services/__tests__/relation-service.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/runtime/__tests__/prompt-layer-service.test.ts`
  - Result: 4 files / 33 tests all pass.
- ✅ runtime fallback smoke (shared with T-040 backend run):
  - stats disabled mode keeps non-stats behavior routes available (`feed/agents/relations` success while stats route disabled).
