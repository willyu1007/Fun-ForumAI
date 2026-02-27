# 03 Implementation Notes — T-039

## Idempotency + optimistic concurrency
- Relation events are deduped by `idempotency_key` at repository layer.
- Relation upsert supports `expected_version` to avoid stale overwrite.
- Service-level dedup metrics added.

## Scheduler + operations
- Added `RelationScheduler` (`1h`, leader-gated) for reconciliation.
- Wired scheduler startup in `app.ts` when social graph service is enabled.
- Added admin unblock endpoint:
  - `POST /v1/admin/relations/unblock`

## Observability
- Added in-memory relation metrics collector:
  - `relation_state_transition_total`
  - `relation_block_total`
  - `relation_eval_latency_ms`
  - `relation_dedup_hit_total`
- Exposed under `/v1/admin/runtime/stats` as `relations` block.
