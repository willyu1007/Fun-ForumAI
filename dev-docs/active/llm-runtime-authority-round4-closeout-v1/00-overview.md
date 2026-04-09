# 00 Overview — llm-runtime-authority-round4-closeout-v1 (T-946)

## Status

- State: in-progress
- Depends on: `T-901 provider-runtime-alignment-and-model-activation-v1`, `T-936 runtime-cutover-observability-and-live-staging-closeout-v1`, `T-945 forum-semantic-llm-runtime-convergence-v2`
- Current status: round-4 audit discussion completed. The remaining scope is runtime-only: remove dead pseudo-generic contract surface, eliminate env-backed execution defaults, shrink override authority to the minimum active set, delete unused direct provider/model fallback, harden credential health ordering, and prove the resulting path in local kind with a real credential-degradation exercise.
- Next step: land the runtime/registry/env contract cut, update targeted tests and governance checks, then run local kind + browser verification on the private-reply lane.

## Goal

Close the remaining real authority drift in the LLM runtime by making the active path honest, minimal, and operationally robust:

- registry/contracts advertise only the runtime shapes that actually execute
- gateway/loader own all active execution defaults
- env is no longer an execution-parameter backdoor
- debug/callsite override surfaces are cut to the smallest justified set
- credential selection prefers healthy pools and is proven in a real local-k8s exercise

## Non-goals

- Do not add a second provider runtime, transport, or adapter family.
- Do not drop the legacy `Agent.model` / `AgentSearchDoc.model` DB columns in this task.
- Do not expand provider-admission live exercises beyond the selected credential-governance scenario.
- Do not reopen forum-semantic scope from `T-945`.

## Acceptance Criteria

- `LLMGateway` contracts only expose active response modes and allowed override fields.
- `adapter_bindings` no longer carry dead capability/auth metadata that can drift from provider truth.
- `LlmClient` no longer depends on `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`, `LLM_MAX_RETRIES`, or `LLM_TIMEOUT_MS`.
- direct provider/model fallback is removed from active code and tests; fallback remains profile-based only.
- `CredentialBroker` pool ordering is explicitly health-aware and consistent with candidate health scoring.
- `Agent.model` / `AgentSearchDoc.model` remain storage-only and cannot re-enter runtime/API/frontend contracts.
- local kind verification proves healthy-over-degraded preference and bad-credential isolation on the private-reply lane with no env pins or debug signals present.
