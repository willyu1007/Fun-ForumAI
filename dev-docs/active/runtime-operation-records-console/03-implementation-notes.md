# 03 Implementation Notes — T-301

## 2026-04-26

- Created the task package for roadmap and requirement alignment.
- No product code, schema, API, or frontend implementation has been changed.
- Initial design direction: build a read-only runtime operation ledger first, add trace stitching, and defer governance escalation to a later pass.
- Synced project governance so `T-301` is discoverable from registry, dashboard, feature-map, and task-index.
- Updated roadmap alignment from user input:
  - retain error/critical for 90 days, warn for 30 days, sampled info/success for 7 days
  - phase 1 records warn/error/critical plus selected lifecycle markers
  - add an LLM connectivity table for staging-active interfaces with safe manual tests
  - exclude private-chat-specific exception handling from this pass
  - use dedicated `/admin/runtime-records` page
  - keep current pass read-only with no governance escalation
  - use the existing LLM gateway path with a dedicated tiny diagnostic prompt for manual connectivity tests
  - keep manual LLM connectivity test results transient; do not persist them as runtime operation records
  - show concrete model name/model ID in the LLM connectivity table
  - document that operation records cover most instrumented runtime/LLM/provider triage, but not infra/APM, DB tracing, private-chat-specific diagnostics, or uninstrumented bugs
  - add lightweight DB diagnostics and business-critical node instrumentation to improve production bug triage
  - add a read-only infra snapshot for current process/API/Postgres/Redis/SSE/LLM/storage health
  - keep infra snapshot separate from persisted operation records
  - prefer scheduled/CLI/backend retention cleanup; do not add console manual cleanup in this pass
  - split operation-record write flag from admin UI visibility flag
  - implement retention cleanup as backend service plus CLI entrypoint first
  - poll infra snapshot every 15 seconds; keep LLM connectivity checks manual-only
  - bound operation-record payloads with structured summaries, string truncation around 1-2KB, and overall payload target around 8-16KB
- Added `06-execution-plan.md` as the detailed implementation landing plan with slices, likely files, APIs, verification, rollout, and rollback.
- Completed contract-level review of the task package.
  - Result: no phase-1 requirement gaps remain after adding `07-contract-review.md`.
  - Locked flags: `FF_RUNTIME_OPERATION_RECORDS_WRITE`, `FF_ADMIN_RUNTIME_RECORDS_UI`, and `VITE_FF_ADMIN_RUNTIME_RECORDS_UI`.
  - Locked API contracts: operation record list/detail, infra snapshot, LLM connectivity list, and LLM connectivity manual test.
  - Locked flow contracts: every delivery slice now has entry review, inputs, outputs, invariants, exit criteria, and downstream dependency.

## Implementation Review Items

- No phase-1 requirement gaps are open.
- During Slice 0 and Slice 5, choose exact DB diagnostic source points from the repository/service boundaries found in code.
- During Slice 4, choose which infra snapshot sections use existing counters and which use lightweight ping/check calls.
- During Slice 4, implement the locked LLM diagnostic gateway fields from `07-contract-review.md` and add tests proving the diagnostic stays dev-only/non-business and does not enqueue events or persist runtime operation records.

## 2026-04-27 — Batch A (Slice 0 / 1 / 2)

Local commit only (no PR yet) per user direction. Three slices delivered together:

**Slice 0 — Prisma model + migration**

- Added `RuntimeOperationRecord` to `prisma/schema.prisma`. `severity`/`source`/`status` are kept as `String` columns (validated by TS unions in the service layer) per the locked contract.
- Manual migration `prisma/migrations/20260427120000_t301_runtime_operation_records/migration.sql` (worktree had no live DB to run `prisma migrate dev`; the SQL mirrors the model 1:1 and follows the pattern used by `media_observability_events`).
- All 9 indexes from the contract are present, including the `(occurred_at, id)` cursor index.
- `npx prisma format` + `npx prisma validate` both pass.
- DB context contract refreshed via `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`; `runtime_operation_records` is now visible in `docs/context/db/schema.json`.

**Slice 1 — Repository contract + impls + container wiring**

- Domain types in `src/backend/repos/types/runtime-operation.ts` plus barrel re-export in `types/index.ts`.
- Interface + in-memory impl in `src/backend/repos/runtime-operation-record-repository.ts`. Filter contract: `severity[] / source[] / status[] / agent_id / trace_id / correlation_id / event_id / linked_risk_event_id / entity{type,id} / since / until / before(cursor) / limit`.
- Pg impl in `src/backend/repos/pg/pg-runtime-operation-record-repository.ts`. List ordering is `(occurred_at desc, id desc)` with cursor predicate matching the in-memory store.
- `deleteExpired(cutoffs)` enforces severity-specific cutoffs (90d/30d/7d). Records with `linked_risk_event_id` set are excluded — governance-linked rows survive ordinary cleanup.
- Wired into `src/backend/container/repos.ts` for both Prisma and in-memory branches. New field: `runtimeOperationRecordRepo`.
- Targeted tests at `src/backend/repos/__tests__/runtime-operation-record-repository.test.ts` cover create/find/list filters/cursor pagination/governance-link exclusion (7 tests, all passing).

**Slice 2 — Observability service + feature flags**

- `RuntimeOperationRecordService` in `src/backend/services/runtime-operation-record-service.ts`.
  - `record()` is side-effect free: write-flag gated and try/catched; persistence failures log a compact `console.warn` and return `null` so business code is unaffected.
  - `list()`, `getDetail()`, `cleanupExpired()`, plus exported `computeRetentionCutoffs()` and `retentionWindowDaysFor()` helpers for future cleanup CLI.
  - Redaction: `isSensitiveKey()` matches token / secret / password / credential / authorization / api_key / cookie / session_id / raw_prompt / raw_completion / raw_content / prompt_text / completion_text / message_text / private_message — each match becomes `[redacted]` and is counted in `_redaction.redacted_keys`.
  - Truncation: per-string `1024` chars (with `…` suffix), `operation` + `error_code` separately bounded, payload target `16KB`. When the serialized result exceeds the target the payload is replaced with a truncated preview and `_redaction.payload_truncated` is set.
- Feature flags wired in `src/backend/lib/config.ts`:
  - `runtimeOperationRecordsWrite` ← `FF_RUNTIME_OPERATION_RECORDS_WRITE`, default `allowDevTools`.
  - `adminRuntimeRecordsUi` ← `FF_ADMIN_RUNTIME_RECORDS_UI`, default `allowDevTools`.
  - Frontend `VITE_FF_ADMIN_RUNTIME_RECORDS_UI` lands in Slice 7.
- Targeted tests at `src/backend/services/__tests__/runtime-operation-record-service.test.ts` cover persistence/disabled flag/error swallowing/redaction/truncation/payload-size cap/operation truncation/cleanup with governance-link exclusion (10 tests, all passing).

Verification (run from worktree):

- `npx prisma format` ✅
- `npx prisma validate` ✅
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context` ✅
- `pnpm exec vitest run src/backend/repos/__tests__/runtime-operation-record-repository.test.ts src/backend/services/__tests__/runtime-operation-record-service.test.ts` ✅ (17 / 17)
- `pnpm lint` ✅
- `pnpm typecheck` — only pre-existing unrelated `src/shared/kickoff-workflow.ts` error, confirmed identical against `git stash` baseline.

Open items carried into Batch B:

- Admin API routes (Slice 3), infra snapshot + LLM connectivity services (Slice 4), retention CLI (Slice 6).
- Slice 5 instrumentation will follow Batch B's API verification, per the agreed sequencing.
