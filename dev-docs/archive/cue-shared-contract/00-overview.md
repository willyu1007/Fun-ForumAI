# 00 Overview — cue-shared-contract (T-208)

## Status
- State: archived
- Parent: `T-207 admin-auto-programming` (umbrella)
- Phase: **0** of 6 in the umbrella roadmap
- Type: code (type-only)
- Estimate: 2-3 days
- Started: 2026-04-25
- Completed: 2026-04-25
- Outcome: All acceptance criteria met. 53 tests pass; typecheck clean; no `RoomProgram*` / `package.json` modifications. See `04-verification.md`.

## Acceptance criteria
- [x] `src/backend/programming/contract/` directory exists with type and validator exports.
- [x] `pnpm typecheck` clean for the new module.
- [x] At least one unit test per validator covering valid + invalid inputs.
- [x] `src/backend/programming/contract/README.md` explains the four types, their consumers, and the `IdempotencyKey` namespace rule.
- [x] No edits to `RoomProgram*` runtime code (verified by `git diff` scope at PR review).
- [x] No new dependencies in `package.json`.

## Goal
Introduce a shared **programming-contract** type package that both forum cue runtime (T-212+) and the existing `RoomProgram*` runtime can reference, without modifying RoomProgram implementation. This unifies dispatch policy, admission result, idempotency-key namespace, and selection ledger shapes so that future forum/room programming unification has a stable seam to grow on.

## Non-goals
- No runtime / DB changes to `RoomProgram`, `RoomEpisode`, `RoomEpisodeBeat`, `RoomProgramEvent`, `RoomSelectionLedger`.
- No new package distribution or workspace boundary churn.
- No Zod runtime adoption forced on Room code; Room code references types only if convenient.

## Handoff contract (umbrella requirement)

### 1. Input contract
- None. This is the bottom of the dependency chain.

### 2. Output contract
A new module (target location: `src/backend/programming/contract/`) exporting:
- `DispatchPolicy` type (mode, lane, priority, misfire policy, max attempts, retry backoff)
- `AdmissionResult` type (granted, decision, reason codes, recommended next trigger, load snapshot id, degraded media flag)
- `IdempotencyKey` template-literal type defining namespaces (`cue:*`, `room-program-event:*`, etc.)
- `SelectionLedger` row schema (candidate id, selected, score, reasons[])
- Zod validators for each (`DispatchPolicySchema`, `AdmissionResultSchema`, `SelectionLedgerSchema`)
- A Markdown-format contract doc at `src/backend/programming/contract/README.md` describing semantics

The umbrella `02-architecture.md` §4 lists the canonical shapes; this sub-bundle materializes them.

### 3. Gate condition (for downstream)
T-209 (`cue-data-and-board`) starts only after:
- The four type names above exist and are exported.
- Zod validators pass `pnpm typecheck` and unit tests.
- The contract README explains namespace allocation rules for `IdempotencyKey`.

### 4. Frozen fields
After this sub-bundle ships, the following are stable for the rest of T-207:
- All four type signatures listed in umbrella §4.4
- `IdempotencyKey` namespace prefix list (any new namespace requires re-opening this bundle)
- The directory location `src/backend/programming/contract/` (downstream imports depend on it)

### 5. Deferred questions (with target sub-bundle)
- **Room code adoption**: Does `RoomProgramEvent` runtime code import these types now? Decision: **no, type adoption is opportunistic**. RoomProgram tests may import the types for parity; runtime code stays as-is. Re-evaluation owner: a future Room/Forum unification task (not in this umbrella).
- **Cross-cutting governance hooks** (e.g., shared cue/room observability tags): defer to T-213 (`cue-load-control`) where metric track names land.

## Scope of work
Implementation phases recorded in `01-plan.md` and `03-implementation-notes.md`. Verification evidence in `04-verification.md`.

## Risks
- **Type design too forum-biased**, blocking future Room adoption. Mitigation: walk through the existing `RoomProgramEvent` table fields and confirm each new type covers the corresponding concern.
- **Over-engineering**. Mitigation: type-only; no runtime adoption; no new packages.

## Cross-references
- Umbrella: `dev-docs/active/admin-auto-programming/02-architecture.md` §4.4
- Existing RoomProgram surface: `prisma/schema.prisma` `model RoomProgram*`
- Allocator selection ledger basis: `src/backend/allocator/types.ts`
