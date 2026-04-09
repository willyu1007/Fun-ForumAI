# 02 Architecture

## Target Boundary

The only active LLM execution authority after this task is:

`generated routing artifact -> registry bundle -> gateway plan -> credential broker -> openai_compatible chat runtime`

Everything else is either:

- storage-only legacy (`Agent.model`, `AgentSearchDoc.model`)
- operational diagnostics (`runtime-authority-state` pin/debug detection)
- or deleted as an inactive pseudo-surface

## Locked Decisions

- Runtime honesty wins over future-facing abstraction. Unimplemented response modes, adapter capability flags, and direct provider/model fallback are removed instead of documented as “reserved”.
- Provider auth metadata is provider-owned only. Adapter bindings cannot carry parallel auth truth.
- Execution defaults are registry-owned only. Environment variables cannot provide active generation defaults.
- Callsite overrides are lane-binding only (`executionPolicyId`) and remain limited to the explicit hidden lanes that need them.
- Debug overrides are operational only (`regionHint`, `timeoutMs`, `maxRetries`) and must remain visible through authority-state observability.

## Main Risks To Address

- Hidden second truth sources in adapter bindings, env defaults, or overly wide override allowlists.
- Candidate ordering preferring high-headroom degraded pools over healthy pools.
- Legacy `model` fields re-entering repo contracts through future mappings.
- Local kind verification drifting from the real execution path if the credential exercise uses mocked rather than actual runtime traffic.
