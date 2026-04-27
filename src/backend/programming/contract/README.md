# Programming Contract

Shared, type-only contract module for programming-layer concepts spanning forum cue (T-209+) and chatroom `RoomProgram*` runtimes.

Bundle: `T-208 cue-shared-contract` (under umbrella `T-207 admin-auto-programming`).

## What this module is

Four shared exports plus runtime validators:

| Export | Kind | Owner |
|---|---|---|
| `DispatchPolicy` + `DispatchPolicySchema` | type + Zod | T-208 |
| `AdmissionResult` + `AdmissionResultSchema` | type + Zod | T-208 |
| `IdempotencyKey` (branded) + builder/parser + `IdempotencyKeyStringSchema` | type + helpers + Zod | T-208 |
| `SelectionLedger` + `SelectionLedgerSchema` (+ `parseLegacyReasonString` helper) | type + Zod + helper | T-208 |

This module is **type-only by design**. It deliberately avoids importing from Prisma, allocator, or any runtime service. Adopters depend on it; it depends on nothing inside the repo.

## Consumers

- **Forum cue path** (T-209 onward): cue tables and validators consume `DispatchPolicySchema`, `AdmissionResultSchema`, `SelectionLedgerSchema`; cue worker uses `buildIdempotencyKey('cue', ...)` and emits `cue-execution-completed` / `-failed` / `-cancelled` keys.
- **Existing `RoomProgramEvent` runtime** (chatroom): adoption is **opportunistic**; tests may import these types for parity, but the runtime code path is not required to migrate. The namespaces `room-program-event` and `manual-cue` are reserved here so future migration is mechanical.
- **Existing `role-assignment-service`**: namespace `role-expired` is reserved for parity; no immediate migration required.

## Idempotency-key namespace allocation

`IDEMPOTENCY_KEY_NAMESPACES` in [`idempotency-key.ts`](./idempotency-key.ts) is the **single source of truth**.

Format: `<namespace>:<segment1>:<segment2>...` with at least one segment; each segment matches `[A-Za-z0-9._-]+`.

Currently registered:

| Namespace | Purpose |
|---|---|
| `cue` | cue execution attempts (`cue:<schedule_id>:<cue_id>:<attempt_no>`) |
| `cue-change` | cue change records |
| `cue-execution-completed` | downstream domain event on cue success |
| `cue-execution-failed` | downstream domain event on cue failure |
| `cue-execution-cancelled` | downstream domain event on admin-initiated cancel |
| `room-program-event` | parity with existing `RoomProgramEvent.idempotencyKey` |
| `manual-cue` | parity with existing `chatroom-control-service` |
| `role-expired` | parity with existing `role-assignment-service` |

To add a new namespace:

1. Re-open T-208 (frozen field per `dev-docs/active/cue-shared-contract/00-overview.md` §4).
2. Add the literal to `IDEMPOTENCY_KEY_NAMESPACES`.
3. Add a row to the table above.
4. Add a unit test covering the new namespace round-trip.
5. Re-run the project sync.

Adding a namespace **outside this registry** at a call site is a contract violation and will fail validation.

## Why "type-only"

Forcing immediate runtime adoption on `RoomProgramEvent` would expand T-208 into an integration task. The umbrella decision (D-8) is that forum and room data tables stay forked in MVP; only the **contract types** unify. Future Forum/Room programming unification can adopt the runtime calls without re-doing this layer.

## Frozen fields

The following do not change without re-opening T-208:

- The four type signatures (`DispatchPolicy`, `AdmissionResult`, `IdempotencyKey`, `SelectionLedger`)
- The four schema export names (`DispatchPolicySchema`, `AdmissionResultSchema`, `IdempotencyKeyStringSchema`, `SelectionLedgerSchema`)
- The directory path `src/backend/programming/contract/`
- The `IDEMPOTENCY_KEY_NAMESPACES` array

## Tests

Co-located under `__tests__/`. Run via:

```bash
pnpm vitest run src/backend/programming/contract
```

Each schema has accept + shape-reject + refine-reject coverage. The idempotency-key tests cover build/parse round-trip, registry rejection, and segment-format rejection.
