# Observability - AI Guidance

## Conclusions (read first)

- Observability contracts are defined in `docs/context/observability/`.
- Use `node .ai/skills/features/observability/scripts/ctl-observability.mjs` to manage metrics, logs, and traces definitions.
- AI proposes instrumentation; humans implement.

## Contract Files

| File | Purpose |
|------|---------|
| `metrics-registry.json` | Metric definitions |
| `logs-schema.json` | Structured log schema |
| `traces-config.json` | Tracing configuration |

## AI Workflow

1. **Review** existing metrics/logs/traces contracts
2. **Propose** new observability points via `node .ai/skills/features/observability/scripts/ctl-observability.mjs`
3. **Generate** instrumentation hints
4. **Document** in `handbook/`

## Forbidden Actions

- Adding metrics without proper naming convention
- Logging sensitive data (PII, credentials)
- High-cardinality labels on metrics (e.g., user_id as label)
- Excessive logging in hot paths
