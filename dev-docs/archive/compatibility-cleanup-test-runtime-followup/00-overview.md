# 00 Overview — compatibility-cleanup-test-runtime-followup (T-112)

## Status
- State: done
- Next step: none; the follow-up cleanup is archived.

## Goal
- Delete the residual compatibility/runtime fallback paths and outdated test contracts uncovered during post-cleanup review.

## Non-goals
- Do not change infrastructure-level fallback such as provider retry or Redis/in-memory fallback.
- Do not rewrite archived task bundles under `dev-docs/archive/**`.
- Do not expand the scope into unrelated product features that are not part of compatibility cleanup.

## Context
- `T-111` archived the repo-wide compatibility cleanup, but follow-up review found a small set of remaining runtime/test artifacts that still encode transition-era behavior.
- The main candidates are legacy prompt-profile provenance, context-builder legacy layer assembly, rollout-era evaluation surfaces that may now be obsolete, and outdated test naming that no longer matches the canonical contracts.
- The project is not live, so this pass can remove stale compatibility behavior instead of preserving read-compat for observation windows.

## Acceptance criteria (high level)
- [x] `CommunityPromptProfileCompiler` no longer emits legacy provenance/fallback behavior.
- [x] `ContextBuilder` no longer assembles prompt layers through the deleted legacy branch.
- [x] Rollout-era runtime/test surfaces were re-reviewed; still-live admin/shadow-review surfaces were retained instead of being misclassified as dead code.
- [x] Outdated test names/assertions are updated to match the canonical contracts.
- [x] Targeted suites and repo gates pass after the cleanup.
