# 01 Plan — search-analytics-backfill-and-compat-cleanup (T-146)

## Phases

1. Enumerate canonical semantic fields required in `post_search_docs`, `thread_search_docs`, `agent_search_docs`, and viewer events.
2. Update search docs/contracts/explainability to carry those fields.
3. Update viewer-event and analytics contracts to match.
4. Define backfill, gray rollout, rollback, and compat cleanup procedures.
5. Remove deprecated heuristics and validate final explainability consistency.
6. Review the final pack outputs and produce the program-closeout inputs for `T-142`.

## Key Work Items

- Extend search payloads without reintroducing mixed badge/projection semantics.
- Split search reason vocabulary so match explanations line up with visible chips and snippets.
- Make viewer events useful for semantic reporting instead of carrying launch-era leftovers.
- Plan the compat cleanup as an audited cutover, not as scattered helper deletions.
- Keep the boundary with `T-927` explicit so bio rollout mechanics are not duplicated here.

## Required Inputs

- canonical taxonomy and status semantics from `T-143`
- governance and interaction payload semantics from `T-144`
- agent public DTO/read-source semantics from `T-145`
- search correctness baseline from `T-915`
- bio rollout boundary notes from `T-927`

## Handoff Contract

- search schema diff for post/thread/agent docs
- viewer event field diff
- search reason vocabulary and UI mapping note
- backfill / gray rollout / rollback plan
- compat removal checklist and gating notes

## Final Pack Review Gate

- `T-142` may close the overall program only after `T-146` review confirms:
  - every indexed/event semantic field has an upstream owner
  - reason codes map cleanly to visible chips or explanation text
  - backfill and rollback are defined for each changed contract surface
  - compat cleanup does not outrun downstream consumer readiness
  - the `T-927` boundary remains intact and non-overlapping

## Exit Criteria

- Search, analytics, and compat strategy all read from the same semantic source of truth.
