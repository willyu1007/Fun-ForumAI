# 01 Plan — T-301

## Phases

1. Requirements alignment
2. Data contract and DB design
3. Backend repository/service/API
4. Runtime instrumentation
5. Admin console read-only surface
6. Trace detail; governance escalation deferred
7. Verification and rollout

## Detailed Steps

Implementation-level sequencing is maintained in `06-execution-plan.md`. This file keeps the phase-level plan and acceptance gates.

1. Review `roadmap.md` and answer the open alignment questions.
2. Lock the phase-1 scope:
   - record severities and statuses
   - instrumented sources
   - retention window
   - redaction policy
   - admin UX placement
   - LLM connectivity table and safe manual diagnostic scope
   - split write/UI feature flags
   - infra snapshot 15s polling, LLM manual-test-only behavior
   - payload truncation/size limits
3. Design the persisted contract:
   - add Prisma model and migration if approved
   - add repository interface and pg implementation
   - add query indexes for time, severity, source, status, agent, trace, and entity filters
4. Add `runtimeObservabilityService.record()`:
   - must catch and log its own persistence failures
   - must never change business behavior
   - must normalize/redact error messages and payloads
5. Instrument phase-1 paths:
   - `RuntimeLoop`
   - `RedisStreamRuntimeEventQueue`
   - `AgentExecutor`
   - `PostScheduler`
   - `ProactiveInteractionService`
   - runtime-critical repository/DB boundary diagnostics
   - business-critical public-output milestones
   - selected media worker/observability bridges where they add incident value
6. Add admin APIs:
   - `GET /v1/admin/runtime/operation-records`
   - `GET /v1/admin/runtime/operation-records/:id`
   - `GET /v1/admin/runtime/llm-connectivity`
   - `POST /v1/admin/runtime/llm-connectivity/test`
   - `GET /v1/admin/runtime/infra-snapshot`
   - optional trace aggregation endpoint if detail view needs server-side stitching
7. Add frontend hooks/types and a read-only admin console page at `/admin/runtime-records`.
8. Add trace detail:
   - related LLM ledger entries by `trace_id` or prefix
   - related agent run by ID/event/agent
   - related risk/governance records if linked
9. Add LLM connectivity diagnostics:
   - show staging-active provider/model/credential route rows
   - include concrete model name/model ID for each active route
   - allow safe manual test for a selected row or all rows
   - execute tests through the existing gateway route with a dedicated tiny diagnostic prompt
   - record/display sanitized status, latency, error code, and tested-at timestamp
   - keep manual test results transient in the admin response/UI state
   - do not generate public content or mutate business data
10. Add retention cleanup:
   - enforce error/critical 90d, warn 30d, sampled info/success 7d
   - implement backend cleanup service and CLI entrypoint for phase 1
   - leave scheduler wiring for later unless implementation discovers an existing scheduler hook is low-risk
   - do not add console manual cleanup in this pass
11. Add lightweight DB diagnostics and business node instrumentation:
   - DB connectivity/latency/error signals for runtime-critical persistence boundaries
   - no raw query capture, DB payload dumps, or full slow-query explorer
   - operation records for key runtime/public-output milestones
12. Add infra snapshot:
   - process/build/memory/event-loop health
   - API 5xx/latency short-window summary if available
   - Postgres and Redis health
   - queue lag/retry/DLQ summary
   - SSE broker/client health
   - LLM connectivity summary
   - storage/media worker health summary
   - keep infra snapshot read-only and separate from operation-record persistence
   - poll from UI every 15 seconds
   - keep LLM connectivity checks manual-only
13. Defer governance escalation to a later implementation pass.
14. Run verification and update `04-verification.md`.

## Contract Reference

`07-contract-review.md` is the implementation contract for this task. It closes the requirement gaps, locks feature flag names, drafts API/data contracts, and defines entry/exit reviews for every delivery slice.

## Acceptance Gates

- Gate 1: roadmap approved. `[passed for phase-1 scope]`
- Gate 2: DB contract approved.
- Gate 3: instrumentation writes are side-effect free and redacted.
- Gate 4: admin read-only surface works with pagination and filters.
- Gate 5: LLM connectivity manual diagnostics are non-business and sanitized.
- Gate 6: retention cleanup can remove expired operation records without touching canonical `AgentRun`, `LlmUsageLedger`, `RiskEventLog`, or business data.
- Gate 7: DB diagnostics are lightweight and bounded; business node records explain failed stage without logging sensitive payloads.
- Gate 8: infra snapshot is read-only, graceful under dependency failure, and not persisted as operation records.
- Gate 9: operation-record payloads are bounded and redacted; write/UI flags can be enabled independently.

## Verification Plan

- `pnpm db:validate`
- targeted backend tests for repository, service, route filters, redaction, and instrumentation failure isolation
- targeted LLM connectivity diagnostics tests
- targeted retention cleanup tests
- targeted DB diagnostic and business-node instrumentation tests
- targeted infra snapshot route/service tests
- targeted frontend tests for admin list/detail rendering and filter behavior
- `pnpm typecheck`
- `pnpm lint`
- optional local UI smoke through the admin console

## Risks & Mitigations

- Risk: record volume is too high.
  - Mitigation: phase 1 stores warn/error/critical plus selected lifecycle markers; sample successful records if needed.
- Risk: sensitive content leaks into records.
  - Mitigation: central redaction helper, denylist keys, and tests with private-chat shaped payloads.
- Risk: trace links drift from canonical ledgers.
  - Mitigation: store references and summaries, not duplicated full ledger/run payloads.
- Risk: instrumentation failure breaks runtime behavior.
  - Mitigation: record service catches persistence errors and has tests proving business path continues.
- Risk: manual LLM connectivity checks accidentally create content or consume unsafe prompt paths.
  - Mitigation: use a dedicated tiny diagnostic route/prompt, record sanitized metadata only, and never enqueue runtime events.
- Risk: operation records are mistaken for complete incident observability.
  - Mitigation: document coverage boundaries and keep links to canonical ledgers plus existing runtime stats.
- Risk: cleanup deletes useful evidence too early.
  - Mitigation: align retention by severity, test cutoff behavior, and keep governance-linked evidence out of ordinary cleanup unless explicitly approved.
- Risk: DB diagnostics become an accidental APM clone or leak query payloads.
  - Mitigation: record only connectivity, bounded latency buckets/measurements, repository/operation names, and sanitized error codes.
- Risk: business-critical node instrumentation becomes noisy.
  - Mitigation: start with stage transitions and failures for public-output/runtime-critical paths, not every function call.
- Risk: infra snapshot becomes a second observability database.
  - Mitigation: compute real-time/short-window summaries and do not persist periodic snapshot rows.
- Risk: a broken dependency blocks the admin diagnostic page.
  - Mitigation: return partial snapshot sections with per-section status/error instead of failing the whole response.
- Risk: oversized payloads create DB bloat or expose sensitive context.
  - Mitigation: store only structured summaries, truncate strings around 1-2KB, and keep payload target around 8-16KB.
