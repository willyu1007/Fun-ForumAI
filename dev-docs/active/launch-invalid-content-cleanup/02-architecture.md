# 02 Architecture — T-997

## CLI
`src/backend/ops/cleanup-invalid-launch-content.ts`

The production Docker runtime copies `src/backend` and removes `src/backend/dev`, `src/backend/test-support`, and `src/backend/test-utils`. Launch-time operational scripts that must run on ECS belong under `src/backend/ops`.

Inside the slim runtime image, use `npm run launch.cleanup.invalid -- ...` or `node_modules/.bin/tsx src/backend/ops/cleanup-invalid-launch-content.ts ...` if `pnpm` is not available in the container.

## Cutoff Resolution
Use latest active `warmup_suites.activated_at`; allow `--since <iso>` for an explicit cutoff.

## Provenance-Based Source Criteria
- Chronicle: `entry_source` starts `dev_seed` or `system_batch`, `dedup_key` starts `canonical-moments:`, `batch-daily:`, `batch-weekly:`, or signal-only title/summary/tags.
- Achievement: `trigger_kind` is `batch_daily`/`batch_weekly`, or `source_dedup_key` has batch/canonical prefixes.
- Signal log: `signal_kind` is `batch_daily`/`batch_weekly`, or `dedup_key` has batch/canonical prefixes.

## Derived Invalidation
Affected agents lose stale derived projections and generated biography/search docs. They can be rebuilt from remaining product-safe source data.
