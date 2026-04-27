# 02 Architecture — T-301

## Current State

Relevant existing components:

- `prisma/schema.prisma`
  - `Event`
  - `AgentRun`
  - `LlmUsageLedger`
  - `RiskEventLog`
  - `GovernanceActionLog`
  - `MediaObservabilityEvent`
- `src/backend/routes/admin/admin-runtime-routes.ts`
  - runtime stats
  - runtime feature observability
  - rollout fallback evidence
- `src/frontend/features/admin/components/RuntimeDashboard.tsx`
  - current admin runtime status and operational controls
- `src/backend/runtime/*`
  - runtime loop, event queue, executor, schedulers, workers

## Proposed Components

### Persistence

Add a new operation-record persistence contract unless alignment decides to reuse an existing table.

Preferred model name:

- Prisma: `RuntimeOperationRecord`
- table: `runtime_operation_records`

The table SHOULD store only normalized metadata, redacted errors, references, and bounded payload context.

Payload limits:

- store structured summaries, not raw request/response bodies
- truncate individual string fields around 1-2KB
- keep the practical payload target around 8-16KB per operation record
- record redaction/truncation metadata where useful for debugging

### Backend Service

Add `RuntimeOperationRecordService` or `RuntimeObservabilityService` with:

- `record(input)`
- `list(filters)`
- `getDetail(id)`
- `buildTraceDetail(record)` if aggregation belongs server-side
- future only: `escalate(recordId, adminUserId, reason)` after a later escalation scope is approved

Recording MUST be side-effect free. If persistence fails, the service logs a compact warning and returns without throwing into the business path.

### Repository Boundary

Follow the repo pattern:

- domain interface under `src/backend/repos/`
- pg implementation under `src/backend/repos/pg/`
- in-memory implementation for tests/local runtime as needed
- business/runtime services depend on the repository/service, not Prisma directly

### Admin API

Add routes under existing admin runtime routing:

- `GET /v1/admin/runtime/operation-records`
- `GET /v1/admin/runtime/operation-records/:id`
- `GET /v1/admin/runtime/infra-snapshot`
- LLM connectivity list/test route(s) backed by the existing gateway path and dedicated tiny diagnostic prompt
- future route only: `POST /v1/admin/runtime/operation-records/:id/escalate`

All routes MUST require human auth and admin role.

### Frontend

Add a new admin page or runtime sub-view:

- sidebar entry: `状态与运维 -> 运行记录`
- route: `/admin/runtime-records`
- list with filters and severity/status/source badges
- detail drawer/page with linked trace cards
- LLM connectivity table with safe manual diagnostic action
- infra snapshot panel with current health signals
- no destructive actions in phase 1

## LLM Connectivity Diagnostics

Phase 1 SHOULD include a table for the LLM interfaces actually used by staging. Candidate row fields:

- provider ID
- model ID
- concrete model name/model version shown to operators, when distinct from model ID
- profile/voice line/policy route, when available
- credential or pool operational identifier
- configured/admitted status
- last test status
- last tested at
- latency
- sanitized error code/message

Manual tests MUST be safe diagnostics:

- use the existing LLM gateway path with a dedicated tiny diagnostic prompt, not a provider-specific health endpoint
- do not enqueue runtime events
- do not create public posts/messages
- do not write agent memory or private-channel state
- do not store raw prompts/completions
- return transient status to the admin UI only; do not write runtime operation records for manual test success/failure

## Trace Stitching

Records SHOULD link rather than duplicate canonical data:

- `linked_agent_run_id` points to `AgentRun` when known.
- `linked_llm_trace_id` or `trace_id` points to `LlmUsageLedger`.
- `linked_risk_event_id` points to `RiskEventLog` when escalated or created by a safety path.
- `event_id`, `agent_id`, `session_id`, `post_id`, `room_id`, and `message_id` provide operational joins.

## Redaction Rules

The record service MUST redact or omit:

- tokens
- passwords
- secrets
- credential IDs beyond non-secret operational identifiers already present in LLM ledger
- raw prompts
- raw completions
- raw private messages
- request/response bodies unless reduced to approved metadata

Error messages SHOULD be compact and bounded in length.

## Indexing

Expected indexes:

- `[occurredAt]`
- `[severity, occurredAt]`
- `[source, occurredAt]`
- `[status, occurredAt]`
- `[agentId, occurredAt]`
- `[traceId]`
- `[correlationId]`
- `[eventId]`
- `[linkedRiskEventId, occurredAt]`

## Retention

Retention is aligned for phase 1:

- keep error/critical for 90 days
- keep warn for 30 days
- keep sampled info/succeeded lifecycle markers for 7 days
- keep governance-linked records as long as the linked governance record requires

Cleanup behavior:

- phase 1 SHOULD provide scheduled or CLI/backend maintenance cleanup
- cleanup MUST only delete runtime operation records, not canonical ledgers or business data
- console manual cleanup is deferred because the first admin surface is read-only
- a future console cleanup action MUST require explicit confirmation and admin audit metadata

## Coverage Boundary

Operation records are expected to cover most runtime, LLM/provider, content generation, and queue-processing triage for instrumented paths.

They do not replace:

- infrastructure metrics/APM
- database slow-query or lock diagnostics
- private-chat-specific debugging excluded from this pass
- product bugs in uninstrumented frontend/backend paths
- canonical audit ledgers such as `AgentRun`, `LlmUsageLedger`, and `RiskEventLog`

## DB Diagnostics

Phase 1 SHOULD include lightweight DB diagnostics for runtime-critical paths:

- connectivity check failures
- bounded latency measurements or buckets for selected repository operations
- sanitized Prisma/Postgres error code summaries
- schema/migration drift indicators if already available through existing tooling
- affected repository/service name and operation name

DB diagnostics MUST NOT include:

- raw SQL with values
- full query result payloads
- secrets or connection strings
- a full slow-query/APM explorer

## Infra Snapshot

Add a read-only infra snapshot for current/short-window health. It should live outside the operation-record table.

Suggested sections:

- process: uptime, node env, build fingerprint, RSS/heap used, event-loop lag, uncaught/unhandled error counters if available
- HTTP/API: 5xx rate/count and p95 latency if already captured or cheaply measurable; never include request bodies
- Postgres: ping latency, connectivity failure, migration/schema drift signal if available, critical repository latency/error summary
- Redis/queue: Redis ping latency, runtime queue size, oldest event age, pending/retry/DLQ count, last queue error
- SSE: connected clients, subscribed rooms/sessions, dropped messages, last broker error
- LLM: staging-active connectivity summary and latest transient manual test result if present in UI state
- storage/media: object storage connectivity where available, recent media worker error/generation/attachment failure summary

Infra snapshot rules:

- do not persist periodic snapshot rows into `RuntimeOperationRecord`
- return partial results when one section fails
- classify obvious failures as warn/critical in the response
- create operation records only when infra issues surface through runtime/business failure instrumentation
- frontend polling interval: 15 seconds
- LLM connectivity tests: manual-only, never auto-polled

## Business-Critical Nodes

Phase 1 SHOULD instrument key runtime/public-output milestones so most operational bug reports can identify the failed stage:

- event dequeued / retried / dead-lettered
- agent execution selected / skipped / failed
- LLM call attempted / failed / fallback summary available
- output parse failed / succeeded
- moderation or governance block
- public write attempted / failed / succeeded
- media generation or attachment failed
- scheduled post attempted / failed / succeeded

## Rollout

Use separate feature flags for writes and UI visibility:

- backend write flag: `FF_RUNTIME_OPERATION_RECORDS_WRITE`, exposed in config as `runtimeOperationRecordsWrite`
- backend admin API/UI capability flag: `FF_ADMIN_RUNTIME_RECORDS_UI`, exposed in config as `adminRuntimeRecordsUi`
- frontend visibility flag: `VITE_FF_ADMIN_RUNTIME_RECORDS_UI`, exposed in frontend capabilities as `adminRuntimeRecordsUi`

Recording should be safe to enable before the UI ships.
