# 04 Verification — T-997

## 2026-04-28
- `pnpm exec vitest run src/backend/dev/__tests__/cleanup-invalid-launch-content.test.ts`
  - Result: passed, 1 file / 6 tests.
- `pnpm typecheck`
  - Result: passed.
- `pnpm launch.cleanup.invalid -- --since 2999-01-01T00:00:00.000Z --sample-limit 1`
  - Result: passed; DB connection, SQL, and audit writing verified with zero candidates.
  - Audit: `.ai/.tmp/launch-invalid-content-cleanup/2026-04-28T08-04-15-627Z-dry-run.json`
- `pnpm launch.cleanup.invalid -- --sample-limit 5`
  - Result: passed dry-run; no deletes executed.
  - Active kickoff cutoff: `2026-04-22T08:39:55.407Z`
  - Candidates: `chronicle_entries=98`, `agent_achievements=11`, `agent_signal_logs=90`
  - Affected agents: `45`
  - Keyword suspects: `0`
  - Audit: `.ai/.tmp/launch-invalid-content-cleanup/2026-04-28T08-04-25-015Z-dry-run.json`
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main && node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed.
