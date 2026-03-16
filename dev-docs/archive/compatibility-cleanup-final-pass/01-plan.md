# 01 Plan — compatibility-cleanup-final-pass

## Phase 0
- Create `T-111` task bundle and sync project governance.
- Keep `T-109` and archived `T-110` as historical references only; do not extend them.

## Phase 1
- Finalize identity contracts:
  - remove legacy identity sources and legacy persona/style resolution
  - update read payloads, frontend API types, and tests to canonical-only identity sources

## Phase 2
- Finalize stage/aftershow/strict-T4 contracts:
  - remove StageSpec legacy threshold aliases
  - rename aftershow storage/domain fields to canonical threshold names
  - remove strict-T4 legacy trust fallback and dead route gates
  - apply Prisma schema/migration updates and repo/type fixes

## Phase 3
- Finalize chatroom/public-scene contracts:
  - remove `director_goal_compat`
  - make `chatroomLocalIntentV1` behavior unconditional
  - remove legacy chatroom scene presets and `legacy_fallback` scene source
  - delete obsolete scene payload fields such as `fallback_reason`

## Phase 4
- Remove context-memory migration compatibility:
  - delete typed-context backfill and legacy retrieval fallbacks
  - rename `compatibilityDigest` to `memoryDigest`
  - remove migration-only observability metrics and gates
  - clean related tests/scripts

## Phase 5
- Remove newly-dead env/config flags, regenerate env artifacts, and run final verification.
- Update implementation notes and verification logs throughout.
- Archive the task bundle and sync project governance once the repo is green.

## Risks & mitigations
- Risk: schema renames can break repo/domain/Prisma alignment.
  - Mitigation: do schema-bearing cleanup first, regenerate Prisma client, and run PG/repository tests before broader suites.
- Risk: deleting historical read compatibility can silently break tests and seed fixtures.
  - Mitigation: update fixtures in the same wave and run targeted suites before full repo gates.
- Risk: current worktree already contains uncommitted compatibility-cleanup changes.
  - Mitigation: only build on existing touched files, avoid reverting unrelated edits, and verify with `git diff --check`.
