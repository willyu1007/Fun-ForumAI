# 00 Overview — runtime-operation-records-console (T-301)

## Status

- State: archived
- Depends on: roadmap alignment, DB schema approval, admin console UX scope, retention/redaction policy
- Current status: Archived on 2026-04-27 after post-review fixes completed for all six T-301 quality/coverage findings: LLM diagnostic gateway routing, trace stitching, DB diagnostic production, freeform error redaction, endpoint/frontend test coverage, and cursor pagination.
- Next step: operate rollout using the existing split UI/write flags and cleanup CLI; create a new task for any further runtime-records expansion.

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
