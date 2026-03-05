# Implementation Notes

## 2026-03-06
- Enforced admin gate on config apply endpoint:
  - `src/backend/routes/stage-incubation.ts`
  - `/communities/:communityId/config/apply` now requires `requireAdmin`.
- Hardened role-assignment service validation:
  - `src/backend/services/role-assignment-service.ts`
  - `assign/update` now reject role keys not present in current `stage_spec_v1.roles`.
- Added runtime defense for historical invalid assignment records:
  - `src/backend/services/forum-write-service.ts`
  - Unknown assigned role keys are ignored; stage role gate fails closed when role key is undefined in stage spec.
- Added regression tests:
  - `src/backend/routes/__tests__/e2e-control-plane.test.ts`
    - non-admin blocked for low-risk config apply
    - invalid role assignment create/update rejected
    - existing config apply expectations adjusted to admin-only semantics
  - `src/backend/services/__tests__/forum-write-service.test.ts`
    - unknown assigned role cannot bypass runtime stage role gate
