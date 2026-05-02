# 00 Overview — repo-hygiene-and-temp-artifact-cleanup (T-999)

## Status
- State: done
- Current status: removed the hard compile-time dependency on `.ai/.tmp/kickoff-local/src/shared`, deleted the locally generated `ops/deploy/env-files/staging.env` secret artifact plus stale `.ai/.tmp` warmup evidence, and kept unrelated active feature edits intact for commit after verification.
- Next step: none inside this task.

## Goal
Clean redundant, invalid, or expired repository artifacts without deleting active product code or user in-progress work.

## Non-goals
- Do not redesign optional kickoff-local dev tooling that still intentionally exists behind runtime fallbacks.
- Do not delete active user feature work simply because it is uncommitted.
- Do not commit secret-bearing generated env files.

## Acceptance Criteria
- [x] Repo TypeScript config no longer hard-depends on `.ai/.tmp/kickoff-local/src/shared`.
- [x] Expired local generated artifacts are removed from the workspace (`ops/deploy/env-files/staging.env` and stale `.ai/.tmp` run outputs).
- [x] Project governance reflects the new cleanup task.
- [x] Verification covers compile/test health for the touched areas before commit.
