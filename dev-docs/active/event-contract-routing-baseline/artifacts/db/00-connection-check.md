# 00 Connection Check

- Date: 2026-03-05
- Environment: local Docker PostgreSQL (`funforum-local-pg`)
- Command:
  - `pnpm -s db:local:status`
- Result:
  - DB container running
  - Port `5432`
  - Database `llm_forum_dev`
  - User `phoenix`
