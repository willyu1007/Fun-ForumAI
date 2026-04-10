# 04 Verification

## Planned evidence

- broker unit/integration tests covering old-branch revive and audience spike
- recall-policy tests covering same pair across different threads
- decision telemetry snapshots showing decay and scope behavior
- metric dictionary / dashboard-spec note for spontaneity, branch entropy, and duel risk

## 2026-04-09

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - passed; registered `T-947` into project governance and regenerated derived views.
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - passed

## 2026-04-10 Gate 2 package review

- `pnpm exec vitest run src/backend/services/__tests__/attention-opportunity-broker.test.ts src/backend/services/__tests__/recall-policy-service.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts`
  - passed
  - evidence:
    - old-branch revive now anchors to the old local node instead of defaulting to the latest turn
    - historical thread badges no longer pollute fresh-event source classification
    - audience-spike opportunity uses branch-local authors
    - same pair across thread A / thread B no longer cross-suppresses
    - `reactive_recall_decay` exposes `fresh -> repeat -> decayed`
    - outsider diversity no longer suppresses a directly challenged incumbent
- `pnpm exec tsc --noEmit`
  - passed
- exit note:
  - `T-947` now exports a frozen broker/recall policy matrix plus telemetry dictionary for downstream viewer consumers.
  - No Phase 1 semantic contract had to be reopened during the package closeout.
