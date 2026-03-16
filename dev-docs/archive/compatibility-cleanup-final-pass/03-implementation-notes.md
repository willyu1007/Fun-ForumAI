# 03 Implementation Notes — compatibility-cleanup-final-pass

## Status
- Current status: `done`
- Last updated: 2026-03-16

## What changed
- Finalized identity contracts on canonical `personaSeed + voice + ownerStylePins` and removed legacy contract sources from backend/frontend surfaces and tests.
- Removed stage/aftershow compatibility reads and rollout gating: `stage_spec_v1` is the only accepted write contract, aftershow thresholds use canonical names, strict-T4 uses the canonical trust path, and top-level stage-spec merges are gone.
- Removed chatroom/public-scene legacy payloads and synthesized scene fallbacks: manual cues now require prepared room programs plus canonical scene resolution, chatroom intents/events no longer read `director_goal_compat`, and public scene payloads keep only canonical metadata.
- Removed context-memory migration/backfill compatibility, renamed `compatibilityDigest` to `memoryDigest`, and deleted migration-only persona observability fields/gates.
- Removed dead feature/env flags and regenerated env artifacts; cleaned residual live prompt-template naming by renaming `compatibility_digest` to `memory_digest`.

## Files/modules touched (high level)
- `src/backend/identity/**`, `src/frontend/api/types.ts`
- `src/backend/stage/**`, `src/backend/services/community-config-*`, `src/backend/services/aftershow-service.ts`, `src/backend/services/forum-write-service/**`
- `src/backend/services/chatroom-*`, `src/backend/services/public-scene-*`, `src/backend/runtime/post-scheduler.ts`
- `src/backend/context-memory/**`, `src/backend/services/memory-service/**`, `src/backend/runtime/persona-*`
- `src/backend/lib/config.ts`, `env/contract.yaml`, generated env docs/artifacts
- `prisma/schema.prisma`, final cleanup migrations, DB context artifacts
- Live tests/scripts covering prompt rendering, control plane, achievements, public observation, prompt engine, and cleanup smoke paths

## Decisions & tradeoffs
- Decision: create a new task bundle instead of extending `T-109` or re-opening archived `T-110`.
  - Rationale: this wave includes schema changes and broader repo-wide compatibility removal that materially exceeds the earlier scopes.
  - Alternatives considered: reuse `T-109`; rejected because it already drifted from valid closeout state and does not cover schema-breaking cleanup.
- Decision: cut remaining read compatibility instead of preserving migration windows.
  - Rationale: the project is not live, so carrying historical payload readers would only preserve obsolete contracts and keep test/ops surfaces ambiguous.
- Decision: leave `.ai/` tooling/skill compatibility internals and DB historical table names out of this task’s deletion scope.
  - Rationale: they are not product runtime compatibility paths, and removing them would expand the task into tooling/database-history cleanup rather than app-contract cleanup.

## Deviations from plan
- One additional cleanup pass was needed after the main repo gates: live prompt templates still exposed `compatibility_digest`, and `community-config-normalization.ts` still merged top-level stage-spec keys on read. Both were removed and re-verified.

## Known issues / follow-ups
- No blocking product compatibility debt remains in `src/`, `scripts/`, `env/`, `ops/`, or generated env artifacts.
- Residual `legacy_*` / `compatibility_*` strings still present under `.ai/` tooling/skills and `docs/context/db/schema.json` are not live product/runtime compatibility layers.

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
