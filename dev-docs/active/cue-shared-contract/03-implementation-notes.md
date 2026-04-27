# 03 Implementation Notes — T-208 cue-shared-contract

## P1+P2: Module skeleton and types (2026-04-25)

Created `src/backend/programming/contract/` with the layout from `02-architecture.md`:

| File | Lines | Purpose |
|---|---|---|
| `dispatch-policy.ts` | ~60 | `DispatchMode / Lane / MisfirePolicy / DispatchPolicy` + `DispatchPolicySchema` (with `not_before_at` ≤ `trigger_at` and `deadline_at` > `trigger_at` refines) |
| `admission-result.ts` | ~45 | `AdmissionDecision / AdmissionResult` + `AdmissionResultSchema` (with `granted` ⇔ `decision === 'admit'` refine) |
| `idempotency-key.ts` | ~75 | `IDEMPOTENCY_KEY_NAMESPACES` registry, branded `IdempotencyKey`, `buildIdempotencyKey`, `parseIdempotencyKey`, `isIdempotencyKey`, `IdempotencyKeyStringSchema` |
| `selection-ledger.ts` | ~50 | `SelectionReason / SelectionLedger` + `SelectionLedgerSchema` + `parseLegacyReasonString` (bridge for allocator's free-form `key=value` reasons) |
| `index.ts` | ~30 | Barrel re-exports — the public surface |
| `README.md` | ~75 | Contract doc: consumers, namespace allocation rules, frozen-fields invariant |

Key implementation decisions (recorded for future reference):
- **Hand-written interfaces alongside `<Type>Schema`** rather than `z.infer<typeof Schema>` exports. Reason: better IDE-hover documentation, and the schema-vs-interface drift is caught by the round-trip tests.
- **Branded `IdempotencyKey` instead of a wide template-literal union**. Heterogeneous namespaces (some 1-segment, some 3-segment) made template literals unwieldy. Builder/parser pair plus a Zod string validator gives compile-time and runtime safety together.
- **`.strict()` on every `z.object`**. Matches the existing convention in `src/backend/llm/secret-resolver.ts:14`. Defensive against unknown-field drift; downstream may relax via a follow-on if needed.
- **`SelectionLedger.score: z.number().finite()`** (rejects `Infinity` / `NaN`) — defensive for serialization round-trips.

## P3: Tests (2026-04-25)

Created `src/backend/programming/contract/__tests__/` with one file per module:

| File | Tests | Coverage |
|---|---|---|
| `dispatch-policy.test.ts` | 12 | accept; strict-key reject; enum reject; bound checks; refine checks for `not_before_at`/`deadline_at`; boundary case `not_before_at == trigger_at`; ISO format reject |
| `admission-result.test.ts` | 10 | accept (granted=true/admit); accept (granted=false/{defer,skip,merge,require_review}); refine reject (granted=true non-admit); strict-key reject; enum reject; ISO format reject |
| `idempotency-key.test.ts` | 19 | build round-trip; number coercion; reject empty/zero segments; reject disallowed chars; parse rejects unregistered namespace; parse rejects malformed; predicate matches built keys; schema accepts/rejects; registry coverage assertion (cue-path + parity namespaces) |
| `selection-ledger.test.ts` | 12 | accept fully populated; accept empty reasons; reject empty `candidate_id`; reject non-finite score; reject extra keys (ledger and reason); reject empty `code`; `parseLegacyReasonString` covers `key=value`, bare code, value containing `=`, hyphenated codes, empty-string error |

Total: **53 tests across 4 files**.

## Test framework alignment

- Imports: `import { describe, it, expect } from 'vitest'`
- Test path style: `'../<module>.js'` (NodeNext requires `.js` extension on relative imports)
- No external setup / fixtures / mocks — contract module is pure types + functions

## Files NOT touched (verified)

- No edits to `src/backend/runtime/post-scheduler.ts` (invariant carried from umbrella)
- No edits to `prisma/schema.prisma` `RoomProgram*` models
- No edits to `src/backend/allocator/` (legacy reason-string bridge sits in `selection-ledger.ts` and is type-only)
- No edits to `package.json` / `pnpm-lock.yaml`
- No edits to `.ai/llm-config/` or any other concern outside the new directory

## Open follow-ups (none blocking)

- Future task may register the runtime adoption: `RoomProgramEvent.idempotencyKey` could call `buildIdempotencyKey('room-program-event', eventId)` for parity. Out of T-208 scope.
- Future task may migrate allocator `ScoredCandidate.reasons: string[]` to `SelectionReason[]` via `parseLegacyReasonString`. Out of T-208 scope.
- README is the first README under `src/backend/`. If a project-wide convention emerges, this README can be updated.
