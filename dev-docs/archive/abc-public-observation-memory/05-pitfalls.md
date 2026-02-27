# 05 Pitfalls — abc-public-observation-memory (T-036)

## Do-not-repeat
- Root cause: `prisma migrate dev` surfaced a generic `Schema engine error` while local PostgreSQL on `localhost:5432` was not running.
- Prevention: run a fast DB reachability check before migration (`prisma db execute --stdin` with `select 1;`) to surface `P1001` clearly.
- Migration naming pitfall: very long manual index names can be truncated by PostgreSQL and later interpreted by Prisma as drift (rename migration).
- Prevention: use Prisma-compatible index naming (or accept generated names) in manual SQL migrations to avoid post-apply rename diffs.
- Symptom: for unsupported partial index migration, `prisma migrate dev --name ...` auto-generated an additional drop-index migration and timestamped it out-of-order, breaking fresh bootstrap safety.
  - Root cause: Prisma schema cannot represent partial unique index diff, so `migrate dev` tried to “reconcile” DB back to schema.
  - What was tried: running `migrate dev` directly after adding manual SQL migration.
  - Fix/workaround: removed accidental migration folder and reset local DB migration chain to the intended migrations set.
  - Prevention: for unsupported manual SQL constructs (e.g., partial indexes), avoid schema-diff driven `migrate dev` loops immediately after apply; verify chain ordering and run `migrate status` on a clean reset.
- Symptom: owner-only memory routes returned `200 []` to non-owners when private-channel services were unavailable.
  - Root cause: fallback branch (`services == null`) executed before owner check.
  - What was tried: route-level fallback retained for owner but moved below ownership check.
  - Fix/workaround: perform `assertAgentOwner` first, then apply DB-unavailable fallback.
  - Prevention: for all owner-only routes, enforce “auth/ownership before fallback” as fixed ordering rule.
