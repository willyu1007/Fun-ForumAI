# 04 Verification — T-301

## Planned Verification

- `pnpm db:validate`
- targeted backend repository/service/route tests
- targeted runtime instrumentation tests
- targeted LLM connectivity diagnostics tests
- targeted retention cleanup tests
- targeted DB diagnostic and business-node instrumentation tests
- targeted infra snapshot route/service tests
- targeted feature-flag and payload-limit tests
- targeted frontend admin page tests
- `pnpm typecheck`
- `pnpm lint`
- local admin console smoke test after implementation

## Runs

- 2026-04-26: Task package created; implementation verification not applicable yet.
- 2026-04-26: `node .ai/scripts/ctl-project-governance.mjs sync --apply`
  - Result: passed; updated registry, dashboard, feature-map, and task-index.
- 2026-04-26: `node .ai/scripts/ctl-project-governance.mjs lint --check`
  - Result: passed.
- 2026-04-26: `rg -n "T-301|runtime-operation-records-console" .ai/project/main/registry.yaml .ai/project/main/task-index.md .ai/project/main/feature-map.md .ai/project/main/dashboard.md`
  - Result: passed; task is registered in all expected project hub views.
- 2026-04-26: Roadmap alignment updated from user answers.
  - Result: documentation-only update; implementation verification not applicable yet.
- 2026-04-26: `node .ai/scripts/ctl-project-governance.mjs lint --check`
  - Result: passed after roadmap alignment updates.
- 2026-04-26: LLM connectivity alignment updated.
  - Result: use existing gateway + tiny diagnostic prompt; manual test results remain transient and are not written as runtime operation records.
- 2026-04-26: Coverage and cleanup alignment updated.
  - Result: LLM table includes concrete model name/model ID; operation record coverage boundaries documented; retention cleanup added as scheduled/CLI/backend maintenance first, with console manual cleanup deferred.
- 2026-04-26: DB diagnostics and business node instrumentation alignment updated.
  - Result: phase 1 includes lightweight DB connectivity/latency/error signals and key runtime/public-output milestones; manual cleanup remains out of scope.
- 2026-04-26: Infra snapshot alignment updated.
  - Result: phase 1 includes a read-only infra snapshot for process/API/Postgres/Redis/SSE/LLM/storage health; snapshots are not persisted as operation records.
- 2026-04-26: Final implementation defaults aligned.
  - Result: split write/UI feature flags, backend service + CLI cleanup, 15s infra polling, manual-only LLM connectivity tests, and bounded operation-record payloads.
- 2026-04-26: Detailed execution plan created.
  - Result: `06-execution-plan.md` added; no product code changed.
- 2026-04-26: Contract-level task package review completed.
  - Result: `07-contract-review.md` added; stale LLM diagnostic open item removed; feature flags, API/data contracts, LLM diagnostic prompt contract, and slice entry/exit reviews locked.
- 2026-04-26: `node .ai/scripts/ctl-project-governance.mjs lint --check`
  - Result: passed after contract review updates.
- 2026-04-26: `node .ai/scripts/ctl-project-governance.mjs lint --check`
  - Result: passed after locking exact LLM diagnostic gateway fields in `07-contract-review.md`.
