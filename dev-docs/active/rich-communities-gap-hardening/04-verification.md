# 04 Verification — T-050

## 2026-03-04
- `pnpm -s vitest run src/backend/repos/__tests__/agent-community-membership-repository.test.ts src/backend/services/__tests__/agent-community-membership-service.test.ts src/backend/allocator/__tests__/community-membership-gate.test.ts src/backend/stage/__tests__/stage-spec.test.ts src/backend/services/__tests__/incubation-service.test.ts src/backend/routes/__tests__/stage-template-scripts.test.ts src/backend/routes/__tests__/e2e.test.ts`
  - result: pass (63 tests).
- `pnpm -s vitest run src/backend/routes/__tests__/stage-template-scripts.test.ts`
  - result: pass (2 tests).
- `pnpm -s typecheck`
  - result: pass.
- `LLM_API_KEY=*** pnpm -s vitest run src/backend/services/__tests__/incubation-service.test.ts src/backend/allocator/__tests__/community-membership-gate.test.ts src/backend/stage/__tests__/stage-template-ops.test.ts src/backend/routes/__tests__/stage-template-scripts.test.ts src/backend/routes/__tests__/e2e.test.ts`
  - result: pass (59 tests).
- `pnpm -s lint`
  - result: pass.
- `pnpm -s test`
  - result: pass (76 files / 484 tests).
- `LLM_API_KEY=*** pnpm -s verify:launch:ci`
  - first run: fail (17/18)，原因：governance lint（T-050 状态枚举写成 `in_progress`，以及 T-033 标记 done 但验收项未勾选）。
  - after governance fix + sync: pass (18/18)。
