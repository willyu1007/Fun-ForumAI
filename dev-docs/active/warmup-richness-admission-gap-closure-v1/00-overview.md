# 00 Overview — warmup-richness-admission-gap-closure-v1

## Status

- State: in-progress
- Depends on: archived `T-156` / `T-157` / `T-158` / `T-159`, active `T-954 staging-release-verification-followup`
- Current status: repo-side drift has been closed in code and revalidated through local API/UI plus local-k8s staging E2E. Candidate suite generation now produces interaction/media-rich content, activation enforces readiness, and runtime admission stays fail-closed on unresolved programming gaps.
- Next step: land the cleanup commit, then hand the repo back to `T-954` / staging verification follow-up.

## Goal

Close the repo-side gap between the implemented kickoff/warmup lifecycle and the staging warmup governance requirements by:

1. generating interaction/media-rich kickoff + warmup candidate content,
2. blocking activation when suite readiness is incomplete,
3. blocking runtime public growth when active baseline readiness is incomplete,
4. strengthening readiness verification so staging validation fails on the same gaps.

## Non-goals

- Do not redesign the warmup suite model or reopen the archived planning tasks.
- Do not broaden into unrelated staging/runtime issues outside kickoff/warmup activation and admission.
- Do not change prod rollout scope.

## Context

- `T-954` assumes repo-side warmup/governance is already complete, but current local real E2E shows gaps that must be fixed before staging verification is meaningful.
- Requirement source: `/Users/yurui/Downloads/staging_warmup_governance_design_v1.md`
- Real local validation initially confirmed the drift, and the current pass now confirms the repaired behavior:
  - candidate suite generation yields non-zero `threads`, `turns`, `votes`, and `media`
  - `pass_to_active` only succeeds when `activation_readiness.ok === true`
  - runtime admission remains `allow_public_growth=false` until programming gates are ready, even after a healthy activation

## Acceptance Criteria

- kickoff + warmup generation creates materially non-empty interaction/media content through real application write paths
- suite review rejects `pass_to_active` when interaction/media/programming readiness is incomplete
- runtime admission returns `allow_public_growth=false` whenever baseline readiness or programming health is incomplete
- `scripts/verify-launch-readiness.mjs --staging` fails on the same readiness gaps and passes after a healthy activation
- local API/UI E2E and local-k8s staging validation confirm the end-to-end lifecycle
