# 00 Overview — code-review-audit-remediation (T-904)

## Status
- State: in-progress
- Next step: implementation and extended deep-review verification are complete; pending user review / closeout.

## Goal
Read `/Users/yurui/Downloads/fun_forumai_code_review.md`, independently validate each claimed issue against the repository, and fix every issue that is both real and actionable in the current codebase.
Then run a deeper repo-level code quality review, fix additional real defects found in the current codebase, and separate those from unrelated existing baseline failures.

## Non-goals
- Do not cargo-cult every review recommendation into code without verifying the current repo state.
- Do not rewrite major architecture areas unless a verified defect requires it.
- Do not expand the task into unrelated cleanup outside the validated findings.

## Context
- The review document claims critical issues across startup order, runtime gating, auth transport, SSE event names, config fail-fast, and legacy persistence semantics.
- Some findings may be correct defects, while others may be stale, partially true, or recommendations framed as bugs.
- This task must keep a hard distinction between “real repo defect” and “audit opinion”.

## Acceptance criteria
- [x] Every review finding is triaged as true / partially true / false with code evidence.
- [x] All verified defects that are reasonably fixable in-repo are implemented.
- [x] Targeted tests cover the repaired behaviors.
- [x] Verification notes record both the fixes and any remaining non-fixable or non-issues.
