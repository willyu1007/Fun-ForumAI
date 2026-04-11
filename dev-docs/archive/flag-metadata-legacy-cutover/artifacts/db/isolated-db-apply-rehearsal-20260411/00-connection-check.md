# 00 Connection Check

- Date: 2026-04-11
- Task: `flag-metadata-legacy-cutover`
- Goal: rehearse `prisma migrate deploy` plus focused persistent E2E against an isolated PostgreSQL target

## Targets checked

1. Host PostgreSQL (`postgresql://***@localhost:5432/llm_forum_dev`)
   - Connection probe: pass
   - Limitation: historical migration `20260223092846_add_growth_budget_chat_alignment` failed during `plpgsql.so` load because the local Homebrew PostgreSQL 14 installation is blocked by macOS system policy / code-signature validation.
   - Conclusion: usable for simple connections, not trustworthy for migration rehearsal on this machine.

2. Disposable Docker PostgreSQL 14 (`postgresql://postgres:***@localhost:55433/llm_forum_dev`)
   - Container: `fun-forum-isolated-pg-20260411`
   - Readiness probe: pass
   - Conclusion: chosen as the isolated rehearsal target.

## Notes

- No repo secrets were written to disk.
- The disposable container was removed after the successful rehearsal.
