# 01 Plan — compatibility-cleanup-pr-review-followup

## Phase 0
- Create `T-113` and sync project governance so the PR review follow-up has its own live bundle.

## Phase 1
- Revalidate every PR comment against the current code and keep only real issues.

## Phase 2
- Fix dead env contract drift:
  - remove `FF_CONTROL_PLANE_CONFIG_V1`
  - remove `FF_INCUBATION_TRUST_HARD_ENFORCE`
  - regenerate env docs/examples and clean deploy overlays

## Phase 3
- Fix runtime regressions:
  - gate director-history scheduler startup on launch-catalog readiness
  - restore scheduled-post fallback when the public scene catalog/selector cannot provide a scene
  - restore a non-binding chatroom scene contract path for runtime-created rooms while still preferring explicit bindings

## Phase 4
- Update affected tests, rerun targeted suites, then run full repo verification and push PR updates.
