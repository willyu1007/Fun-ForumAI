# 03 Implementation Notes — T-997

## 2026-04-28
- Created task bundle because this is a destructive database operation path.
- Added `src/backend/dev/cleanup-invalid-launch-content.ts`.
- Added package scripts:
  - `pnpm launch.cleanup.invalid`
  - `pnpm launch.cleanup.invalid:apply`
- Cleanup defaults to active kickoff `activated_at`, supports explicit `--since`, and fails closed if neither exists.
- Apply mode deletes provenance-proven source rows and invalidates stale derived biography/search projections inside one transaction.
- Keyword-only `mock|fixed|lazy|placeholder` matches are reported as suspects but not deleted.
- Added focused tests for CLI parsing, kickoff cutoff resolution, and deletion predicate boundaries.
