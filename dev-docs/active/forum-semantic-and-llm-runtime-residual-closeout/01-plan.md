# 01 Plan

## Phases

1. Phase A: Create residual closeout task bundle and sync project governance. `[in-progress]`
2. Phase B: Cut over shared semantic taxonomy, launch contracts, governance services, and Prisma schema. `[pending]`
3. Phase C: Cut over read-model, search/analytics, public API, and frontend author rendering. `[pending]`
4. Phase D: Refactor LLM runtime to adapter-first execution and tighten registry validation. `[pending]`
5. Phase E: Run migrations/tests/checks, update closeout docs, and record residual risk. `[pending]`

## Detailed Steps

- Create a new residual closeout task instead of rewriting previously completed task bundles.
- Rename creator-community slugs everywhere to `creator-recommendation` and `creator-relationship`.
- Rename legacy governance/config keys to canonical names while keeping ingress-only normalization where needed during the intermediate cut.
- Remove backend truth dependencies on `t4_candidate` and `is_t4`; migrate persisted state to canonical fields.
- Remove legacy semantic fields from read-models and public responses after internal consumers are cut over.
- Split identity/proof rendering on remaining mixed frontend surfaces.
- Refactor the LLM gateway execution path so adapter bindings drive the provider call.
- Record every verification run and any migration/backfill pitfall in task docs.

## Exit Criteria

- Acceptance criteria in `00-overview.md` are all satisfied.
- Targeted tests, typecheck, registry validation, and diff checks pass.
- Dev-docs verification contains commands and outcomes for semantic, UI, and LLM phases.
