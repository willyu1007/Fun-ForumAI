# Roadmap — runtime-operation-records-console (T-301)

## Summary

Add a governed runtime operation record system to the admin console so operators can debug program/runtime failures, inspect execution traces, and escalate only safety-relevant failures into governance records.

The first deliverable SHOULD be a read-only operational ledger and console view. Remediation actions such as retry, release, or manual override SHOULD come after the records and trace semantics are stable.

Phase 1 also includes a safe LLM connectivity panel for the interfaces actually used by staging. This panel MAY allow a manual connectivity test because it is diagnostic and non-remediating; it MUST NOT mutate business data or trigger agent/public content generation.

## Problem

The repo already has several useful record sources:

- `AgentRun` records agent execution outcomes.
- `LlmUsageLedger` records model/provider routing, fallback, cost, latency, and LLM errors.
- `RiskEventLog` and `GovernanceActionLog` record safety and governance actions.
- Domain-specific observability exists for media and persona runtime.

These sources are useful but fragmented. The admin console currently exposes real-time runtime health and domain-specific summaries, but it does not provide a durable, filterable incident/debug timeline that answers:

- What failed?
- Which runtime component failed?
- Which event/agent/session/post was affected?
- Which LLM trace and agent run are related?
- Was this only an operational failure, or should it become a governance event?

## Product Direction

Create an admin console surface named "运行记录" under "状态与运维" at `/admin/runtime-records`.

The console MUST support:

- recent operation records ordered by time
- filtering by severity, source, operation, status, agent, trace ID, and entity IDs
- a detail view that links related event, agent run, LLM ledger entry, risk event, and governance action references
- an LLM connectivity table for staging-active provider/model/credential routes, with a safe manual test action
- the LLM connectivity table MUST show the concrete model name/model ID used by each route
- a read-only infra snapshot for process/API/Postgres/Redis/SSE/LLM/storage health
- clear separation between debug records and governance records
- redacted error/context display suitable for admin users

## Milestones

1. Task alignment and requirements lock: `[planned]`
2. Data contract and persistence design: `[planned]`
3. Backend record service and repository: `[planned]`
4. Runtime instrumentation for high-value failure points: `[planned]`
5. Admin API and console read-only view: `[planned]`
6. Trace detail with governance escalation deferred: `[planned]`
7. Verification, retention policy, and rollout controls: `[planned]`

## Phase Scope

### Phase 1: Read-only operation ledger

- Add a persisted `RuntimeOperationRecord` model or equivalent repository-backed contract.
- Add `runtimeObservabilityService.record()` as the canonical write boundary.
- Add admin list/detail APIs.
- Add admin console list and detail drawer/page at `/admin/runtime-records`.
- Add an LLM connectivity table for staging-active interfaces and a safe manual diagnostic test.
- Add lightweight DB diagnostics for runtime operations, focused on connectivity/latency/error signals rather than full slow-query tracing.
- Add business-critical node instrumentation for key runtime/public-output milestones.
- Add a read-only infra snapshot endpoint/panel for current health signals; do not store infra snapshot rows in `RuntimeOperationRecord`.
- Instrument only the highest-value failure paths.
- Store warn/error/critical records by default, plus selected lifecycle markers only when they help incident diagnosis.
- Exclude private-chat-specific exception handling from phase 1.
- Add retention cleanup behavior for operation records. Prefer scheduled/CLI maintenance first; console manual cleanup is a later controlled action because the current admin surface is read-only.

### Phase 2: Trace stitching

- Link operation records to `AgentRun`, `LlmUsageLedger`, `Event`, and `RiskEventLog`.
- Add trace detail aggregation by `trace_id`, `correlation_id`, or entity IDs.
- Add summary badges for fallback, retry, parse failure, write failure, safety block, and DLQ.

### Phase 3: Governance escalation

- Allow selected records to be marked as reviewed or escalated.
- Escalation MUST create or link a `RiskEventLog` only when the issue affects safety, public output, privacy, moderation, or governance outcomes.
- Add immutable audit metadata for who escalated, when, and why.
- Phase 3 is explicitly out of scope for the current implementation pass.

## Candidate Record Contract

```ts
type RuntimeOperationRecord = {
  id: string
  occurred_at: string
  severity: 'info' | 'warn' | 'error' | 'critical'
  source:
    | 'runtime_loop'
    | 'agent_executor'
    | 'post_scheduler'
    | 'proactive_interaction'
    | 'event_queue'
    | 'llm_gateway'
    | 'media_worker'
    | 'db_diagnostic'
    | 'guidance_worker'
    | 'system'
  operation: string
  status: 'started' | 'succeeded' | 'failed' | 'retried' | 'dead_lettered' | 'skipped'
  trace_id: string | null
  correlation_id: string | null
  event_id: string | null
  agent_id: string | null
  community_id: string | null
  post_id: string | null
  room_id: string | null
  session_id: string | null
  message_id: string | null
  duration_ms: number | null
  error_code: string | null
  error_message_redacted: string | null
  retry_count: number | null
  linked_agent_run_id: string | null
  linked_llm_trace_id: string | null
  linked_risk_event_id: string | null
  payload_json: Record<string, unknown> | null
}
```

## Instrumentation Candidates

Start with these high-signal paths:

- `RuntimeLoop.tick`: tick-level failure, event retry, queue backlog, skipped leadership.
- `RedisStreamRuntimeEventQueue`: retry limit exceeded and DLQ write.
- `AgentExecutor`: top-level execution failure, parse failure, no-write decision, scene skip.
- `PostScheduler`: autonomous post failure, route unavailable, visual planning failure, write failure.
- `ProactiveInteractionService`: proactive opening failure and agent-run persistence failure.
- LLM runtime: do not duplicate `LlmUsageLedger`; link via `trace_id` and only create operation records for operationally meaningful failures/fallback summaries.
- LLM connectivity: add a table for staging-active interfaces and manual safe checks that record test status, latency, provider/model/credential route metadata, and sanitized error codes.
- Media workers: bridge critical media observability events into the unified timeline where useful.
- DB diagnostics: record lightweight database health signals such as connectivity check failures, migration/schema drift indicators where available, and bounded query latency/error summaries for runtime-critical repositories.
- Business-critical nodes: instrument milestones such as event dequeued, agent execution selected, LLM call attempted/resulted, output parse failed/succeeded, moderation/governance block, public write attempted/resulted, media generation/attachment failed, and queue retry/DLQ.
- Infra snapshot: expose current process/API/Postgres/Redis/SSE/LLM/storage health as a read-only snapshot. Only create operation records when an infra issue manifests as a runtime/business failure.

Deferred, not phase 1:

- `PrivateChannelService` private-chat-specific failures, because that area is complex and expected to change frequently.

## Non-goals

- Do not replace `LlmUsageLedger`, `AgentRun`, `RiskEventLog`, or domain observability tables.
- Do not store raw prompts, raw completions, secrets, auth tokens, passwords, or unredacted private content.
- Do not add retry/release/destructive operations in the first milestone.
- Do not make every runtime exception a governance event.
- Do not introduce an external logging/APM dependency as a prerequisite.
- Do not handle private-chat-specific runtime exceptions in this pass.
- Do not implement governance escalation in this pass.
- Do not add console-triggered destructive cleanup actions in the first read-only UI pass.
- Do not build a full database APM/slow-query explorer in this pass.
- Do not persist periodic infra snapshots into the operation record table.

## Open Alignment Questions

None for phase-1 requirement alignment. Implementation contracts are locked in `07-contract-review.md`; slice entry reviews handle code-local choices without changing scope.

## Locked Alignment

- Retention: error/critical 90 days, warn 30 days, sampled info/success lifecycle markers 7 days.
- Phase 1 recording scope: warn/error/critical by default, with only selected lifecycle markers.
- Private chat: exclude private-chat-specific exception handling from this task pass.
- UX: dedicated `/admin/runtime-records` page under "状态与运维 -> 运行记录".
- Governance: current pass is read-only; no escalation/review-case workflow.
- LLM connectivity test mechanism: use the existing gateway route with a dedicated tiny diagnostic prompt so the test covers the real staging provider/model/credential/adapter path.
- Manual LLM connectivity test persistence: transient display only; do not create `RuntimeOperationRecord` rows for manual test success/failure.
- LLM connectivity table source: show staging-active/admitted routes, not every registry candidate; include the concrete model name/model ID for each route.
- DB diagnostics: include lightweight DB connectivity/latency/error signals for runtime-critical paths, but do not attempt full DB APM or raw query capture.
- Business-critical nodes: add operation records around runtime/public-output milestones so most production bug triage can identify the failed stage.
- Infra snapshot: add a read-only health panel backed by real-time/short-window metrics for process/API/Postgres/Redis/SSE/LLM/storage; keep it separate from persisted operation records.
- Operational coverage expectation: phase 1 should cover most runtime/LLM/provider/content-generation/critical-write debugging, but not replace infra metrics/APM, full DB performance tracing, private-chat-specific diagnostics, or uninstrumented product bugs.
- Cleanup: implement retention cleanup as scheduled/CLI/backend maintenance first; do not add manual cleanup in this pass.
- Feature flags: split write enablement from UI visibility so the page can ship before record persistence is enabled.
- Retention cleanup implementation: phase 1 uses backend cleanup service plus CLI entrypoint; scheduler wiring can come later.
- Infra snapshot refresh: UI polls every 15 seconds; LLM connectivity tests are manual-only and never auto-polled.
- Payload limits: operation records store structured summaries only; string fields are truncated around 1-2KB and overall payload target is 8-16KB.

## Risks

- High write volume can turn debug records into a noisy hot table.
- Over-capturing payloads can leak private context or sensitive operational details.
- Duplicating `LlmUsageLedger` or `AgentRun` data can create drift and confusing dashboards.
- Weak indexes can make admin filtering expensive during incidents.
- Treating all failures as risk events can pollute governance queues.
- Operation records can still miss issues outside instrumented boundaries, especially infra saturation, DB slow queries, and private-chat-specific flows excluded from this pass.

## Rollback

- Gate record writes behind a runtime/admin observability feature flag.
- Keep operation-record write flag separate from admin UI visibility flag.
- Keep instrumentation side-effect free; if recording fails, business behavior MUST continue.
- Keep UI read-only for the first milestone.
- Allow only non-business diagnostic LLM connectivity tests; no retry/release/destructive remediation actions.
- Retention cleanup should be reversible only by backups; console manual cleanup requires a later explicit approval gate.
- Infra snapshot should degrade gracefully when a dependency is unavailable and must not block operation-record reads.
- Preserve existing runtime stats and observability views as independent fallbacks.
