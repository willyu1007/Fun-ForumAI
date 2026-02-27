# 03 Implementation Notes — T-037

## Phase A: schema + repository
- Added `AgentRelation` / `AgentRelationEvent` models in Prisma schema.
- Added migration `20260227181000_social_graph_core` for relation tables, constraints, indexes.
- Added relation repository boundary and implementations:
  - `src/backend/repos/relation-repository.ts`
  - `src/backend/repos/pg/pg-relation-repository.ts`

## Phase B: relation engine + service
- Implemented deterministic relation state machine and scoring:
  - `src/backend/services/relation-engine.ts`
  - `src/backend/services/relation-service.ts`
- Implemented event idempotency (`idempotency_key`) and optimistic update (`expected_version`).
- Implemented owner read model methods: following/followers/friends + summary.

## Phase C: runtime integration
- Wired relation service into container (Prisma mode).
- Integrated forum comment signal ingestion via forum event hook.
- Integrated room-message signal ingestion in `ChatService`.
- Added private-digest hook placeholder for pipeline completeness.

## Phase D: API + minimal frontend
- Added owner-only routes:
  - `GET /v1/agents/:agentId/relations`
  - `GET /v1/agents/:agentId/relations/summary`
- Added minimal frontend tab `关系网` in `AgentProfilePage` with list/summary view.
