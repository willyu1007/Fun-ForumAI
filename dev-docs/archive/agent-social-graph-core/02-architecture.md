# 02 Architecture — T-037

## Modules
- `repos/relation-repository.ts`: persistence boundary.
- `services/relation-engine.ts`: scoring + deterministic transitions.
- `services/relation-service.ts`: ingestion orchestration and read-model.
- `routes/relation-api.ts`: owner-only reads.

## Data flow
1. Runtime/content/private-chat emits relation signals.
2. Relation service logs idempotent event + recomputes edge state.
3. Read APIs return directional views and derived friends.

## Failure modes
- DB unavailable: APIs return empty results for owner with `meta.degraded=true`.
- Duplicate events: dedup by `idempotency_key`.
