# 00 Overview — compatibility-cleanup-pr-review-followup (T-113)

## Status
- State: done
- Next step: push the verified fixes to PR #14 and wait for review.

## Goal
- Review every current PR inline comment independently, confirm whether the issue is real, and land the necessary fixes without reopening the broader compatibility cleanup scope.

## Non-goals
- Do not revisit the already-archived compatibility cleanup task scopes beyond issues directly required to resolve PR review findings.
- Do not modify unrelated local environment files such as `.codex/environments/local.toml`.

## Context
- PR #14 (`codex/compatibility-cleanup-closure`) already landed the compatibility cleanup waves and archive/governance closeout.
- Review comments surfaced five concrete follow-up problems:
  - dead env-contract flags still documented after runtime gates were removed
  - director-history maintenance scheduler starts even when launch catalog artifacts are absent
  - scheduled posting lost its non-scene fallback path in fresh/local environments
  - chatroom cues now require pre-bound room scene bindings that runtime-created rooms never provision
  - strict-T4 trust enforcement flag contract no longer matches runtime behavior

## Acceptance criteria (high level)
- [x] Each current PR inline comment is either fixed or explicitly rejected with evidence.
- [x] `FF_CONTROL_PLANE_CONFIG_V1` and `FF_INCUBATION_TRUST_HARD_ENFORCE` are no longer exposed as live env-contract flags if runtime no longer consumes them.
- [x] Director-history maintenance does not auto-start into repeated failures when launch catalog artifacts are missing.
- [x] Scheduled posting degrades gracefully when the public scene catalog is unavailable.
- [x] Runtime-created chat rooms can still accept manual cues without requiring a pre-provisioned room-specific launch binding.
- [x] Targeted tests and full repo gates pass before the PR is updated.
