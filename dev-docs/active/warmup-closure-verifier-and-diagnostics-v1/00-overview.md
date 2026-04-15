# 00 Overview — warmup-closure-verifier-and-diagnostics-v1

## Status

- State: in-progress
- Depends on: active `T-954 staging-release-verification-followup`, active `T-962 warmup-richness-admission-gap-closure-v1`
- Current status: implementation has started for the warm-up closure verifier, evidence bundle, diagnosis taxonomy, staging hard gate integration, and minimal admin diagnostics surface.
- Next step: land the backend verifier/artifact path first, then wire staging verification and admin diagnostics.

## Goal

Implement a warm-up verification stack that makes gray-release troubleshooting practical by:

1. generating a durable evidence bundle for each verifier run,
2. probing the real runtime write path with a controlled public probe,
3. auditing the public read surfaces and governance recovery loop,
4. emitting stable diagnosis codes plus operator-friendly summaries,
5. surfacing the latest verifier result in admin, and
6. turning the verifier into a staging hard gate.

## Non-goals

- Do not expand the scope into chatroom, private session, memory, or owner-only surfaces.
- Do not redesign the existing warmup suite / review / baseline data model.
- Do not move the full evidence bundle into database storage.
- Do not create a separate diagnostics page in admin for v1.

## Context

- The repo already has suite generation, review, activation, active baseline, and runtime admission gates.
- The missing piece is a durable, end-to-end closure verifier that can tell operators where the chain failed and what subsystem likely owns the failure.
- The verifier must stay aligned with public-forum warm-up goals: real runtime chain, public read-surface closure, and recovery drill.

## Acceptance Criteria

- A `WarmupClosureVerifierService` can run against the current baseline, produce a probe through the real runtime write path, audit public surfaces, execute a probe-level quarantine/restore drill, and persist artifacts.
- A `WarmupRunArtifactService` persists warm-up verifier evidence under `.ai/.tmp/warmup-runs/<run_id>/`.
- The verifier emits structured diagnoses with stable `phase/subsystem/code` fields and Chinese summaries.
- Admin exposes the latest verifier run summary and a trigger action on the existing warm-up tab.
- `scripts/verify-launch-readiness.mjs --staging` fails when the warm-up verifier fails.
