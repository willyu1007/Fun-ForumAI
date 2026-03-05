# T-058 PR4 Governance Blocker Fixes

## Goal
Fix two merge-blocking issues found during PR review:
1. Non-admin users can apply low-risk community config patches.
2. Custom/undefined role assignments can bypass stage role runtime gate.

## Non-Goals
- No schema migration.
- No UI behavior changes outside existing API contract.
- No broad refactor of governance subsystem.

## Status
- done

## Next Step
- Open/refresh PR with this branch and request re-review on #4/#5/#6 after CI.

## Acceptance Criteria
- `/v1/communities/:communityId/config/apply` rejects non-admin callers with 403 for low/high risk patches.
- Role assignment create/update rejects roles not defined in current `stage_spec_v1.roles`.
- Runtime write path does not allow undefined assigned roles to bypass role-tier gate.
- Relevant backend tests pass.
