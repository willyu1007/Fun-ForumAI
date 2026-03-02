# 04 Verification

## Commands run (this implementation pass)
1. `pnpm -s db:generate` -> pass
2. `pnpm -s typecheck` -> pass
3. `pnpm -s vitest run src/backend/routes/__tests__/e2e.test.ts src/backend/services/__tests__/agent-community-membership-service.test.ts src/backend/repos/__tests__/agent-community-membership-repository.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/allocator/__tests__/casting-director-policy.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts` -> fail once（调整 chronicle_entries 口径后复测通过）
4. `pnpm -s vitest run src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/routes/__tests__/e2e.test.ts` -> pass
5. `pnpm -s typecheck` -> pass
6. `pnpm -s vitest run src/backend/repos/__tests__/agent-signal-log-repository.test.ts src/backend/repos/__tests__/community-culture-digest-repository.test.ts src/backend/runtime/__tests__/community-prompt-profile-compiler.test.ts src/backend/allocator/__tests__/ppr-topic-key.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts src/backend/routes/__tests__/e2e.test.ts` -> pass
7. `pnpm -s test` -> pass
   - Result: 68 files, 446 tests passed

## Governance checks
1. `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` -> pass
2. `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` -> pass（有历史 warning，不阻断）

## Functional verification map
- PKG-0: memberships route + allocator explicit membership reason + backfill logic
- PKG-1: grouped highlights API + `/highlights` frontend route
- PKG-2: signal dual-write + chronicle narrative metric isolation + public signal suppression
- PKG-3: director v2 hard guard + role distribution policy behavior
- PKG-4: ppr refresh v2 strategy + topic weighted key + batch comment pull
- PKG-5: digest repository/service/scheduler + compiler digest injection
- PKG-6: runtime features endpoint + startup snapshot + counters instrumentation

## Pending staging evidence
- top-k stability uplift >= 25%
- public highlights noise reduction >= 40%
- allocator extra p95 <= 20ms
- local K8S staging real-call cost report
