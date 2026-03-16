# 02 Architecture — compatibility-cleanup-final-pass

## Context & current state
- Identity still exposes `legacy_persona_style` / `legacy_default` and resolves runtime personas from old config shapes.
- StageSpec and chatroom/public-scene flows still carry explicit historical read compatibility (`min_comments`, `director_goal_compat`, `legacy_fallback`, legacy preset templates).
- Context-memory still treats typed retrieval as optional and backfills or falls back to legacy memories when canonical data is missing.
- Persona observability and rollout evidence still include migration-only counters and gates that assume a live migration window.

## Proposed design

### Components / modules
- Identity: canonical `personaSeed + voice + ownerStylePins` only.
- Stage / aftershow / strict-T4: canonical threshold names and structured trust-only enforcement.
- Chatroom / public-scene: binding-backed scene contracts only, no legacy payload readers.
- Context-memory: typed retrieval is authoritative; `AgentMemory` remains a product-facing store but not a compat bridge.
- Observability / env: only canonical runtime-quality metrics and live feature gates remain.

### Interfaces & contracts
- API payloads:
  - `identity_contract.source` and `identity_contract_source` return only `contract_v1`.
  - chatroom/program/control payloads no longer read or expose `director_goal_compat`.
- Data models / schemas:
  - StageSpec threshold uses only `audience_comments` and `human_vote_score`.
  - Aftershow run schema/domain fields align to canonical threshold names.
  - context-memory contracts rename `compatibilityDigest` to `memoryDigest`.
  - persona observability schemas drop migration-only legacy counters and `legacy_dependency`.
- Events / jobs:
  - room/program/runtime events no longer accept legacy director-goal compatibility fields.
  - typed public-observation retrieval no longer backfills from `AgentMemory`.

### Boundaries & dependency rules
- Allowed dependencies:
  - runtime/services may depend on canonical repos, typed context, and launch catalog/bindings.
  - owner-facing memory APIs may still read/write `AgentMemory`.
- Forbidden dependencies:
  - no live runtime path may depend on legacy config shapes, legacy stage aliases, legacy scene presets, or migration-only observability counters.
  - no feature flag may preserve old behavior once the canonical contract is wired.

## Data migration
- Migration steps:
  - update Prisma schema for aftershow field renames and persona observability metric removals
  - generate/apply migration
  - update domain types/repositories/tests immediately after schema changes
- Backward compatibility strategy:
  - none for legacy runtime reads; local environments are expected to migrate/reset instead of carrying compatibility branches
- Rollout plan:
  - single-shot repository cleanup, then full verification and governance archive

## Non-functional considerations
- Security/auth/permissions:
  - owner-only memory endpoints and control-plane auth semantics remain unchanged
- Performance:
  - removing typed-context backfill should reduce retrieval-side extra writes/reads
- Observability (logs/metrics/traces):
  - retain runtime-quality metrics such as `fallbackLevel`
  - remove migration-only legacy dependency metrics and gates

## Open questions
- None. This task is intentionally decision-complete and assumes destructive cleanup is acceptable for local development.
