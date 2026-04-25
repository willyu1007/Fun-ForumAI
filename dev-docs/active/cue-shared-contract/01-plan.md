# 01 Plan — T-208 cue-shared-contract

## Phases

### P1. Module skeleton (~0.5d)
- Create `src/backend/programming/contract/` directory
- Add files (empty stubs): `dispatch-policy.ts`, `admission-result.ts`, `idempotency-key.ts`, `selection-ledger.ts`, `index.ts`, `README.md`, `__tests__/`
- Add `index.ts` barrel re-exports skeleton
- Verify directory layout matches allocator pattern

### P2. Type + Zod implementation (~1d)
- `dispatch-policy.ts`: `DispatchMode / Lane / MisfirePolicy / DispatchPolicy` types and `DispatchPolicySchema`
- `admission-result.ts`: `AdmissionDecision / AdmissionResult` types and `AdmissionResultSchema` with cross-field refine (granted ↔ decision consistency)
- `idempotency-key.ts`: namespace registry constant `IDEMPOTENCY_KEY_NAMESPACES`, branded `IdempotencyKey` type, `buildIdempotencyKey`, `parseIdempotencyKey`, `isIdempotencyKey`, `IdempotencyKeyStringSchema`
- `selection-ledger.ts`: `SelectionReason / SelectionLedger` types, `SelectionLedgerSchema`, helper `parseLegacyReasonString`

### P3. Tests (~0.5d)
Per validator: ≥1 accept case, ≥2 reject cases (covering format errors and refine errors).
- `__tests__/dispatch-policy.test.ts`
- `__tests__/admission-result.test.ts`
- `__tests__/idempotency-key.test.ts` (build/parse round-trip + namespace-not-registered rejection + malformed string rejection)
- `__tests__/selection-ledger.test.ts` (incl. `parseLegacyReasonString` round-trip)

### P4. README (~0.3d)
Sections:
- What this module is (shared programming contract)
- Four exports and their consumers
- IdempotencyKey namespace allocation rules and how to register a new namespace
- "Type-only" stance: no runtime adoption forced on existing code
- Frozen-field invariant: changes require re-opening T-208

### P5. Verification (~0.2d)
- `pnpm typecheck` clean
- `pnpm vitest run src/backend/programming/contract` green
- `git diff --stat` confirms only the new module is touched (no `RoomProgram*` modifications)
- `git diff package.json` empty
- Update `00-overview.md` status → `done` candidate; record verification evidence in `04-verification.md`; close out via project sync

## Risks (carried from 00-overview)
- **Type design too forum-biased** — mitigated by walking through `RoomProgramEvent` and `RoomSelectionLedger` shapes during P2 to ensure compatibility paths exist (legacy reason-string parser).
- **Over-engineering** — strictly type-only; no runtime adoption forced; no new dependency.

## Out-of-scope (explicit)
- No `RoomProgram*` runtime edits (verified at P5).
- No new `package.json` deps (verified at P5).
- No `01-plan.md` for downstream sub-bundles.
