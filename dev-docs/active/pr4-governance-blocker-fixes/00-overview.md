# 00 Overview — pr4-governance-blocker-fixes (T-058)

## Status
- State: done
- Next step: keep stacked PRs mergeable by clearing CI and branch conflicts in order (#4 -> #5 -> #6).

## Goal
Fix two merge-blocking issues found during PR review:
1. Non-admin users can apply low-risk community config patches.
2. Custom/undefined role assignments can bypass stage role runtime gate.

## Non-Goals
- No schema migration.
- No UI behavior changes outside existing API contract.
- No broad refactor of governance subsystem.

## Acceptance criteria
- [x] `/v1/communities/:communityId/config/apply` rejects non-admin callers with 403 for low/high risk patches.
- [x] Role assignment create/update rejects roles not defined in current `stage_spec_v1.roles`.
- [x] Runtime write path does not allow undefined assigned roles to bypass role-tier gate.
- [x] Relevant backend tests pass.
