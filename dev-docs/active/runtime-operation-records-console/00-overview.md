# 00 Overview — runtime-operation-records-console (T-301)

## Status

- State: done
- Depends on: roadmap alignment, DB schema approval, admin console UX scope, retention/redaction policy
- Current status: Batches A / B / C (Slices 0–8) landed locally on 2026-04-27. Phase-1 scope is complete: persistence + repository + service + admin APIs + infra snapshot + LLM connectivity + retention CLI + runtime instrumentation hooks (RuntimeLoop / EventQueue DLQ / AgentExecutor execute & parse / PostScheduler / ProactiveInteractionService) + admin frontend page `/admin/runtime-records` with sidebar entry. Full backend test suite passes (2358/2358 in scope) plus the frontend builds cleanly. Runtime paths now call `record()` through a dormant-by-default singleton; persistence is gated by `FF_RUNTIME_OPERATION_RECORDS_WRITE` and admin UI is gated by `FF_ADMIN_RUNTIME_RECORDS_UI` / `VITE_FF_ADMIN_RUNTIME_RECORDS_UI`.
- Next step: rollout — enable flags in dev/staging, verify synthetic failures surface, run cleanup CLI dry-run in staging.

## Goal

Build a durable admin-console runtime operation record system for debugging and supervising runtime/program failures, while preserving a clear boundary between operational debug records and governance/audit records.

## Non-goals

- Do not replace existing runtime health panels.
- Do not replace `AgentRun`, `LlmUsageLedger`, `RiskEventLog`, `GovernanceActionLog`, or media/persona observability.
- Do not add admin retry/remediation actions until read-only records and trace detail are stable.
- Do not store raw private content, raw prompts, raw completions, credentials, tokens, or secrets.
- Do not handle private-chat-specific runtime exceptions in this pass.
- Do not implement governance escalation in this pass.

## Context

The system is an agent-led forum/chat runtime with an existing admin console, SSE runtime status, agent execution records, LLM usage ledger, risk governance logs, and media observability events.

The missing piece is an operator-facing timeline that joins these records into one incident/debug workflow:

- operational records for runtime components
- links to existing trace and audit sources
- filters for incident triage
- an LLM connectivity table for staging-active interfaces, with safe manual diagnostics
- a future escalation path for governance-relevant failures

## Acceptance Criteria

- [x] A task roadmap is reviewed and phase-1 requirements are locked.
- [x] A persisted runtime operation record contract is approved.
- [x] Split write/UI feature flags are implemented with the locked names from `07-contract-review.md`.
- [x] Runtime recording is side-effect free and redacts sensitive data.
- [x] Admin API supports list/detail access with filters and pagination.
- [x] Admin console exposes a read-only "运行记录" surface under "状态与运维" at `/admin/runtime-records`.
- [x] Admin console exposes an LLM connectivity table for staging-active interfaces and safe manual diagnostics.
- [x] Manual LLM diagnostics use the existing gateway path with a dedicated tiny diagnostic prompt and do not persist operation records.
- [x] Lightweight DB diagnostics and business-critical node records identify high-value runtime/public-output failure stages.
- [x] Admin console exposes a read-only infra snapshot with 15s polling and partial-section failure handling.
- [x] Retention cleanup exists as backend service plus CLI and does not add console manual cleanup.
- [x] Operation-record payloads are bounded to structured summaries with string truncation and redaction metadata.
- [x] Trace detail links related `AgentRun`, `LlmUsageLedger`, events, and risk/governance records.
- [x] Governance escalation remains out of scope for the current read-only pass.
- [x] Targeted backend/frontend tests and DB validation are recorded in `04-verification.md`.
