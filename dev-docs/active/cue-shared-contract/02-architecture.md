# 02 Architecture — T-208 cue-shared-contract

## Module location and layout

```
src/backend/programming/contract/
├── README.md
├── index.ts                         # barrel
├── dispatch-policy.ts
├── admission-result.ts
├── idempotency-key.ts
├── selection-ledger.ts
└── __tests__/
    ├── dispatch-policy.test.ts
    ├── admission-result.test.ts
    ├── idempotency-key.test.ts
    └── selection-ledger.test.ts
```

Layout follows the [`src/backend/allocator/`](../../../src/backend/allocator/) convention (per-concern files, co-located `__tests__`, barrel `index.ts`).

## Type design

### DispatchPolicy

Sources: design doc §6.5; umbrella §4.4.

```ts
export type DispatchMode = 'strict' | 'graceful' | 'opportunistic'
export type Lane = 'prime' | 'standard' | 'background'
export type MisfirePolicy = 'skip' | 'delay' | 'coalesce' | 'degrade'

export interface DispatchPolicy {
  trigger_at: string             // ISO 8601 datetime
  timezone: string               // IANA tz string, e.g. 'Asia/Shanghai'
  dispatch_mode: DispatchMode
  not_before_at?: string
  deadline_at?: string
  grace_seconds: number          // >= 0
  priority: number               // 0..100
  lane: Lane
  misfire_policy: MisfirePolicy
  max_attempts: number           // >= 1
  retry_backoff_seconds: number  // >= 0
}
```

Cross-field invariants enforced by Zod refine:
- if `not_before_at` set: `not_before_at <= trigger_at`
- if `deadline_at` set: `deadline_at > trigger_at`
- `priority` clamped to `[0, 100]`
- `max_attempts >= 1`

### AdmissionResult

Sources: design doc §9.5; umbrella §4.4.

```ts
export type AdmissionDecision = 'admit' | 'defer' | 'skip' | 'merge' | 'require_review'

export interface AdmissionResult {
  granted: boolean
  decision: AdmissionDecision
  reason_codes: string[]
  recommended_next_trigger_at?: string  // ISO datetime
  load_snapshot_id?: string
  degraded_media?: boolean
}
```

Cross-field invariant: `granted === true` ⇔ `decision === 'admit'` (Zod refine).

### IdempotencyKey

Sources: design doc §6.7 / §17.1 + observed real-code patterns (`manual-cue:...`, `role-expired:...`).

The namespace registry is the **single source of truth**:

```ts
export const IDEMPOTENCY_KEY_NAMESPACES = [
  'cue',
  'cue-change',
  'cue-execution-completed',
  'cue-execution-failed',
  'cue-execution-cancelled',
  'room-program-event',
  'manual-cue',
  'role-expired',
] as const

export type IdempotencyKeyNamespace = typeof IDEMPOTENCY_KEY_NAMESPACES[number]
```

Branded string + builder/parser pair (instead of a wide template-literal union, which becomes unwieldy across heterogeneous namespaces):

```ts
export type IdempotencyKey = string & { readonly __idempotencyKeyBrand: unique symbol }

export function buildIdempotencyKey(
  namespace: IdempotencyKeyNamespace,
  ...segments: ReadonlyArray<string | number>
): IdempotencyKey

export function parseIdempotencyKey(
  raw: string,
): { namespace: IdempotencyKeyNamespace; segments: string[] } | null

export function isIdempotencyKey(raw: string): raw is IdempotencyKey

export const IdempotencyKeyStringSchema: ZodSchema<IdempotencyKey>
```

Rules:
- Format: `<namespace>:<segment1>:<segment2>...` (≥1 segment)
- Namespace must appear in `IDEMPOTENCY_KEY_NAMESPACES`
- Segments are `[A-Za-z0-9._-]+`; numbers are coerced to string
- Empty segments rejected
- Adding a new namespace requires re-opening T-208 (frozen field per `00-overview.md`)

Compatibility with existing code:
- `manual-cue` namespace is registered to match the existing `chatroom-control-service.ts:328` pattern
- `role-expired` is registered to match `role-assignment-service.ts`
- Existing call sites do not need to migrate; they may opt-in by importing `buildIdempotencyKey` later

### SelectionLedger

Sources: design doc §11.3; existing `RoomSelectionLedger.reasons_json` (`{code, value, message}` shape from `repos/types/chat.ts:168`); allocator `ScoredCandidate.reasons: string[]` (legacy `key=value` form).

Canonical (richer) shape:

```ts
export interface SelectionReason {
  code: string                 // e.g., 'tag_overlap', 'director_role', 'ppr_score'
  value?: string               // stringified value
  message?: string             // human-readable
}

export interface SelectionLedger {
  candidate_id: string
  selected: boolean
  score: number
  reasons: SelectionReason[]
}
```

Legacy bridge:

```ts
export function parseLegacyReasonString(raw: string): SelectionReason
// 'tag_overlap=0.84' → { code: 'tag_overlap', value: '0.84' }
// 'director_role=core' → { code: 'director_role', value: 'core' }
// 'no_match' → { code: 'no_match' }
```

This lets future migrations convert `ScoredCandidate.reasons: string[]` → `SelectionReason[]` without forcing the allocator to change today (no runtime adoption forced — invariant from `00-overview.md`).

## Validation strategy

- All four exports ship with a Zod schema named `<Type>Schema`
- Each schema's `z.infer<typeof Schema>` is **structurally identical** to the hand-written interface (verified by a `satisfies` assertion in the module file)
- `.strict()` is used on object schemas to reject unknown keys (defensive; downstream may relax)

## Boundaries (anti-scope-creep)

- No DB / Prisma imports here
- No reference to `PublicDiscussionCue*` tables (T-209 introduces those)
- No reference to `EpisodeOverlayV1` or director runtime (T-212 territory)
- No business logic — only types, validators, and the namespace registry
- No edits to allocator, RoomProgram, or PostScheduler files

## Test strategy

Each `__tests__/*.test.ts` covers:
1. **Accept** — at least one fully-valid input round-trips through the schema; `parse` returns the expected typed object.
2. **Reject by shape** — missing required field, wrong primitive type, unknown enum value.
3. **Reject by refine** — for `DispatchPolicy` (deadline before trigger), `AdmissionResult` (granted/decision mismatch), `IdempotencyKey` (unregistered namespace, empty segment, wrong format).

Tests use only `vitest` primitives and the module under test — no other backend imports — to keep this contract module fully isolated.

## Frozen fields (re-stated from 00-overview)

These cannot change without re-opening T-208:
- The four type signatures above
- The `IDEMPOTENCY_KEY_NAMESPACES` array
- The directory path `src/backend/programming/contract/`
- The names `DispatchPolicySchema`, `AdmissionResultSchema`, `IdempotencyKeyStringSchema`, `SelectionLedgerSchema`

## Out of scope

- Runtime adoption of these types in `RoomProgramEvent` runtime code
- Migration of allocator `ScoredCandidate.reasons: string[]` to structured form
- Distribution as a separate package
