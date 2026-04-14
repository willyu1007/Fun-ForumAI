# 03 Implementation Notes — T-201

## Status
- Current status: `implemented`
- Last updated: `2026-04-14`

## What changed
- Landed `Phase 1-3` of the LLM/media matrix migration:
  - refreshed the active visible and hidden model matrix in `.ai/llm-config/registry/*`
  - converged director and vision routing onto `qwen3.5-plus` primary, `glm-5.1` text fallback, and `qwen3.5-flash` vision fallback
  - introduced composed media generation fallback with Ark `doubao-seedream-5-0-lite-260128` primary and DashScope `qwen-image-2.0` fallback
  - updated env contract/docs for the fallback media generation slots
- Replaced the temporary Doubao carrier-line shortcut with canonical line-level semantics:
  - added a real `doubao-deep-v1` `VoiceLineId`
  - restored `kimi-deep-v1` catalog naming and Moonshot/Kimi model semantics
  - moved the active Doubao registry profiles/admission/routing from `kimi-deep-*` to `doubao-deep-*`
  - updated inference-profile family mapping, codec parsing, hidden-callsite expectations, and context-summary voice-line resolution to accept the canonical Doubao line
  - added `src/backend/dev/canonicalize-doubao-voice-line.ts` plus `pnpm voice-line:canonicalize-doubao` for live-data cutover and agent-search reconcile
- Canonicalized the hidden director line and removed stale naming drift:
  - renamed the hidden line id from `deepseek-director-v1` to `qwen-director-v1`
  - renamed hidden director profile ids from `deepseek-director-*` to `qwen-director-*`
  - updated hidden callsites, runtime summary orchestration, registry validation rules, and tests to treat the Qwen-led director line as the only canonical hidden director identity
  - removed the now-obsolete `future-platform-evolution` “Doubao/Kimi voice line 解耦” backlog entry because the work is no longer future work
- Resolved the earlier `future-platform-evolution` debt by removing the “Doubao runs on Kimi ID” steady-state design; the remaining Kimi limitation is rollout/typed-controls, not semantic identity drift.

## Files/modules touched (high level)
- `.ai/llm-config/registry/model_profiles.yaml`
- `.ai/llm-config/registry/provider_admission.yaml`
- `.ai/llm-config/registry/routing_policies.yaml`
- `src/shared/agent-persona-catalog.ts`
- `src/backend/media/*`
- `src/backend/container/llm.ts`
- `src/backend/lib/config.ts`
- `env/contract.yaml` and generated env/docs artifacts
- `dev-docs/active/llm-matrix-refresh-and-media-fallback-v1/*`
- `dev-docs/active/future-platform-evolution/00-overview.md`

## Decisions & tradeoffs
- Decision:
  - Treat the work as a cross-cutting task that requires a full bundle rather than an in-chat-only plan.
  - Rationale:
    - the change spans LLM registries, runtime routing, media generation, env/docs, and verification
  - Alternatives considered:
    - a lightweight roadmap without execution docs; rejected because the task is likely multi-session and touches multiple subsystems
- Decision:
  - Keep typed provider extensions as a gated implementation phase instead of assuming they land in the same slice.
  - Rationale:
    - this separates registry/media migration from runtime contract expansion
  - Alternatives considered:
    - bundling provider extensions into phase 1; rejected for now because it increases uncertainty and review surface
- Decision:
  - Keep `kimi-k2.5` out of active visible production lanes in this round.
  - Rationale:
    - current runtime does not yet support the provider-specific request controls needed for a confident rollout
  - Alternatives considered:
    - immediate conservative single-model rollout; rejected in favor of lower execution risk
- Decision:
  - Set director hidden routing to `qwen3.5-plus` primary, `glm-5.1` text fallback, and `qwen3.5-flash` vision fallback.
  - Rationale:
    - this keeps hidden planning/digest/vision lanes unified while preserving a strong non-Qwen text fallback
  - Alternatives considered:
    - `deepseek-chat` as director text fallback; rejected for now
- Decision:
  - Introduce a standalone canonical `doubao-deep-v1` once the temporary carrier-line drift proved unacceptable.
  - Rationale:
    - `voice_line_id` is a project-wide semantic primary key, so leaving Doubao on `kimi-deep-v1` would permanently blur identity, control-plane data, and observability
  - Alternatives considered:
    - keeping the temporary carrier-line design; rejected because it leaves a dual-track semantic model in steady state
- Decision:
  - Keep `kimi-deep-v1` semantically restored but out of current active persona/challenger routing instead of forcing an all-shadow visible admission pool.
  - Rationale:
    - registry validation requires visible lines to retain admitted candidates; routing inactivity is therefore enforced at persona/family-selection level rather than by an invalid all-shadow pool
  - Alternatives considered:
    - leaving the Kimi line all-shadow in provider admission; rejected because the registry validator rejects visible profiles with zero admitted candidates

## Deviations from plan
- The original “no new voice line this round” boundary was intentionally broken after the temporary carrier-line shortcut proved semantically unacceptable. The replacement canonicalization stayed inside the same task bundle to avoid running the repo in a dual-track voice-line state.

## Known issues / follow-ups
- Repo-wide `pnpm typecheck` still fails in untouched areas outside the `T-201` write set.
- The live-data backfill CLI has been implemented but still needs to be executed in a persistence-enabled environment as part of staging cutover.
- Kimi remains semantically restored but is not part of current active persona/challenger routing; typed provider controls are still deferred.

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
