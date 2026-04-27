# 07 Contract Review — T-301

## Review Result

The task package covers the aligned phase-1 requirements after this review. No phase-1 requirement gap remains.

Remaining choices are implementation-local reviews, not scope gaps:

- exact DB diagnostic source points from repository/service boundaries
- exact infra snapshot metric source per section

Each remaining choice is assigned to a slice entry review below. A slice MUST NOT start until its entry review confirms the upstream contracts still hold.

## Requirement Coverage Matrix

| Requirement | Contract location | Coverage decision |
| --- | --- | --- |
| Runtime operation records for debug/regulation | `00-overview.md`, `02-architecture.md`, this file | Add persisted `RuntimeOperationRecord` and admin list/detail. |
| Phase 1 read-only admin surface | `roadmap.md`, `06-execution-plan.md` | No retry, release, escalation, override, or destructive cleanup UI. |
| `/admin/runtime-records` placement | `00-overview.md`, `roadmap.md` | Sidebar group: `状态与运维 -> 运行记录`. |
| Warn/error/critical default recording | `01-plan.md`, `02-architecture.md` | Store warn/error/critical plus selected lifecycle markers only. |
| Retention | `02-architecture.md`, this file | `critical/error=90d`, `warn=30d`, sampled `info/succeeded=7d`; governance-linked records excluded from ordinary cleanup. |
| LLM connectivity table | `02-architecture.md`, this file | Show staging-active/admitted rows with provider, model ID, concrete model name/version, profile/route, credential/pool identifier, and manual test status. |
| LLM manual test | `02-architecture.md`, this file | Use existing gateway path plus tiny diagnostic prompt; transient result only; no operation-record write. |
| DB diagnostics | `02-architecture.md`, `06-execution-plan.md` | Lightweight connectivity/latency/error/drift signals only; no raw SQL or result payloads. |
| Business-critical nodes | `02-architecture.md`, `06-execution-plan.md` | Instrument selected runtime/public-output milestones and failures. |
| Infra snapshot | `02-architecture.md`, this file | Read-only current/short-window health, 15s UI polling, partial-section failures. |
| Private chat | `roadmap.md`, `05-pitfalls.md` | Private-chat-specific diagnostics are excluded from this pass. |
| Payload safety | `02-architecture.md`, this file | Structured summaries only, string truncation around 1-2KB, total target 8-16KB, redaction metadata. |
| Rollout controls | `02-architecture.md`, this file | Separate write and UI feature flags. |
| Verification | `04-verification.md`, `06-execution-plan.md` | DB validation, backend/frontend targeted tests, typecheck, lint, optional UI smoke. |

## Locked Feature Flag Contract

Backend flags:

- `FF_RUNTIME_OPERATION_RECORDS_WRITE`
  - Config capability: `config.launch.capabilities.runtimeOperationRecordsWrite`
  - Controls persistence through `RuntimeOperationRecordService.record()`.
  - Default: enabled only when `config.allowDevTools` is true; staging/prod MUST set the env flag explicitly.
- `FF_ADMIN_RUNTIME_RECORDS_UI`
  - Config capability: `config.launch.capabilities.adminRuntimeRecordsUi`
  - Controls backend admin route metadata/availability for this surface.
  - Default: enabled only when `config.allowDevTools` is true; staging/prod MUST set the env flag explicitly.

Frontend flag:

- `VITE_FF_ADMIN_RUNTIME_RECORDS_UI`
  - Frontend capability: `FRONTEND_LAUNCH_CAPABILITIES.adminRuntimeRecordsUi`
  - Controls `/admin/runtime-records` route/sidebar visibility.
  - Default: `false`; local/staging/prod must opt in through Vite env.

Flag invariants:

- Write enablement MUST NOT depend on frontend visibility.
- The admin page MUST render a clear disabled/empty state when UI is enabled but writes are off or no records exist.
- Disabling `FF_RUNTIME_OPERATION_RECORDS_WRITE` MUST stop new persisted records without changing business behavior.

## Data Contract

Prisma model:

- Model: `RuntimeOperationRecord`
- Table: `runtime_operation_records`
- `severity`, `source`, and `status` SHOULD be string columns validated by TypeScript unions in the service layer. This keeps future source additions from requiring enum migrations.

Required fields:

- `id`
- `occurredAt`
- `severity`
- `source`
- `operation`
- `status`
- `createdAt`

Optional trace/entity fields:

- `traceId`
- `correlationId`
- `eventId`
- `agentId`
- `communityId`
- `postId`
- `roomId`
- `sessionId`
- `messageId`
- `linkedAgentRunId`
- `linkedLlmTraceId`
- `linkedRiskEventId`

Optional diagnostic fields:

- `durationMs`
- `errorCode`
- `errorMessageRedacted`
- `retryCount`
- `payloadJson`

Phase-1 source allowlist:

- `runtime_loop`
- `event_queue`
- `agent_executor`
- `post_scheduler`
- `proactive_interaction`
- `llm_gateway`
- `media_worker`
- `guidance_worker`
- `db_diagnostic`
- `system`

Phase-1 status allowlist:

- `started`
- `succeeded`
- `failed`
- `retried`
- `dead_lettered`
- `skipped`

Index contract:

- `(occurredAt, id)` for deterministic cursor pagination
- `(severity, occurredAt)`
- `(source, occurredAt)`
- `(status, occurredAt)`
- `(agentId, occurredAt)`
- `traceId`
- `correlationId`
- `eventId`
- `(linkedRiskEventId, occurredAt)`

Retention contract:

- `critical` and `error`: delete after 90 days unless governance-linked
- `warn`: delete after 30 days unless governance-linked
- sampled `info` / `succeeded` lifecycle markers: delete after 7 days unless governance-linked
- cleanup MUST only delete `RuntimeOperationRecord` rows

## API Contract

All endpoints MUST require `requireHumanAuth` and `requireAdmin`. The Express route path is registered under the existing `/v1` API prefix.

### `GET /v1/admin/runtime/operation-records`

Query parameters:

- `severity`: comma-separated allowlist values
- `source`: comma-separated allowlist values
- `status`: comma-separated allowlist values
- `agent_id`
- `trace_id`
- `correlation_id`
- `event_id`
- `linked_risk_event_id`
- `entity_type` plus `entity_id`, where supported by the repository contract
- `since` / `until`: ISO timestamps
- `cursor`
- `limit`: capped at 100

Response:

- `data.records`: list items ordered by `occurred_at desc, id desc`
- `data.next_cursor`: nullable cursor
- `data.filters`: normalized filters used by the server
- `data.write_enabled`: backend write flag state
- `data.retention_policy`: current retention windows

### `GET /v1/admin/runtime/operation-records/:id`

Response:

- `data.record`: redacted operation record detail
- `data.references`: linked canonical references, not duplicated full payloads
- `data.payload_summary`: redacted/truncated payload summary with metadata

References MAY include `AgentRun`, `LlmUsageLedger`, `Event`, `RiskEventLog`, and `GovernanceActionLog` identifiers and compact summaries.

### `GET /v1/admin/runtime/infra-snapshot`

Response:

- `data.generated_at`
- `data.poll_interval_ms`: `15000`
- `data.overall_status`: `ok | warn | critical | unknown`
- `data.sections`: process, http, postgres, redisQueue, sse, llm, storageMedia

Each section:

- `status`: `ok | warn | critical | unknown`
- `latency_ms`, when measured
- `summary`
- `metrics`: redacted scalar/object metrics only
- `error_code`, when failed
- `error_message_redacted`, when failed

Infra snapshot invariants:

- Periodic snapshot rows MUST NOT be persisted to `RuntimeOperationRecord`.
- One failed section MUST NOT fail the whole response.
- LLM connectivity in this response is summary-only; LLM tests remain manual-only.

### `GET /v1/admin/runtime/llm-connectivity`

Response:

- `data.rows`: staging-active/admitted route rows
- `data.manual_tests_auto_polled`: `false`

Row fields:

- `route_id`
- `provider_id`
- `model_id`
- `model_name`
- `model_version`
- `profile_id`
- `voice_line_id`
- `policy_route_id`
- `credential_pool_id` or sanitized credential operational identifier
- `status`
- `last_test`: transient UI/API state when available

### `POST /v1/admin/runtime/llm-connectivity/test`

Request:

- `route_id` for one row, or `scope=all_admitted` if the UI exposes "test all"

Response:

- `data.results`: per-route transient results
- each result contains `route_id`, `status`, `latency_ms`, `tested_at`, `error_code`, and `error_message_redacted`

Manual test invariants:

- MUST use the existing LLM gateway route.
- MUST use a dedicated tiny diagnostic prompt.
- MUST NOT enqueue runtime events.
- MUST NOT write public/private content.
- MUST NOT mutate agent memory or business state.
- MUST NOT persist `RuntimeOperationRecord` rows for success or failure.
- MUST NOT store raw prompts or completions.

## LLM Diagnostic Prompt Contract

Prompt reference:

- `id`: `admin-llm-connectivity-diagnostic`
- `version`: `1`
- Purpose: verify the actual staging provider/model/credential/adapter path can return a minimal response.

Prompt content:

- One short non-user instruction equivalent to "return OK".
- No user content, community content, private content, memories, or retrieved context.

Gateway routing requirements:

- Use the resolved route row being tested.
- Use `visibility: 'dev_only'`.
- Use `intent: 'dev_prompt_render'`.
- Use `scene: 'dev_prompt_render'`.
- Use `budgetClass: 'dev_only'`.
- Use `modality: 'text'`.
- Use `responseMode: 'text'`.
- Use a trace ID prefixed with `admin-llm-connectivity:` and a generated test run ID.
- Add the prompt template to the prompt registry/template set if it is not already present.

Success criteria:

- Gateway returns without provider/adapter/credential error.
- Latency is measured.
- Response text is discarded after success classification.

Failure criteria:

- Provider/adapter/credential/gateway errors are mapped to sanitized `error_code` and bounded `error_message_redacted`.

## Flow Contract Matrix

### Slice 0 — Branch and Migration Prep

- Entry review: confirm `prisma/schema.prisma`, DB SSOT mode, and index contract.
- Inputs: data contract, retention policy, source/status allowlists.
- Outputs: Prisma model, migration, refreshed DB context if required by DB SSOT.
- Invariants: no business code changes; no raw-content columns; no enum migration lock-in for source/status/severity.
- Exit criteria: schema validates and migration diff matches the model/index contract.
- Downstream dependency: Slice 1 repository implementation.

### Slice 1 — Repository and Domain Contract

- Entry review: confirm repository patterns and pg/in-memory test conventions.
- Inputs: Prisma model and API filter contract.
- Outputs: repository interface, pg implementation, list/detail/deleteExpired behavior.
- Invariants: business services do not import Prisma; pagination is deterministic.
- Exit criteria: repository tests cover filtering, cursor order, and cleanup boundaries.
- Downstream dependency: Slice 2 service and Slice 3 admin APIs.

### Slice 2 — Runtime Observability Service

- Entry review: confirm config flag names and repository injection path.
- Inputs: repository contract, redaction rules, payload limits, feature flags.
- Outputs: `record`, `list`, `getDetail`, `cleanupExpired`, redaction/truncation helpers.
- Invariants: `record()` catches persistence failures; disabled write flag prevents persistence; sensitive content is redacted.
- Exit criteria: service tests prove write isolation, redaction, payload limits, and disabled behavior.
- Downstream dependency: Slice 3 APIs, Slice 5 instrumentation, Slice 6 cleanup.

### Slice 3 — Admin Backend APIs

- Entry review: confirm existing admin runtime route registration and auth middleware.
- Inputs: service contract and API response contract.
- Outputs: list/detail/infra/LLM endpoints under `/v1/admin/runtime/*`.
- Invariants: all routes require human admin auth; invalid filters return 400; no destructive endpoint is added.
- Exit criteria: route tests cover auth, validation, pagination, detail references, and disabled states.
- Downstream dependency: Slice 7 frontend and Slice 8 smoke verification.

### Slice 4 — Infra Snapshot and LLM Connectivity

- Entry review: map each section to an existing metric source or a lightweight ping/check.
- Inputs: infra snapshot API contract, LLM diagnostic prompt contract, current containers.
- Outputs: infra snapshot service and LLM connectivity diagnostic service.
- Invariants: partial failures return section-level status; periodic snapshots are not persisted; LLM tests are manual-only and transient.
- Exit criteria: tests cover partial failures, model metadata display, sanitized LLM failures, and no operation-record writes.
- Downstream dependency: Slice 3 endpoints and Slice 7 UI panels.

### Slice 5 — Runtime and Business-Node Instrumentation

- Entry review: confirm exact insertion points in runtime loop, queue, executor, scheduler, proactive interaction, DB/repository boundaries, and selected media paths.
- Inputs: observability service helpers and phase-1 source/status allowlists.
- Outputs: side-effect-free operation records for selected runtime/public-output stages and failures.
- Invariants: instrumentation never changes business outcomes; no private-chat-specific diagnostics; no raw payload capture.
- Exit criteria: targeted tests prove success/failure paths preserve behavior and emit expected redacted records.
- Downstream dependency: Slice 7 records table and Slice 8 synthetic failure verification.

### Slice 6 — Retention Cleanup CLI and Service

- Entry review: confirm package script naming and existing script style uses `.mjs` ESM.
- Inputs: retention policy and repository `deleteExpired`.
- Outputs: cleanup service path plus `pnpm runtime-records:cleanup`.
- Invariants: cleanup deletes only operation records; governance-linked rows are excluded; no admin UI cleanup is added.
- Exit criteria: tests cover dry-run/apply behavior if dry-run is implemented, severity cutoffs, and governance-linked exclusion.
- Downstream dependency: Slice 8 rollout maintenance check.

### Slice 7 — Frontend Admin Page

- Entry review: confirm admin route/sidebar/hook/type/query-key patterns.
- Inputs: API contracts, feature flag contract, UX placement.
- Outputs: `/admin/runtime-records` page, sidebar entry, hooks/types, filters, detail view, infra panel, LLM table.
- Invariants: read-only UI; no retry/release/escalate/manual cleanup buttons; partial infra states and transient LLM results render clearly.
- Exit criteria: frontend tests cover route/sidebar visibility, filters, detail, empty/disabled states, partial infra failures, and LLM manual result rendering.
- Downstream dependency: Slice 8 local smoke.

### Slice 8 — Verification and Rollout

- Entry review: confirm all slice exit criteria are recorded in `04-verification.md`.
- Inputs: completed schema, backend, instrumentation, cleanup, and frontend slices.
- Outputs: verification log, rollout notes, rollback instructions.
- Invariants: failed verification blocks rollout; rollback remains flag-based first.
- Exit criteria: `pnpm db:validate`, targeted backend/frontend tests, `pnpm typecheck`, `pnpm lint`, and optional admin smoke are recorded with outcomes.
- Downstream dependency: user approval to enable flags in target environments.

## Final Package Review

The package is implementation-ready after this review because:

- product scope is locked
- non-goals are explicit
- DB/API/UI contracts are drafted
- feature flags are named
- data safety and retention are bounded
- runtime instrumentation is constrained to high-value paths
- every delivery slice has entry and exit checks
- verification and rollback paths are explicit

Implementation SHOULD proceed slice-by-slice. Before moving from one slice to the next, update `03-implementation-notes.md` and `04-verification.md` with the completed exit criteria and any code-local decision made during entry review.
