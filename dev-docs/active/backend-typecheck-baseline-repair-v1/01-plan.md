# 01 Plan

## Phases
1. Phase A: capture the current `pnpm typecheck` diagnostics and group them by root cause.
2. Phase B: fix shared contract/type issues that unblock multiple call sites.
3. Phase C: fix remaining local tests and runtime strictness issues.
4. Phase D: rerun `pnpm typecheck` and any targeted verification until clean.

## Detailed steps
- Reproduce the failing command with `pnpm typecheck`.
- Group diagnostics into:
  - legacy `comment` fields in tests and moderation types
  - `RouteHandoff` JSON serialization typing
  - `data-plane` request value narrowing
  - runtime / relation-service strictness mismatches
- Patch shared types and helper boundaries before local call sites.
- Rerun `pnpm typecheck` after each group to confirm the error count drops.
- Add targeted tests only if runtime-facing fixes need extra regression protection.

## Risks & mitigations
- Risk:
  - Fixing tests against the wrong contract can silently restore legacy semantics.
  - Mitigation:
    - Always align with the existing thread/turn type definitions before touching fixtures.
- Risk:
  - Using unsafe casts to force JSON compatibility can mask real shape errors.
  - Mitigation:
    - Keep casts narrow and only where Prisma JSON typing requires a serializable bridge.
- Risk:
  - Relation-service fixes may accidentally change runtime behavior.
  - Mitigation:
    - Prefer dependency typing fixes and explicit guards over logic changes.
