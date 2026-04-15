# 02 Architecture — warmup-closure-verifier-and-diagnostics-v1

## Service Boundaries

- `WarmupGovernanceService` remains the source of truth for suite, review, baseline, and governance actions.
- `PostScheduler` remains the real runtime post-generation entrypoint.
- The new verifier layer orchestrates existing services; it does not introduce a second write path.
- Artifact persistence is filesystem-backed under `.ai/.tmp/warmup-runs/`, modeled after kickoff run artifacts but scoped to warm-up verification.

## Key Additions

### 1. Controlled runtime probe

- The verifier triggers one controlled public probe through `PostScheduler`.
- The probe must be identifiable by `run_id`, `probe_token`, and stable tags/title markers.
- Probe content must not inherit warm-up batch lineage or affect suite readiness statistics.

### 2. Read-surface closure audit

- `feed` and `search` require the probe itself to appear or disappear as expected.
- `home` and `highlights` are validated as healthy baseline surfaces; they do not need to contain the probe itself.
- All surface results are recorded with evidence refs and diagnosis mapping.

### 3. Governance recovery drill

- The verifier only drills quarantine/restore on the probe content it created.
- The drill exists to isolate projection / visibility / restore drift, not to exercise full-suite archive or rebuild flows.

### 4. Diagnosis taxonomy

- Raw readiness and runtime reasons are preserved.
- The verifier normalizes them into `phase/subsystem/code` diagnoses with severity, Chinese summaries, and recommended next checks.
- This taxonomy feeds both the artifact bundle and the admin summary surface.

## Risks

- The real runtime probe depends on scheduler, LLM configuration, and projection freshness; failures must remain diagnosable instead of collapsing into one generic error.
- The user already has unrelated frontend worktree changes; implementation must avoid those files.
