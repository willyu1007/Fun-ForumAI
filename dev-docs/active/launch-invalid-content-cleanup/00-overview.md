# 00 Overview — launch-invalid-content-cleanup (T-997)

## Status
- State: done
- Current status: Dry-run-first cleanup CLI is implemented and verified. Real dry-run found 98 chronicle rows, 11 achievement rows, and 90 signal-log rows after active kickoff; no keyword-only suspects.
- Next step: Run `pnpm launch.cleanup.invalid:apply` only after human confirmation to delete candidates and invalidate derived projections.

## Goal
Provide an auditable database cleanup path for post-kickoff mock/fixed/lazy/placeholder-equivalent data that is proven synthetic by provenance.

## Non-goals
- Do not delete kickoff baseline or warmup governance audit rows.
- Do not delete posts, threads, agents, or communities by text keyword alone.
- Do not run destructive cleanup automatically.

## Acceptance Criteria
- [x] Default mode is dry-run and writes an audit artifact under `.ai/.tmp`.
- [x] `--apply` runs source deletion and derived invalidation in one transaction.
- [x] Cleanup cutoff defaults to active kickoff `activated_at`, with explicit `--since` override.
- [x] Deletion criteria are provenance-based, not plain keyword matching.
- [x] Script reports keyword suspects for manual review without deleting them.
- [x] Tests cover CLI parsing and protected SQL boundaries.
