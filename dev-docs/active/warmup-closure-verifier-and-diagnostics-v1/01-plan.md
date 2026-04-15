# 01 Plan — warmup-closure-verifier-and-diagnostics-v1

## Phase 1 — Artifact, Taxonomy, and Probe Contract

1. Add warm-up verifier types, diagnosis taxonomy, and artifact persistence service.
2. Extend runtime probe inputs so the verifier can create a traceable public probe through the real scheduler path.
3. Define the verifier output contract consumed by scripts and admin.

Exit criteria:
- verifier contracts are fixed
- artifact paths and run summaries are readable without DB writes

## Phase 2 — Closure Verification and Hard Gate

1. Implement `WarmupClosureVerifierService`.
2. Add public read-surface auditing for `feed`, `home`, `highlights`, and `search`.
3. Add probe-level quarantine/restore recovery drill.
4. Integrate the verifier into a standalone script and into `verify-launch-readiness.mjs`.

Exit criteria:
- verifier can fail-closed with durable evidence
- staging readiness mirrors the verifier result

## Phase 3 — Admin Diagnostics and Regression Coverage

1. Expose create/read/latest verifier routes.
2. Add the minimal diagnostics panel to the existing warm-up admin tab.
3. Add backend, script, and UI tests covering success and key failure classes.

Exit criteria:
- admin can trigger and inspect the latest verifier run
- test coverage exists for success, gate failures, surface failures, and recovery drift
