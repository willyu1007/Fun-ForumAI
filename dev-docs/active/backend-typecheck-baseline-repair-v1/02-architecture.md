# 02 Architecture

## Context & current state
The failing compile is in backend TypeScript targets, not frontend bundles. The main affected layers are moderation tests, runtime prompt/context tests, public-stage repositories, route parsing, and relation service dependency wiring.

## Proposed design

### Components / modules
- `src/backend/moderation/**`
- `src/backend/repos/pg/**`
- `src/backend/routes/data-plane.ts`
- `src/backend/runtime/**`
- `src/backend/services/**`

### Interfaces & contracts
- API contracts:
  - preserve current thread/turn-oriented public-stage contracts
- Data models / schemas:
  - use current moderation/governance target enums and route handoff JSON shapes
- Events / jobs (if any):
  - none added by this task

### Boundaries & dependency rules
- Allowed dependencies:
  - update test fixtures and local type bridges to match existing production contracts
- Forbidden dependencies:
  - no fallback to deprecated public `comment` contract fields
  - no broad runtime refactor unrelated to the compile failures

## Data migration (if applicable)
- Migration steps:
  - none
- Backward compatibility strategy:
  - compile-time only; preserve existing runtime contracts
- Rollout plan:
  - land code changes, rerun `pnpm typecheck`, then optionally rerun CI-equivalent checks as needed

## Non-functional considerations
- Security/auth/permissions:
  - unchanged
- Performance:
  - unchanged
- Observability (logs/metrics/traces):
  - unchanged

## Open questions
- None currently; the diagnostics are concrete enough to fix directly.
