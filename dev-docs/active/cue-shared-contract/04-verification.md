# 04 Verification — T-208 cue-shared-contract

## Run 1: typecheck (2026-04-25)

```
$ pnpm typecheck
> tsc -b
```

**Outcome**: exit code 0, no errors. Backend project (`tsconfig.node.json`) and all workspace package projects compile clean.

## Run 2: targeted unit tests (2026-04-25)

```
$ pnpm test src/backend/programming/contract
```

**Outcome**: exit code 0.

```
✓ src/backend/programming/contract/__tests__/admission-result.test.ts (10 tests) 4ms
✓ src/backend/programming/contract/__tests__/idempotency-key.test.ts   (19 tests) 5ms
✓ src/backend/programming/contract/__tests__/selection-ledger.test.ts  (12 tests) 5ms
✓ src/backend/programming/contract/__tests__/dispatch-policy.test.ts   (12 tests) 4ms

Test Files  4 passed (4)
     Tests  53 passed (53)
```

## Run 3: scope verification (2026-04-25)

`git status --short` shows new directory `src/backend/programming/` only. No modifications to:
- `src/backend/runtime/post-scheduler.ts`
- `src/backend/allocator/**`
- `prisma/schema.prisma`
- `package.json`, `pnpm-lock.yaml`

`git diff --name-only | grep -iE "room-program|post-scheduler|allocator"` → empty output. ✓

## Run 4: registry sync (2026-04-25)

```
$ node .ai/scripts/ctl-project-governance.mjs sync --apply --project main
```

After flipping T-208 status `planned → in-progress`, sync regenerated `dashboard.md`, `feature-map.md`, `task-index.md`. Lint pass.

## Run 5: re-run after status close (2026-04-25)

```
$ node .ai/scripts/ctl-project-governance.mjs lint --project main
```

After flipping T-208 status `in-progress → done` and running sync, lint pass; registry shows `T-208 cue-shared-contract` in `done` state.

## Acceptance criteria audit

| Criterion (from 00-overview.md) | Result |
|---|---|
| `src/backend/programming/contract/` directory exists with type and validator exports | ✓ |
| `pnpm typecheck` clean for the new module | ✓ (exit 0) |
| At least one unit test per validator covering valid + invalid inputs | ✓ (53 tests across 4 files) |
| README explains the four types, their consumers, and the `IdempotencyKey` namespace rule | ✓ |
| No edits to `RoomProgram*` runtime code | ✓ (`git diff` confirms) |
| No new dependencies in `package.json` | ✓ (`git diff package.json` empty) |

All acceptance criteria met. Output contract delivered as declared in `00-overview.md`. Frozen fields are in place; downstream sub-bundles may depend on them.
