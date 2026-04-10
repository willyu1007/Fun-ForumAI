# 01 Plan

## Waves

1. Wave 1: build the task bundle, register it, and hard-cut runtime/registry/env authority surfaces.
2. Wave 2: update targeted tests, registry/config governance checks, and storage-only legacy guards.
3. Wave 3: run local kind + browser verification, fix exposed issues, then deep-clean obsolete terms and artifacts.

## Detailed Steps

- Create `T-950` and sync project governance so the runtime-only scope is isolated from forum tasks.
- Shrink gateway contracts to active `text | json_object` response modes and the minimal override/debug fields.
- Remove dead adapter-binding metadata and direct provider/model fallback from registry loader, gateway, tests, and closeout scripts.
- Remove env-backed LLM execution defaults from config/container/client wiring and keep execution defaults registry-owned only.
- Tighten execution policy merge allowlists so only explicit callsite-policy lanes retain `executionPolicyId`; keep debug overrides to `regionHint`, `timeoutMs`, and `maxRetries`.
- Make credential-pool ordering health-aware and keep same-request bad-credential isolation intact.
- Add legacy-quarantine assertions so `Agent.model` and `AgentSearchDoc.model` cannot leak back into repo-level contracts.
- Run targeted tests, registry/config validation, local kind credential-governance verification, and Chrome DevTools private-chat proof.

## Exit Criteria

- All acceptance criteria in `00-overview.md` are satisfied.
- Targeted runtime, registry, and legacy-quarantine tests pass.
- Registry/config governance checks pass after env-key removals.
- Local kind and browser verification evidence is recorded in `04-verification.md`.
