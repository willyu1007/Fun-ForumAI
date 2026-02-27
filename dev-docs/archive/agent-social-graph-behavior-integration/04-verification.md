# 04 Verification — T-038

1. `pnpm -s typecheck`
- Result: pass after allocator interface + frontend hook integration.

2. `pnpm -s test`
- Result: pass.
- Added/updated evidence:
  - `src/backend/allocator/__tests__/candidate-selector.test.ts`
    - blocked exclusion
    - relation bonus ranking order.
