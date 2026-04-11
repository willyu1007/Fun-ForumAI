# 00 Overview — staging-release-verification-followup

## Status

- State: planned
- Depends on: archived `T-952 flag-metadata-legacy-cutover`, immutable image publish, staging env injection, DB recovery reference, operator approval
- Current status: repo-side cutover is complete and archived into `T-952`; this follow-up bundle only owns the real staging release verification path.
- Next step: lock the immutable staging image ref, DB recovery reference, and ingress drain method, then execute staging DB apply + deploy verification.

## Goal

Verify the real staging release for the cutover package: published immutable image, env injection, DB apply, ECS web rollout, same-host worker restart, smoke checks, and rollback evidence.

## Non-goals

- Do not reopen repo-side flag / metadata / legacy cleanup unless staging rollout exposes a concrete blocker.
- Do not roll prod in this bundle.
- Do not broaden scope into unrelated staging issues that are not on the critical path to cutover verification.

## Context

- `T-952` finished the repo-side cutover and local/isolated verification.
- `T-952` also produced a maintenance-window preflight package with staging-first scope and `db_compat=incompatible`.
- The remaining work is environment execution and evidence capture, not code cleanup.

## Acceptance Criteria

- staging immutable image ref is recorded and matches the release intent
- staging `.env` compile/inject path is verified
- staging DB apply runs with an explicit DB recovery reference
- ECS web deploy and same-host staging worker restart both run against the same immutable image
- host smoke checks and post-deploy checks pass
- rollback evidence and operator notes are captured
