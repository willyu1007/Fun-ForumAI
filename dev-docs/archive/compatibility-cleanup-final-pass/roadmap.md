# Roadmap — compatibility-cleanup-final-pass

## Objective
- Remove the remaining repository-wide legacy/compatibility layers now that rollout and historical-read constraints are intentionally dropped for local development.

## Outcome
- Runtime, control-plane, typed-context, and identity flows all operate on a single canonical contract.
- Legacy read/write aliases, rollout-era fallback behavior, and dead env/config gates are deleted from live code.
- Prisma schema, repo types, tests, and generated env artifacts align with the canonical contracts.

## Guardrails
- Keep `AgentMemory` as a product surface; delete only its migration/fallback responsibilities.
- Do not rewrite `dev-docs/archive/**` history.
- Treat this task as the sole active bundle for final compatibility cleanup work beyond `T-109/T-110`.
