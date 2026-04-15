# 03 Implementation Notes — warmup-closure-verifier-and-diagnostics-v1

## 2026-04-15

- Created the implementation task bundle and locked the scope to public-forum warm-up verification, evidence, diagnosis, staging gate, and minimal admin diagnostics.
- Added `src/shared/warmup-verifier.ts` as the shared contract for run summaries, diagnoses, surface audits, governance drill results, and artifact paths.
- Implemented `WarmupRunArtifactService` to persist fixed-file evidence bundles under `.ai/.tmp/warmup-runs/<run_id>/` and to serve latest/by-id run lookups without moving evidence into DB storage.
- Implemented `WarmupClosureVerifierService` to fail closed on missing baseline/runtime/LLM prerequisites, create a controlled runtime probe, audit `feed/home/highlights/search`, and emit stable `phase/subsystem/code` diagnoses.
- Extended `PostScheduler.forcePost/createPost` with optional `probe_context` so the verifier uses the real runtime write path while adding deterministic probe tags and title suffixes without polluting warm-up batch accounting.
- Wired verifier routes into `/v1/admin/warm-start/verifier/runs`, `/latest`, and `/:id`, and surfaced the latest verifier summary plus rerun action in the existing admin warm-up tab.
- Integrated `scripts/verify-warmup-closure.mjs` into `scripts/verify-launch-readiness.mjs` as a staging hard gate.
- Probe governance drill is implemented as direct probe-level quarantine/restore on the probe post plus projection refresh, not via `executeGovernanceBatch`, because probe posts intentionally do not belong to warm-start candidate batches.
- Follow-up hardening after code review:
  - verifier now quarantines the probe again during final cleanup so successful runs do not leave probe content on public surfaces,
  - `createRun()` pre-creates the full fixed artifact set so early failures still leave a complete evidence bundle,
  - final summary now derives diagnoses from the persisted diagnosis artifact to keep `summary/top_diagnosis/diagnosis.json` aligned,
  - dependency exceptions from governance/repository reads are classified into `suite_resolution` or the relevant runtime phase instead of collapsing into a generic artifact error.
- Release-review fixes:
  - verifier no longer maps `latest_review.reason_codes` into blockers when the latest decision is `pass_to_active`, and warm-up review validation/service logic now rejects `reason_codes` on approved reviews to prevent future drift,
  - surface auditing now isolates `feed/search/home/highlights` read exceptions into per-surface checkpoints and diagnosis codes instead of collapsing them into a generic feed failure,
  - governance drill and summary now include an explicit `cleanup` step plus `after_cleanup` surface evidence so final probe re-quarantine failures are visible in admin diagnostics and persisted artifacts.
