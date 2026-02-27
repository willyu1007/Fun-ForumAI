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
