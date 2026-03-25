# 00 Overview

## Status
- State: done
- Next step: no further follow-up is required for the three identified blockers unless we also choose to normalize local `.env.local` overrides such as `FF_PERSONA_RUNTIME_SCENES`.

- Task: `T-922`
- Slug: `vote-target-migration-and-semantic-convergence-v1`
- State: `done`
- Last updated: `2026-03-25`

## Goal
- Repair the three post-review blockers:
  - persistence startup failure caused by `VoteTarget` drift
  - missing vote enum cutover / historical vote backfill for thread-turn semantics
  - remaining repo-facing legacy naming around media and thread-turn thresholds

## Non-goals
- Broad feature work outside the identified three findings
- K8s environment rollout

## Scope
- Prisma schema and migration chain
- Local dev database apply/verification
- Runtime/config naming cleanup needed to remove semantic drift

## Acceptance criteria (high level)
- [x] Local dev database migrates successfully through the repo Prisma chain, including `T-922`.
- [x] Persistent startup no longer fails on legacy `VoteTarget='COMMENT'` drift.
- [x] Active repo-facing media and membership naming no longer exposes the old `inclination` / `comment threshold` terminology.
- [x] DB context and env contract generated artifacts are refreshed after the convergence work.

## Current status
- Completed.
- Local dev DB is now fully migrated through `T-922`.
- `VoteTarget` / `HumanVoteTarget` have been cut over to `THREAD` / `TURN`.
- Repo-facing media naming and membership threshold naming have been converged away from legacy `inclination` / `comment` terminology.
