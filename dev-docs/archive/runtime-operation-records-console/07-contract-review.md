# 07 Contract Review Summary — T-301

## Archived Decision

T-301 delivered a phase-1, read-only runtime operation records console for operator debugging and supervision. The original contract review was reduced during archive cleanup; this summary preserves only the decisions needed for future maintenance.

## Scope Locked

- Add persisted `RuntimeOperationRecord` rows plus admin list/detail APIs.
- Expose `/admin/runtime-records` under `状态与运维 -> 运行记录`.
- Keep phase 1 read-only: no retry, remediation, governance escalation, destructive cleanup, or manual cleanup UI.
- Keep private-chat-specific diagnostics out of scope.
- Keep LLM manual diagnostics transient; do not persist them as operation records.
- Use runtime records for operational debugging, not as a replacement for `AgentRun`, `LlmUsageLedger`, `RiskEventLog`, `GovernanceActionLog`, media observability, or persona observability.

## Feature Flags

- `FF_RUNTIME_OPERATION_RECORDS_WRITE`
  - Backend capability: `config.launch.capabilities.runtimeOperationRecordsWrite`.
  - Controls persistence through `RuntimeOperationRecordService.record()`.
- `FF_ADMIN_RUNTIME_RECORDS_UI`
  - Backend capability: `config.launch.capabilities.adminRuntimeRecordsUi`.
  - Controls admin runtime-records API surface availability.
- `VITE_FF_ADMIN_RUNTIME_RECORDS_UI`
  - Frontend capability: `FRONTEND_LAUNCH_CAPABILITIES.adminRuntimeRecordsUi`.
  - Controls `/admin/runtime-records` route/sidebar visibility.

Invariants:

- Write enablement does not depend on frontend visibility.
- Disabling writes must not change business behavior.
- UI must render clear disabled/empty states when enabled but no records exist or writes are off.

## Data Contract

Primary persisted model:

- Prisma model: `RuntimeOperationRecord`
- Table: `runtime_operation_records`
- Required: `id`, `occurredAt`, `severity`, `source`, `operation`, `status`, `createdAt`
- Trace/entity linkage: trace/correlation/event IDs, agent/community/post/room/session/message IDs, linked `AgentRun`, linked LLM trace, linked risk event
- Diagnostics: `durationMs`, `errorCode`, `errorMessageRedacted`, `retryCount`, bounded `payloadJson`

Contract choices:

- `severity`, `source`, and `status` remain string columns validated in TypeScript to avoid enum migration churn.
- Pagination is deterministic on `occurredAt desc, id desc`.
- Payloads are structured summaries only, with sensitive-key redaction, freeform error-message redaction, string truncation, and payload size caps.
- Cleanup deletes only runtime operation records.

Retention:

- `critical` / `error`: 90 days
- `warn`: 30 days
- sampled `info` / `succeeded`: 7 days
- governance-linked rows are excluded from ordinary cleanup.

## API Contract

All routes require `requireHumanAuth` and `requireAdmin` under the existing `/v1` prefix.

- `GET /v1/admin/runtime/operation-records`
  - Supports severity/source/status filters, trace/correlation/event/risk IDs, entity filters, since/until, cursor, and limit capped at 100.
  - Returns records, next cursor, normalized filters, write flag state, and retention policy.
- `GET /v1/admin/runtime/operation-records/:id`
  - Returns redacted detail, compact references, and payload summary.
  - References can include `AgentRun`, `LlmUsageLedger`, `Event`, `RiskEventLog`, and `GovernanceActionLog`.
- `GET /v1/admin/runtime/infra-snapshot`
  - Read-only current health snapshot with `poll_interval_ms=15000`.
  - Sections: process, HTTP, Postgres, Redis queue, SSE, LLM, media storage.
  - Section failures must not fail the whole response.
  - Periodic snapshots are not persisted as runtime records.
- `GET /v1/admin/runtime/llm-connectivity`
  - Shows staging-active/admitted route rows with provider, model, profile/route, credential pool identifier, and transient manual-test state.
- `POST /v1/admin/runtime/llm-connectivity/test`
  - Runs one route or all admitted routes through the existing gateway path.
  - Returns sanitized transient status, latency, timestamp, and error details.

## LLM Diagnostic Contract

- Prompt id: `admin-llm-connectivity-diagnostic`, version `1`.
- Prompt purpose: minimal provider/model/credential/adapter connectivity check.
- Prompt content: tiny non-user instruction equivalent to "return OK".
- No user/community/private content, memory, retrieved context, raw prompt storage, raw completion storage, queue mutation, memory mutation, business mutation, or runtime-record persistence.
- Route through the resolved gateway row with dev-only intent/budget and a trace ID prefixed `admin-llm-connectivity:`.

## Instrumentation Boundary

Phase-1 sources:

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

Phase-1 statuses:

- `started`
- `succeeded`
- `failed`
- `retried`
- `dead_lettered`
- `skipped`

Runtime instrumentation must be side-effect free, must catch persistence failures, and must never capture raw private content, raw prompts, raw completions, credentials, tokens, or secrets.

## Frontend Contract

- Read-only admin page.
- Sidebar entry appears only when the frontend UI flag is enabled.
- Page supports filters, list, cursor pagination, detail drawer, infra snapshot panel, LLM connectivity table, and transient manual LLM test results.
- No retry, release, escalate, override, or cleanup buttons in phase 1.

## Verification Pointer

Use `04-verification.md` for final commands and outcomes. The archived result includes DB validation, DB context sync, repository/service/route/frontend tests, runtime instrumentation regression tests, cleanup CLI smoke, typecheck, lint, build, and project governance lint.

## Rollout Notes

Rollout is operational, not part of archived development:

- Enable `FF_ADMIN_RUNTIME_RECORDS_UI`, `VITE_FF_ADMIN_RUNTIME_RECORDS_UI`, and `FF_RUNTIME_OPERATION_RECORDS_WRITE` per environment.
- Trigger a synthetic staging runtime failure and confirm a row appears in `/admin/runtime-records`.
- Run `pnpm runtime-records:cleanup` dry-run before `pnpm runtime-records:cleanup:apply`.

Future runtime-records expansion should start a new task instead of editing this archived task history.
