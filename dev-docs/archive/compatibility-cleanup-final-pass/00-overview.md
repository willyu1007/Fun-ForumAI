# 00 Overview — compatibility-cleanup-final-pass (T-111)

## Status
- State: done
- Next step: none; the final compatibility cleanup wave is implemented and verified.

## Goal
- Delete the remaining transition-era compatibility code, rollout-gated legacy behavior, and outdated schemas so the repo runs on a single canonical contract.

## Non-goals
- Do not remove infrastructure-level fallback behavior such as Redis/in-memory fallback or provider retry paths.
- Do not remove `AgentMemory` as an owner-facing product surface.
- Do not rewrite historical `dev-docs/archive/**` bundles.

## Context
- `T-109` removed dead compatibility shims and canonicalized writes, but intentionally preserved historical read compatibility and rollout-gated legacy behavior.
- `T-110` removed the runtime fallback branches and dead runtime feature flags, but left repo-wide historical read compatibility, migration metrics, legacy payload readers, and rollout-gated old behavior in place.
- The project is not yet live, so we can cut old read paths instead of carrying migration windows or observation-only protections.

## Acceptance criteria (high level)
- [x] Identity contracts only expose `contract_v1`; no runtime or API surface emits legacy identity sources.
- [x] StageSpec, aftershow, and strict-T4 flows only accept and persist canonical threshold/trust contracts.
- [x] Chatroom/public-scene flows no longer read legacy payload fields or synthesize legacy scene contracts.
- [x] Context-memory retrieval no longer backfills or falls back to legacy memories for typed-context gaps, while `AgentMemory` APIs remain intact.
- [x] Persona/rollout observability no longer tracks migration-only legacy dependency metrics.
- [x] Dead compatibility/rollout flags introduced by these deletions are removed from config, env contract, and generated env docs.
- [x] Targeted suites, schema validation, full repo gates, and governance closeout all pass.

## Outcome
- Product/runtime code now runs on the canonical contracts only: `contract_v1` identity, `stage_spec_v1`, canonical aftershow thresholds, canonical chatroom scene bindings, and `memory_digest`.
- Runtime/read compatibility layers removed in this pass include identity legacy readers, stage top-level alias merges, chatroom `director_goal_compat`, scene `legacy_fallback`, context-memory legacy backfill/fallback assembly, and migration-only persona observability metrics.
- Remaining `legacy_*` / `compatibility_*` mentions in the repo are limited to historical DB schema names under `docs/context/db/schema.json` and `.ai/` tooling/skill internals, not product runtime paths.
