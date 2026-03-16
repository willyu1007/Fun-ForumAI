# 00 Overview — compatibility-cleanup-wave1-wave2 (T-109)

## Status
- State: done
- Next step: none; Wave 1 / Wave 2 cleanup is archived and superseded by archived follow-up bundles for Wave 3 and final cleanup.

## Goal
- Remove unused compatibility-only surfaces that no longer have live consumers.
- Stop new writes from perpetuating legacy config and event shapes.
- Preserve controlled read compatibility for historical data and flagged rollout paths that are explicitly out of scope for this wave.

## Non-goals
- Do not remove runtime fallback paths that are still governed by feature flags or rollout gates.
- Do not change Prisma schema or run DB migrations.
- Do not redesign public API behavior beyond removing unused compatibility fields and rejecting legacy write aliases.

## Acceptance criteria
- `useAuth()` no longer exposes `devUser`, and no frontend caller depends on it.
- Deprecated `ModelCatalogEntry` compatibility export is removed with no live consumers left.
- New identity config writes no longer persist `config_json.style`; runtime style resolution reads canonical contract data only.
- Community config / StageSpec write paths only accept canonical `stage_spec_v1` payloads and canonical aftershow threshold keys.
- New chatroom local-intent / planned-program payloads no longer write `director_goal_compat`; historical read compatibility remains intact.
- Targeted suites and full repo gates pass, and verification evidence is recorded.
