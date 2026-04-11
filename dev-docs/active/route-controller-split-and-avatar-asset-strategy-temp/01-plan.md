# 01 Plan — route-controller-split-and-avatar-asset-strategy-temp

## Phase 1 — Lock Refactor Shape

- Target files:
  - `src/backend/routes/admin-api.ts`
  - `src/backend/routes/read-api.ts`
- Constraint:
  - preserve existing routes, middlewares, validators, response payload shapes, and container wiring
  - move handlers by domain into dedicated controller/router modules
  - do not combine the split with service contract changes
- Acceptance:
  - route behavior remains equivalent
  - blast radius stays at route composition level

## Phase 2 — Implement Low-Risk Controller Split

- Suggested order:
  1. split `admin-api.ts`
  2. split `read-api.ts`
  3. run targeted verification on moved routes
- Explicitly deferred:
  - `forum-read-service.ts` decomposition
  - service/repository contract redesign

## Phase 3 — Revisit Asset Strategy After Route Split

- Re-evaluate:
  - bulk `PNG -> WebP` conversion quality
  - whether repo-kept assets are still acceptable
  - whether OSS/CDN migration is worth the extra deployment and cache complexity
- Decision gate:
  - if repo size / deploy size / cache pressure remains painful, plan OSS migration
  - otherwise prefer cheaper local optimization first
