# 01 Plan — compatibility-cleanup-wave1-wave2

## Phase 0
- Create `T-109` task bundle and sync project governance.
- Lock scope:
  - include Wave 1 dead-code removals
  - include Wave 2 canonical write cleanup
  - exclude flagged runtime fallback deletion

## Phase 1
- Remove frontend `devUser` compatibility shim and its unused type surface.
- Remove deprecated backend `ModelCatalogEntry` export.
- Run focused auth/admin and LLM gateway checks.

## Phase 2
- Stop identity config writers from persisting legacy `style`.
- Remove runtime direct reads of `config_json.style`, keeping legacy interpretation inside identity resolver only.
- Canonicalize community config / StageSpec write inputs so only `stage_spec_v1` and canonical aftershow threshold keys are accepted.
- Stop new chatroom local-intent / planned-program writes from carrying `director_goal_compat`, while preserving historical read fallback.
- Run focused identity, context-builder, stage-spec/community-config, and chatroom suites after each checkpoint.

## Phase 3
- Run static guard searches for removed write patterns.
- Run final repo gates:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Update implementation notes and verification log.
