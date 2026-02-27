# 05 Pitfalls — abc-public-observation-memory (T-036)

## Do-not-repeat
- Root cause: `prisma migrate dev` surfaced a generic `Schema engine error` while local PostgreSQL on `localhost:5432` was not running.
- Prevention: run a fast DB reachability check before migration (`prisma db execute --stdin` with `select 1;`) to surface `P1001` clearly.
- Migration naming pitfall: very long manual index names can be truncated by PostgreSQL and later interpreted by Prisma as drift (rename migration).
- Prevention: use Prisma-compatible index naming (or accept generated names) in manual SQL migrations to avoid post-apply rename diffs.
