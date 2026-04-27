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

## 2026-04-27 — Batch B (Slice 3 / 4 / 6)

Local commit only (no PR yet) per user direction. Three slices delivered together; runtime instrumentation (Slice 5) and frontend (Slice 7) remain for Batch C.

**Slice 4 — Infra snapshot + LLM connectivity services**

- `RuntimeInfraSnapshotService` in `src/backend/services/runtime-infra-snapshot-service.ts`.
  - Composable section probes (`process`, `http`, `postgres`, `redisQueue`, `sse`, `llm`, `storageMedia`) injected at construction. Each runs through `safeRun` so a single failing section returns `status: 'critical'` with a sanitized error code/message and never poisons sibling sections.
  - `escalate()` reduces the worst section status into `overall_status` (`ok < skipped < unknown < warn < critical`).
  - Helpers: `buildProcessSection` (uptime/RSS/heap/build fingerprint/node env), `probePostgresSection` (skipped vs ok/warn/critical based on configurable thresholds), `probeRedisQueueSection` (ping latency + queue size + oldest event age, with hard-coded warn at 1k / 60s and critical at 5k / 5min for now). All redaction-safe — error messages are truncated to 256 chars.
- `LlmConnectivityDiagnosticService` in `src/backend/services/llm-connectivity-diagnostic-service.ts`.
  - `list()` filters profile candidates to only those marked `admission: 'admitted'` in the `providerAdmission` registry pool for the same voice line. Each row carries `route_id` (composite of profile + provider + model + region + endpoint), credential pool identifier, model name/version (derived from `model_id`), policy id, intent, visibility, and shadow comparison dimensions. `manual_tests_auto_polled` is hard-coded to `false`.
  - `test({ route_ids?, scope? })` uses the existing gateway by calling `invokeGateway(LLMGatewayRequest)` — wired to `llmGateway.chat` in the container. Locked request fields per contract: `intent='dev_prompt_render'`, `visibility='dev_only'`, `scene='dev_prompt_render'`, `budgetClass='dev_only'`, `modality='text'`, `responseMode='text'`, `allowFallbackWithinLine=false`, `allowCrossFamily=false`, `routingConstraint={ providerId, modelId }`, `traceId='admin-llm-connectivity:<runId>:<routeId>'`, `agentId='admin-llm-connectivity-diagnostic'`, `promptRef={ id: 'admin-llm-connectivity-diagnostic', version: 1 }`. Result is **transient** — the service never persists a `RuntimeOperationRecord` for either success or failure, and the response text is discarded after success classification.
  - `classifyError(err)` maps `LLMGatewayContractError` codes verbatim and falls back to a small heuristic for `Auth/RateLimit/Timeout` strings; everything else is `UpstreamError`.
- New prompt template registered in `.ai/llm-config/registry/prompt_templates.yaml`: `admin-llm-connectivity-diagnostic@1`. Body is the locked tiny "reply OK" instruction; variables schema is empty.
- Container wiring in `src/backend/container/index.ts`:
  - `runtimeOperationRecordService` (also used by Slice 3 routes) instantiated with `isWriteEnabled` reading the `runtimeOperationRecordsWrite` capability live so flag updates take effect without a process restart.
  - `runtimeInfraSnapshotService` wired with concrete probes: process metrics from `process.uptime()/memoryUsage()` + `getRuntimeBuildInfo()`; postgres via `prisma.$queryRaw\`SELECT 1\``; redis queue via `infra.runtimeRedis.ping()` + `infra.eventQueue.size()/oldestTimestampMs()`; SSE via `infra.sseHub.getStats()`; LLM is a thin `gateway.isConfigured` reflection (the heavy connectivity test is manual-only); `http` and `storageMedia` start as `unknown` summaries because no shared counter exists yet — those fields can be filled in later without a contract change.
  - `llmConnectivityDiagnosticService` wired with `bundle = llm.registryBundle` and `invokeGateway = llm.llmGateway.chat`.
- Targeted vitest coverage:
  - `runtime-infra-snapshot-service.test.ts` — 12 tests (overall escalation, partial failures, `buildProcessSection`, postgres skipped/ok/warn/critical, redis skipped/ok/critical-on-size/critical-on-error).
  - `llm-connectivity-diagnostic-service.test.ts` — 8 tests with a hand-written minimal `LlmRegistryBundle` fixture (admitted vs shadow filtering, locked gateway request fields, error classification for `LLMGatewayContractError` and generic Errors, helper coverage).

**Slice 3 — Admin API endpoints**

- 5 endpoints registered in `src/backend/routes/admin/admin-runtime-routes.ts`, all behind `requireHumanAuth + requireAdmin` and gated by `config.launch.capabilities.adminRuntimeRecordsUi` (returns `403 FORBIDDEN` when off):
  - `GET /v1/admin/runtime/operation-records` — cursor list with severity/source/status (CSV), agent/trace/correlation/event/risk filters, entity{type,id} pair, since/until, limit (capped at 100). Returns `data.records`, `data.next_cursor` (base64url), normalized `data.filters`, plus `data.write_enabled` and `data.retention_policy` for UI affordances.
  - `GET /v1/admin/runtime/operation-records/:id` — detail with `references` block (linked agent run / llm trace / risk event / event / trace / correlation when present) and `payload_summary` carrying the redacted payload + `_redaction` meta.
  - `GET /v1/admin/runtime/infra-snapshot` — directly proxies the snapshot service.
  - `GET /v1/admin/runtime/llm-connectivity` — proxies `service.list()`.
  - `POST /v1/admin/runtime/llm-connectivity/test` — accepts `{ route_ids?: string[], scope?: 'all_admitted' }`; returns `400 VALIDATION_ERROR` when neither is provided.
- Filter parsing extracted to a sibling helper module `src/backend/routes/admin/runtime-operation-records-filters.ts` so it can be unit-tested without booting the heavy container at module load. Encodes/decodes the cursor as base64url-encoded JSON `{ at, id }`.
- Targeted route tests added to `src/backend/routes/__tests__/admin-runtime-routes.test.ts` — 9 new cases covering severity/source/status parsing, invalid value rejection, entity pair completeness, limit cap, since/until ISO parsing/rejection, cursor round-trip, and malformed-cursor handling.

**Slice 6 — Retention cleanup CLI**

- `scripts/runtime-records-cleanup.mjs` — ESM CLI matching the repo's `director-history-maintenance.mjs` style.
  - Default mode is **dry-run** (per user direction); pass `--apply` to delete.
  - `--now <iso>` lets ops/CI pin a deterministic clock for snapshotting.
  - Computes 90/30/7-day cutoffs locally to avoid a backend container import; the `RuntimeOperationRecordService.cleanupExpired` path is the canonical one used in tests, and the CLI's SQL filter is identical to the service's.
  - Always excludes `linked_risk_event_id IS NOT NULL` rows.
  - Both modes emit JSON-only output for piping into ops dashboards.
- New script entry: `pnpm runtime-records:cleanup` in `package.json`.
- Targeted test at `scripts/__tests__/runtime-records-cleanup.test.ts` exercises the cutoff math.
- End-to-end smoke verified locally:
  - Spun up `pnpm db:local:up` on port 5435 (host already had Postgres on 5432) and applied the T-301 migration via `psql -f`.
  - Seeded 5 rows: 1 old-error (100d), 1 old-warn (40d), 1 old-info (10d), 1 recent error (1d), 1 governance-linked old error.
  - `pnpm runtime-records:cleanup` (dry-run) reported `errorCritical=1, warn=1, info=1, total=3`.
  - `node scripts/runtime-records-cleanup.mjs --apply` deleted 3 and kept exactly the recent and the governance-linked rows. Tore down the container.

Verification (run from worktree):

- `pnpm exec vitest run` against the 6 T-301 test files — 52 / 52 passing.
- `pnpm lint` — passing.
- `pnpm typecheck` — only the pre-existing unrelated `src/shared/kickoff-workflow.ts` import error.
- Manual end-to-end CLI smoke as described above.

Open items carried into Batch C:

- Slice 5 — runtime / business-node instrumentation (RuntimeLoop, EventQueue, AgentExecutor, PostScheduler, ProactiveInteractionService, runtime-critical repo boundaries).
- Slice 7 — `/admin/runtime-records` page, sidebar entry, hooks/types, query keys, frontend feature flag `VITE_FF_ADMIN_RUNTIME_RECORDS_UI`.
- Slice 8 — final verification + rollout notes.

## 2026-04-27 — Batch C (Slice 5 / 7 / 8)

Local commit only (no PR yet) per user direction. Closes phase-1 scope.

**Slice 5 — Runtime / business-node instrumentation**

Used a singleton-style indirection (`src/backend/runtime/runtime-observability.ts`) to keep the diff small across 5 instrumented files: callers do not take the recorder service through their deps interface and tests run with the default no-op recorder (which is also the production fallback if the container hasn't wired the recorder yet).

- `recordRuntimeOperation(input)` is fire-and-forget; the wrapper catches its own throws (defensive `console.warn`) so business code never sees an observability error.
- Container wiring sets the active recorder to `(input) => void runtimeOperationRecordService.record(input)` — `record()` itself is already side-effect free (write-flag-gated, swallows persistence errors), so observability outages can never poison runtime paths.
- `compactErrorMessage(err)` truncates to 512 chars and tolerates non-Error throws.

Hook points (only failures + DLQ — no success markers, per phase-1 default):

- `runtime-loop.ts`:
  - per-event catch → `runtime_loop / process_event / retried` (severity `error`)
  - tick-level catch → `runtime_loop / tick / failed` (severity `critical`) with a small payload digest
- `event-queue.ts` (Redis stream impl):
  - DLQ branch → `event_queue / dead_letter / dead_lettered` (severity `error`) with `retry_count`
- `agent-executor.ts`:
  - top-level executeOne catch → `agent_executor / execute / failed` (severity `error`)
  - parser returned no instruction → `agent_executor / parse_output / failed` (severity `warn`) with `error_code='parse_failed'` and a small payload (template + response length, no body)
- `post-scheduler.ts`:
  - createPost outer catch → `post_scheduler / create_post / failed` (severity `error`)
- `proactive-interaction-service.ts`:
  - AgentRun persist failure → `proactive_interaction / persist_agent_run / failed` (severity `warn`)
  - opening media attach failure → `proactive_interaction / attach_opening_media / failed` (severity `warn`)

DB diagnostics: per the agreed Slice 5 entry review, instrumentation is restricted to the runtime-critical paths above. We did **not** add a generic `recordDbDiagnostic` wrapper around every repo boundary — that would have widened the diff and added noise. The same shape can be plugged in later if a specific bug-triage call needs it.

Targeted test: `runtime-observability.test.ts` (4 cases) covers default no-op, active recorder forwarding, throw-swallowing, and `compactErrorMessage`.

Existing runtime test suites (276 cases across `src/backend/runtime/__tests__`) still pass — no instrumented file changed business behavior.

**Slice 7 — Admin frontend page**

- Frontend flag `VITE_FF_ADMIN_RUNTIME_RECORDS_UI` registered in:
  - `src/frontend/shared/config/frontend-flags.ts` (`FRONTEND_FLAG_KEYS`, `FRONTEND_FLAG_DEFINITIONS`, `readFlagFromImportMetaEnv`)
  - `src/frontend/shared/config/frontend-capabilities.ts` (`FRONTEND_LAUNCH_CAPABILITIES.adminRuntimeRecordsUi` + `adminRuntimeRecordsUiEnabled` accessor)
- Sidebar: `AdminSidebar.tsx` rebuilt to compute groups via `buildNavGroups()`; `运行记录` only appears under `状态与运维` when the flag is on. Behavior unchanged for all other entries.
- Types in `src/frontend/api/types.ts`: `RuntimeOperationRecord`, `RuntimeOperationRecordsListData`, `RuntimeOperationRecordDetailData`, `InfraSnapshotData/Section/Status`, `LlmConnectivityRow`, `LlmConnectivityListData`, `LlmConnectivityTestResult`, `LlmConnectivityTestResponseData`, plus the `RuntimeOperationRecordListFilters` shape that mirrors the locked admin API contract.
- Query keys in `src/frontend/api/query-keys.ts`: `adminRuntimeOperationRecords(filters)`, `adminRuntimeOperationRecord(id)`, `adminRuntimeInfraSnapshot`, `adminRuntimeLlmConnectivity`.
- Hooks in `src/frontend/api/hooks/admin.ts`: `useAdminRuntimeOperationRecords`, `useAdminRuntimeOperationRecord`, `useAdminRuntimeInfraSnapshot` (15s `refetchInterval`), `useAdminRuntimeLlmConnectivity`, `useAdminRuntimeLlmConnectivityTest` mutation.
- Page component `src/frontend/features/admin/pages/RuntimeRecordsPage.tsx`:
  - Top: infra snapshot panel (overall status badge + section grid with summary/latency/error_message_redacted; partial-failure-friendly).
  - Middle: LLM connectivity table with per-row "测试" and a "测试全部" button. Test results are kept in component state — strictly transient per contract.
  - Bottom: filter bar (severity / source / status multi-select, trace ID, agent ID, since/until) + records table (occurred_at, severity, source, operation, status, trace, agent/event, error preview).
  - Detail drawer renders the redacted record JSON, `references` block, and `payload_summary.payload`.
  - Empty/disabled states render explicit copy when the user is not admin, the UI flag is off, the write flag is off, or no records match.
  - No retry / release / escalate / manual-cleanup buttons — phase-1 read-only contract.
- Page wired into `AdminPages.tsx` (`AdminRuntimeRecordsPage`), `route-components.tsx` (`route:admin-runtime-records`), and `router.tsx` (path `runtime-records` under the admin shell).

**Slice 8 — Verification**

- Targeted vitest sweep: 2358 / 2358 passing in scope (the 2 skipped are pre-existing and unrelated). No regression in any existing runtime test.
- `pnpm typecheck`: only the pre-existing unrelated `src/shared/kickoff-workflow.ts` import error remains.
- `pnpm lint`: passing.
- `pnpm build`: frontend builds cleanly, including the new lazy chunk for `AdminPages` (with `RuntimeRecordsPage` reachable via the admin sidebar entry).
- Slice 6 CLI smoke (from Batch B) is still valid — the cleanup contract did not change.

**Rollout notes**

1. Land schema/repo/service behind disabled write flag — done (write flag still gates persistence).
2. Enable admin UI flag with empty/disabled state — set `FF_ADMIN_RUNTIME_RECORDS_UI=true` and `VITE_FF_ADMIN_RUNTIME_RECORDS_UI=true`. Page renders an explicit empty state when no records exist and a banner when the write flag is off.
3. Enable write flag in dev/staging — set `FF_RUNTIME_OPERATION_RECORDS_WRITE=true`. The instrumented runtime paths begin to record warn/error/critical operation events.
4. Verify operation records appear for synthetic failures — exercise an event handler that throws (e.g. by tripping the existing executor failure paths in dev) and confirm rows show in `/admin/runtime-records`.
5. Verify infra snapshot and LLM manual test from the page itself (15s polling on infra; transient on LLM test).
6. Run cleanup dry-run / apply in staging via `pnpm runtime-records:cleanup` (default dry-run) and `node scripts/runtime-records-cleanup.mjs --apply`.

**Rollback**

- Disable `FF_RUNTIME_OPERATION_RECORDS_WRITE` to stop new records — the singleton recorder still fires but `record()` returns `null` immediately.
- Disable `VITE_FF_ADMIN_RUNTIME_RECORDS_UI` (frontend rebuild) and/or `FF_ADMIN_RUNTIME_RECORDS_UI` (backend) to hide the page; the existing `/admin/runtime` dashboard remains the fallback.
- Migration / table can stay in place; no destructive rollback is required.
