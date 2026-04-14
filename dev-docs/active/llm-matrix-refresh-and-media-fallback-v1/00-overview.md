# 00 Overview — llm-matrix-refresh-and-media-fallback-v1 (T-201)

## Status
- State: in-progress
- Depends on: `T-901 provider-runtime-alignment-and-model-activation-v1`, `T-918 media-v1-hardening-contract-lineage-cutover`
- Current status: `Phase 1-3` implementation remains landed, and the follow-on canonicalization slice has now removed the temporary Doubao/Kimi semantic drift. The repo now has a real `doubao-deep-v1` visible line with Ark `doubao-seed-2-0-lite-260215` profiles, a restored semantic `kimi-deep-v1` line backed by Moonshot/Kimi models, updated inference/runtime/catalog wiring, and a one-off backfill CLI for live data canonicalization plus search-doc reconcile. The hidden director line has also been canonicalized from the stale `deepseek-director-v1` id to `qwen-director-v1`, so hidden routing ids, profile ids, and callsite contracts now match the actual Qwen-led director matrix. Media generation still uses Ark primary plus DashScope `qwen-image-2.0` fallback. Global `pnpm typecheck` still reports unrelated pre-existing errors outside the `T-201` write set.
- Next step: Run staging validation and the live-data canonicalization cutover (`voice-line:canonicalize-doubao` dry-run/apply + search reconcile) in an environment with persistence enabled, then decide whether any unrelated repo-wide typecheck cleanup should be absorbed into a separate task.

## Goal
Refresh the repository LLM and media generation matrix so active routing, hidden director/vision lanes, and image generation fallback align with the new provider/model strategy without breaking registry/runtime contracts.

## Non-goals
- Do not add `qwen-deep-research`, `M2-her`, or `seed-character`.
- Do not open unrestricted raw provider request passthrough.
- Do not perform broad staging rollout during this planning slice.
- Do not rewrite historical usage/audit/ledger facts during the Doubao/Kimi canonicalization.

## Context
The current repository already has a unified registry-driven LLM gateway and a single-provider Ark media generation gateway. The new target matrix keeps the same providers/secrets footprint in staging where possible, but changes most model IDs and requires one media-generation architecture change: Ark `Seedream 5.0 Lite` remains primary while DashScope `qwen-image-2.0` becomes a fallback generation provider. The current runtime only supports OpenAI-compatible chat completions and does not yet support typed provider extensions such as Kimi-specific thinking controls.

## Acceptance criteria (high level)
- [x] The roadmap defines the exact migration phases for registry, hidden director/vision, media fallback, and typed provider extensions.
- [x] The bundle clearly distinguishes registry-only work from runtime changes.
- [x] The target matrix and key architectural decisions are documented well enough to begin implementation without re-discovery.
- [x] Verification and rollback expectations are concrete for each implementation phase.
- [x] `doubao-deep-v1` is the canonical Doubao visible line across registry/runtime/control-plane artifacts.
- [x] `kimi-deep-v1` is restored to real Kimi semantics and no longer carries Doubao routing.
