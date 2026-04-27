# 06 Execution Plan — T-301

## Execution Goal

Deliver `/admin/runtime-records` as a read-only operations surface with:

- persisted runtime operation records
- lightweight DB diagnostics and business-critical node instrumentation
- read-only infra snapshot
- staging-active LLM connectivity table with manual-only tests
- retention cleanup through backend service + CLI

No governance escalation, retry/release, manual cleanup, or private-chat-specific diagnostics are included in this pass.

## Delivery Slices

### Slice 0 — Branch and Migration Prep

Purpose: make DB work explicit before touching runtime paths.

Files likely touched:

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_t301_runtime_operation_records/migration.sql`
- `docs/context/db/schema.json` after schema sync, if required by the DB SSOT workflow

Actions:

1. Use the repo DB SSOT workflow because a persisted table is required.
2. Add `RuntimeOperationRecord` with indexes for time, severity, source, status, agent, trace, correlation, event, and linked risk event.
3. Include retention-friendly `occurredAt` and stable cursor ordering.
4. Keep payload fields nullable and bounded by service-level redaction/truncation.

Verification:

- `pnpm db:validate`
- migration diff review
- targeted repository tests after Slice 1

Acceptance:

- schema compiles
- table supports list/detail filters without scanning on common incident queries

### Slice 1 — Repository and Domain Contract

Purpose: isolate persistence from runtime/business code.

Files likely touched:

- `src/backend/repos/runtime-operation-record-repository.ts`
- `src/backend/repos/pg/pg-runtime-operation-record-repository.ts`
- `src/backend/repos/types.ts` or `src/backend/repos/types/index.ts`
- `src/backend/container/repos.ts`
- `src/backend/container/index.ts`
- `src/backend/repos/__tests__/runtime-operation-record-repository.test.ts`

Contract shape:

- `create(input)`
- `findById(id)`
- `list(filters)`
- `deleteExpired(cutoffs)`

List filters:

- `severity`
- `source`
- `status`
- `agent_id`
- `trace_id`
- `correlation_id`
- `event_id`
- `linked_risk_event_id`
- `since` / `until`
- cursor + limit

Acceptance:

- in-memory and pg repositories behave consistently
- pagination uses deterministic `occurred_at + id` ordering
- cleanup deletes only runtime operation records

### Slice 2 — Runtime Observability Service

Purpose: centralize redaction, payload limits, feature flags, and write isolation.

Files likely touched:

- `src/backend/services/runtime-operation-record-service.ts`
- `src/backend/services/__tests__/runtime-operation-record-service.test.ts`
- `src/backend/lib/config.ts`
- optional: `src/backend/lib/runtime-diagnostics.ts`

Service responsibilities:

- `record(input)` catches its own errors and never changes business behavior
- `list(filters)` and `getDetail(id)`
- `cleanupExpired(now)`
- redaction and payload truncation
- helper builders for common events:
  - `recordRuntimeFailure`
  - `recordDbDiagnostic`
  - `recordBusinessNode`

Feature flags:

- backend write flag: `FF_RUNTIME_OPERATION_RECORDS_WRITE`
- backend admin API/UI capability flag: `FF_ADMIN_RUNTIME_RECORDS_UI`
- frontend visibility flag: `VITE_FF_ADMIN_RUNTIME_RECORDS_UI`

Payload rules:

- no raw prompts/completions
- no private/user raw content
- no SQL values, result payloads, connection strings, tokens, or secrets
- truncate strings around 1-2KB
- target 8-16KB total payload
- include truncation metadata when useful

Acceptance:

- write failures are swallowed and logged compactly
- disabled write flag prevents persistence
- redaction tests cover secret-like keys and private-chat-shaped payloads

### Slice 3 — Admin Backend APIs

Purpose: expose read-only admin endpoints.

Files likely touched:

- `src/backend/routes/admin/admin-runtime-routes.ts`
- `src/backend/validation/schemas.ts` if query validation is added
- `src/backend/routes/__tests__/admin-runtime-routes.test.ts`
- possibly a new focused test file for runtime records

Endpoints:

- `GET /v1/admin/runtime/operation-records`
- `GET /v1/admin/runtime/operation-records/:id`
- `GET /v1/admin/runtime/infra-snapshot`
- `GET /v1/admin/runtime/llm-connectivity`
- `POST /v1/admin/runtime/llm-connectivity/test`

Rules:

- all endpoints require `requireHumanAuth` + `requireAdmin`
- list endpoint is cursor-paginated
- detail endpoint links canonical references, not full duplicated payloads
- manual LLM test returns transient result only
- no retry/release/manual cleanup endpoints in this pass

Acceptance:

- auth failures remain protected
- invalid filters return 400
- dependency failures in infra snapshot return partial sections

### Slice 4 — Infra Snapshot and LLM Connectivity

Purpose: give operators current health without polluting operation-record persistence.

Files likely touched:

- `src/backend/services/runtime-infra-snapshot-service.ts`
- `src/backend/services/llm-connectivity-diagnostic-service.ts`
- `src/backend/container/infra.ts`
- `src/backend/container/llm.ts`
- `src/backend/container/index.ts`
- backend tests for both services

Infra snapshot sections:

- process/build/memory/event-loop
- HTTP/API short-window summary if available
- Postgres ping and drift signal where available
- Redis/queue size, oldest event age, retry/DLQ summary where available
- SSE hub stats
- LLM connectivity summary
- storage/media worker health summary where available

LLM connectivity:

- source rows from staging-active/admitted routes, not all registry candidates
- include provider, model ID, concrete model name/version, profile/voice line/policy route, credential/pool identifier
- manual test uses existing gateway route + dedicated tiny diagnostic prompt
- manual test is never auto-polled and does not write operation records

Acceptance:

- infra snapshot can return partial results
- LLM test does not enqueue runtime events or mutate agent/business state
- model metadata is visible for each active row

### Slice 5 — Runtime and Business-Node Instrumentation

Purpose: capture the failed stage for most runtime/public-output incidents.

Files likely touched:

- `src/backend/runtime/runtime-loop.ts`
- `src/backend/runtime/event-queue.ts`
- `src/backend/runtime/agent-executor.ts`
- `src/backend/runtime/post-scheduler.ts`
- `src/backend/services/proactive-interaction-service.ts`
- selected media worker/service files if needed
- selected DB/repository boundaries, preferably via service wrappers rather than broad Prisma hooks

Instrumentation points:

- event dequeued / retried / dead-lettered
- agent execution selected / skipped / failed
- LLM call failed / fallback summary available
- output parse failed / succeeded
- moderation/governance block
- public write attempted / failed / succeeded
- media generation or attachment failed
- scheduled post attempted / failed / succeeded
- DB connectivity/latency/error summaries for runtime-critical repository operations

Rules:

- record only warn/error/critical plus selected lifecycle markers
- no private-chat-specific exception handling in this pass
- no raw payloads
- instrumentation must never throw into business flow

Acceptance:

- targeted tests prove business success/failure behavior does not change
- operation records explain stage, entity refs, sanitized error, and trace references

### Slice 6 — Retention Cleanup CLI and Service

Purpose: make retention policy real without adding destructive UI.

Files likely touched:

- `src/backend/services/runtime-operation-record-service.ts`
- `scripts/runtime-operation-records-cleanup.mjs`
- `package.json`
- backend tests for cleanup cutoff behavior

Cleanup policy:

- error/critical: 90 days
- warn: 30 days
- sampled info/success lifecycle markers: 7 days
- governance-linked records excluded from ordinary cleanup unless explicitly approved later

Recommended script:

- `pnpm runtime-records:cleanup`
- optional dry-run flag if the script pattern supports it

Acceptance:

- cleanup only deletes runtime operation records
- dry-run/apply behavior is explicit if implemented
- no console manual cleanup

### Slice 7 — Frontend Admin Page

Purpose: deliver the operator workflow.

Files likely touched:

- `src/frontend/app/route-components.tsx`
- `src/frontend/app/router.tsx`
- `src/frontend/features/admin/pages/AdminPages.tsx`
- `src/frontend/features/admin/components/AdminSidebar.tsx`
- `src/frontend/features/admin/pages/RuntimeRecordsPage.tsx` or `admin-panel/RuntimeRecordsTab.tsx`
- `src/frontend/api/hooks/admin.ts`
- `src/frontend/api/types.ts`
- `src/frontend/api/query-keys.ts`
- frontend tests under `src/frontend/features/admin/**/__tests__/`

UI layout:

- top: infra snapshot panel, 15s polling
- middle: LLM connectivity table with manual test action
- bottom/main: operation record table with filters
- detail drawer/page: selected record, references, payload summary, linked ledger/run refs

Controls:

- filters: severity, source, status, agent, trace, entity IDs, time window
- no retry/release/escalate/manual cleanup buttons
- clear empty states when write flag is off or no records exist

Acceptance:

- `/admin/runtime-records` route works
- sidebar link appears under `状态与运维`
- page remains usable when infra snapshot returns partial failures
- LLM manual test renders transient result only

### Slice 8 — Verification and Rollout

Purpose: land safely across DB, backend, frontend, and runtime behavior.

Commands:

- `pnpm db:validate`
- targeted backend tests:
  - repository
  - service redaction/payload limits
  - admin routes
  - infra snapshot
  - LLM connectivity diagnostics
  - retention cleanup
  - instrumentation isolation
- targeted frontend tests:
  - route/sidebar/page rendering
  - filters/detail view
  - infra partial states
  - LLM transient test result
- `pnpm typecheck`
- `pnpm lint`
- optional local admin console smoke

Rollout order:

1. Land schema/repo/service behind disabled write flag.
2. Enable admin UI flag with empty/disabled state.
3. Enable write flag in dev/staging.
4. Verify operation records appear for synthetic failures.
5. Verify infra snapshot and LLM manual test.
6. Run cleanup dry-run/apply in staging.

Rollback:

- disable write flag to stop new records
- disable UI flag to hide page
- keep migration/table in place unless a DB rollback is explicitly required
- existing runtime stats page remains fallback

## Dependency Order

```text
Schema -> Repo -> Service -> Admin APIs -> Frontend read-only page
                  |             |
                  |             -> Infra snapshot / LLM diagnostics
                  -> Instrumentation -> Records visible in page
                  -> Cleanup CLI
```

## Implementation Constraints

- No raw prompts, completions, private messages, request bodies, SQL values, secrets, or connection strings.
- No product behavior changes caused by instrumentation.
- No private-chat-specific instrumentation.
- No governance escalation.
- No destructive admin UI actions.
- Prefer existing repo/container/admin-route patterns over new framework abstractions.
- Use `07-contract-review.md` as the slice-by-slice implementation contract.

## Ready-to-Start Checklist

- [x] DB model and indexes reviewed at contract level.
- [x] Write/UI feature flag names chosen.
- [x] Endpoint response types drafted.
- [x] LLM tiny diagnostic prompt contract drafted.
- [x] Runtime instrumentation points confirmed against likely code paths.
- [x] Frontend page component structure confirmed against admin routing/sidebar patterns.
- [x] Verification command list accepted for implementation.
