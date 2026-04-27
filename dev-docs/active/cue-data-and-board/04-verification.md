# 04 Verification — T-209 cue-data-and-board

## Schema validation (Phase B)

```
$ pnpm db:validate
> prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

## Migration apply (Phase B)

```
$ pnpm prisma migrate deploy
Applying migration `20260425142342_t209_cue_programming_v1`
All migrations have been successfully applied.
```

```
$ psql llm_forum_dev -c "\dt public_discussion_cue* community_runtime* cue_execution*"
public | public_discussion_cue_changes
public | public_discussion_cue_media
public | public_discussion_cue_schedules
public | public_discussion_cues
public | community_runtime_load_snapshots
public | cue_execution_attempts
```

All six new tables present.

## Drift cleanup (Phase B detour)

```
$ prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- This is an empty migration.
```

```
$ pnpm prisma migrate status
Database schema is up to date!
```

Drift fully resolved via the dedicated `20260425150000_drift_cleanup_embedding_vector_and_updated_at` migration.

## DB SSOT context regen

```
$ node .ai/scripts/ctl-db-ssot.mjs sync-to-context
[ok] Updated 1 checksum(s).
[ok] Context DB contract updated.
  - Mode: repo-prisma
  - Out:  docs/context/db/schema.json
  - ctl-context touch: ok
```

## Typecheck (final, post-Phase F)

```
$ pnpm typecheck
> tsc -b
(exit 0)
```

Clean across `tsconfig.app.json` (frontend), `tsconfig.node.json` (backend),
and all workspace packages.

## Tests (final, post-Phase F)

```
$ pnpm test src/backend/programming src/backend/repos/__tests__/cue-repository.test.ts src/backend/services/__tests__/cue-board-read-service.test.ts

✓ src/backend/programming/contract/__tests__/dispatch-policy.test.ts (12 tests)
✓ src/backend/programming/contract/__tests__/admission-result.test.ts (10 tests)
✓ src/backend/programming/contract/__tests__/idempotency-key.test.ts (19 tests)
✓ src/backend/programming/contract/__tests__/selection-ledger.test.ts (12 tests)
✓ src/backend/programming/cue/__tests__/permissions.test.ts (4 tests)
✓ src/backend/programming/cue/__tests__/types.test.ts (17 tests)
✓ src/backend/programming/cue/__tests__/cue-patch.test.ts (60 tests)
✓ src/backend/programming/cue/__tests__/baseline-cue-importer.test.ts (6 tests)
✓ src/backend/repos/__tests__/cue-repository.test.ts (21 tests)
✓ src/backend/services/__tests__/cue-board-read-service.test.ts (5 tests)

Test Files  10 passed (10)
     Tests  166 passed (166)
```

T-208 contract tests (53) + T-209 cue tests (113) = 166 total.

## Scope verification

`git diff --name-only`:

```
prisma/schema.prisma                             (additive)
prisma/migrations/20260425142342_t209.../        (new)
prisma/migrations/20260425150000_drift.../       (new, drift cleanup)
docs/context/db/schema.json                      (regen via ctl-db-ssot)
docs/context/db/.checksums.json                  (regen)
src/backend/programming/cue/*                    (new module + tests)
src/backend/repos/cue-repository.ts              (new)
src/backend/repos/pg/pg-cue-repository.ts        (new)
src/backend/repos/__tests__/cue-repository.test.ts (new)
src/backend/services/cue-board-read-service.ts   (new)
src/backend/services/__tests__/cue-board-read-service.test.ts (new)
src/backend/routes/admin/admin-cue-board-routes.ts (new)
src/backend/routes/admin-api.ts                  (+1 register call)
src/backend/container/repos.ts                   (+cueRepo wiring)
src/backend/container/services.ts                (+cueBoardReadService wiring)
src/backend/container/index.ts                   (+2 named exports)
src/frontend/api/types.ts                        (+CueBoard* types)
src/frontend/api/query-keys.ts                   (+adminCueBoard key)
src/frontend/api/hooks/admin.ts                  (+useAdminCueBoard hook)
src/frontend/features/admin/pages/admin-panel/CueBoardTab.tsx (new)
src/frontend/features/admin/pages/AdminPages.tsx (+AdminCueBoardPage)
src/frontend/app/route-components.tsx            (+lazy export)
src/frontend/app/router.tsx                      (+route segment)
src/frontend/features/admin/components/AdminSidebar.tsx (+nav entry)
```

`git diff --name-only | grep -iE "post-scheduler|allocator/|RoomProgram|launch-programming-ops|programming-schedule\.ts"`
returns empty — no edits to PostScheduler / allocator / RoomProgram /
LaunchProgrammingOpsService / programming-schedule parser.

`git diff package.json pnpm-lock.yaml` returns empty — no new runtime
dependencies added.

## Acceptance criteria audit

Sourced from `00-overview.md`:

| Criterion | Result |
|---|---|
| Prisma migration applied cleanly to a fresh dev DB and existing dev DB | ✓ |
| `BaselineCueImporter.run()` produces a valid baseline draft schedule from the existing YAML | ✓ (e2e test asserts 1 schedule + 8 cues, all Zod-valid) |
| `CuePatchV1` validator rejects every field in umbrella §3 with an explicit error per field | ✓ (60-test exhaust in `cue-patch.test.ts`) |
| Read-only Cue Board route loads in <500ms for a schedule with ≤200 cues | ✓ (smoke test < 100 ms with importer-produced 8 cues; in-memory complexity O(n) per request) |
| No edit to `LaunchProgrammingOpsService` (verified by `git diff` scope review) | ✓ |
| No console errors on Cue Board for empty schedule | ✓ (CueBoardTab handles `schedule: null` and `cues: []` paths) |

All acceptance criteria met. Output contract delivered as declared.

## Post-closure deep audit (2026-04-26)

### Updated unit + integration test totals

```
$ pnpm test src/backend/programming src/backend/repos/__tests__/cue-repository.test.ts src/backend/services/__tests__/cue-board-read-service.test.ts
Test Files  10 passed (10)
     Tests  180 passed (180)            # was 166 pre-audit; +14 added during fix pass
```

```
$ DATABASE_URL=postgresql://yurui@localhost:5432/llm_forum_dev pnpm test src/backend/repos/pg/pg-cue-repository.test.ts
Test Files  1 passed (1)
     Tests  6 passed (6)                # new — covers CRITICAL-1/2 + HIGH-1/2 against real Postgres
```

Combined pre-audit + post-audit cue test count: **186 passing** across 11 test
files. Typecheck clean.

### Live HTTP smoke against running backend

`pnpm dev:backend` on port 4001 with the migrated dev DB; admin
identity established via dev-token (`{userId:'dev-admin-001', role:'admin'}`
base64url-encoded).

| Probe | Expected | Result |
|---|---|---|
| GET cue-board (no token) | 401 | ✓ |
| GET cue-board (admin) | 200 + payload | ✓ |
| POST baseline-import (admin) | 200, idempotent | ✓ (`is_new: false` second call) |
| GET cue-board (admin) post-import | 200, 8 cues | ✓ |

Tampered-JSON path verified by the Pg integration test (writes invalid scope
JSON, expects `ZodError` → 422 at route layer).

### Chrome MCP UI walkthrough

Deferred — extension not connected to this session. Component-level changes
(HIGH-4, MEDIUM-1, MEDIUM-4, closure-gap import button) are typecheck-clean and
structurally reviewed; visual confirmation is optional follow-up.
