# 03 Implementation Notes — abc-public-observation-memory (T-036)

## Log
- 2026-02-27: Extended `AgentMemory` schema and repository contract with source anchors (`source_ref_type/source_ref_id/source_event_id`).
- 2026-02-27: Added migration SQL at `prisma/migrations/20260227150500_add_public_observation_memory_anchors/migration.sql`.
- 2026-02-27: Added `PublicObservationDigestService` and `PublicObservationEventHandler` (forum events + room messages).
- 2026-02-27: Added `MemoryService.createPublicObservationMemory` and retrieval weighting improvements (recency + diversity).
- 2026-02-27: Extended memory APIs with source-ref filters and added `GET /v1/agents/:agentId/public-observations` (owner-only).
- 2026-02-27: Ran `ctl-db-ssot sync-to-context` to refresh `docs/context/db/schema.json`.
- 2026-02-27: Fixed local Prisma migration reliability by ensuring local PostgreSQL availability on `localhost:5432` and reran `prisma migrate dev` successfully.
- 2026-02-27: Normalized manual migration index name to Prisma-expected identifier to avoid follow-up rename migration drift.
- 2026-02-27: Added DB hard idempotency migration `20260227164500_public_observation_event_idempotency` with partial unique index on `(agent_id, source_type, source_event_id)` for `PUBLIC_OBSERVATION` and non-null event IDs.
- 2026-02-27: Extended memory query contract with `source_event_id` filter (`MemoryRepository`/`PgMemoryRepository`/`MemoryService` list options) for replay detection and conflict readback.
- 2026-02-27: Hardened `MemoryService.createPublicObservationMemory`:
  - pre-check by `source_event_id` (hit returns existing);
  - unique-conflict handling (`P2002`) with readback fallback;
  - dedup precheck query failures are fail-open (warn + continue).
- 2026-02-27: Hardened `PublicObservationDigestService`:
  - pre-summary checks: event dedup + cooldown;
  - pre-write cooldown recheck (TOCTOU mitigation);
  - dedup/cooldown check failures are fail-open with warning logs.
- 2026-02-27: Adjusted owner-only route semantics:
  - `/v1/agents/:agentId/memories` and `/v1/agents/:agentId/public-observations` now run owner check before service-availability fallback.
  - Non-owner always gets 403, including DB-unavailable mode.
- 2026-02-27: Added deep-hardening tests:
  - Expanded `public-observation-digest-service.test.ts` to cover threshold boundaries, cooldown boundary, event replay idempotency, TOCTOU, and fail-open degradation.
  - Added `private-channel-memory-auth.test.ts` for owner-only checks under service-unavailable fallback.
- 2026-02-27: Prisma caveat handled during implementation:
  - `migrate dev` auto-generated an out-of-order drop-index migration for unsupported partial-index diff.
  - Resolved by removing that accidental migration folder and resetting local DB migrations chain to the intended set.
