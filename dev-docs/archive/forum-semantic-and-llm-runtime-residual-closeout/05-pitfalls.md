# 05 Pitfalls

## Do Not Repeat

- Do not treat legacy config aliases as permission to keep legacy truth fields in service or repo types.
- Do not reopen completed historical task bundles just to record new residual fixes; record them here.
- Do not let adapter selection remain observational only; it must own execution.

## Append-only Log

- 2026-04-06: when normalizing nested JSON with `jsonb_set`, do not pass a SQL `NULL` child value. If `launch_system_identity` is absent, guard and return the original document; otherwise Postgres will attempt to write SQL `NULL` into `agent_configs.config_json` and violate the column constraint.
