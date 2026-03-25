# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-03-25

## What changed
- Created `T-920` to track repository-wide backend typecheck repair after CI stopped before ESLint.
- Repaired backend type drift introduced by the thread/turn contract migration instead of restoring old `comment` fields.
- Added explicit JSON bridge helpers for Prisma `InputJsonValue` writes where `RouteHandoff` objects are persisted.
- Narrowed route/runtime/relation call sites so request params and optional repos satisfy the newer type contracts without `any`-style suppression.
- Updated affected tests and fixtures to use `thread_turn`, `threadTurns`, `targetThreadTurn`, and stage repos.

## Files/modules touched (high level)
- `src/backend/moderation/__tests__/governance-service.test.ts`
- `src/backend/repos/pg/pg-public-scene-write-repository.ts`
- `src/backend/repos/pg/pg-public-stage-thread-repository.ts`
- `src/backend/routes/data-plane.ts`
- `src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts`
- `src/backend/runtime/__tests__/prompt-layer-service.test.ts`
- `src/backend/runtime/proactive-event-handler.ts`
- `src/backend/services/__tests__/forum-scene-continuity-service.test.ts`
- `src/backend/services/__tests__/owner-life-overview-service.test.ts`
- `src/backend/services/__tests__/public-scene-selector-service.test.ts`
- `src/backend/services/relation-service.ts`
- `dev-docs/active/backend-typecheck-baseline-repair-v1/*`

## Decisions & tradeoffs
- Decision:
  - Treat CI `check` failure as a backend type-contract repair task, not as a lint task.
  - Rationale:
    - GitHub Actions shows `TypeScript typecheck` fails before `ESLint` begins.
  - Alternatives considered:
    - Fix lint first. Rejected because CI never reaches that step.
- Decision:
  - Use narrow local adapters for Prisma JSON writes and thread/turn repo deps rather than weakening shared types.
  - Rationale:
    - The shared contracts are already correct; the failures were at integration boundaries.
  - Alternatives considered:
    - Widen shared types or add suppressions. Rejected because that would hide real contract drift.

## Deviations from plan
- Change:
  - Added targeted backend test execution and `pnpm lint` after `pnpm typecheck` went green.
  - Why:
    - The original plan only guaranteed compile repair, but these changes touched runtime-facing services and tests.
  - Impact:
    - Higher confidence that the CI `check` job will proceed beyond typecheck and ESLint.

## Known issues / follow-ups
- No remaining local `tsc` errors after the repair batch.
- CI should be re-observed on the next pushed commit to confirm the hosted runner matches local results.

## Pitfalls / dead ends (do not repeat)
- Keep the detailed log in `05-pitfalls.md` (append-only).
