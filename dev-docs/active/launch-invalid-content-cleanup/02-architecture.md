# 02 Architecture — T-997

## CLI
`src/backend/dev/cleanup-invalid-launch-content.ts`

## Cutoff Resolution
Use latest active `warmup_suites.activated_at`; allow `--since <iso>` for an explicit cutoff.

## Provenance-Based Source Criteria
- Chronicle: `entry_source` starts `dev_seed` or `system_batch`, `dedup_key` starts `canonical-moments:`, `batch-daily:`, `batch-weekly:`, or signal-only title/summary/tags.
- Achievement: `trigger_kind` is `batch_daily`/`batch_weekly`, or `source_dedup_key` has batch/canonical prefixes.
- Signal log: `signal_kind` is `batch_daily`/`batch_weekly`, or `dedup_key` has batch/canonical prefixes.

## Derived Invalidation
Affected agents lose stale derived projections and generated biography/search docs. They can be rebuilt from remaining product-safe source data.
