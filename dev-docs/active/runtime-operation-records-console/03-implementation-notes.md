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
