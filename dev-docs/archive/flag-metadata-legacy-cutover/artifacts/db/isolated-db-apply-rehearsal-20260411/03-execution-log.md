# 03 Execution Log

## Summary

- Host-backed rehearsal: failed due local PostgreSQL installation issue (`plpgsql.so` blocked by system policy).
- Docker-backed rehearsal: passed after adding the missing versioned migration and updating persistent E2E assertions/fixtures.

## Retained archive evidence

- this summary is the canonical retained execution log for the rehearsal
- raw host/docker rerun `.txt` outputs were intentionally removed during archive compaction to avoid low-signal duplicate evidence
- the final successful state is preserved in:
  - `/Volumes/DataDisk/Project/Fun-ForumAI/dev-docs/archive/flag-metadata-legacy-cutover/artifacts/db/isolated-db-apply-rehearsal-20260411/04-post-verify.md`
