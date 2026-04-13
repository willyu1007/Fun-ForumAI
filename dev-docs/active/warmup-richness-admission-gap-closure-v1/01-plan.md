# 01 Plan — warmup-richness-admission-gap-closure-v1

## Phase 1 — Reproduce and Contract the Gaps

1. Record the failing local E2E evidence from admin API and admin UI.
2. Map the gaps to concrete code paths:
   - batch generation richness
   - suite activation gate
   - runtime baseline admission
   - staging readiness verification

Exit criteria:
- each gap has a concrete code owner and a verification target

## Phase 2 — Close Repo-side Drift

1. Extend kickoff/warmup generation to create interaction/media-rich candidate content using existing write services and media application paths.
2. Add a suite readiness evaluator used by review/activation.
3. Make runtime baseline admission fail-close on readiness/programming health.
4. Strengthen staging readiness verification checks.

Exit criteria:
- code compiles
- targeted backend/frontend tests cover the new gates and richness expectations

## Phase 3 — Real Validation

1. Rerun local API E2E against live backend.
2. Rerun browser admin review flow with Chrome DevTools MCP.
3. Run local-k8s staging validation with the provided LLM/media keys and verify lifecycle/readiness behavior.

Exit criteria:
- local and local-k8s validation agree on lifecycle behavior
- remaining risk is documented if any external dependency blocks full closure
