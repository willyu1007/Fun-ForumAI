# 02 Architecture

## Context & current state
- Prompt composition should now flow through the canonical prompt services (`PromptOrchestrator` or `PromptLayerService`).
- Review found two residual transition paths:
  - `CommunityPromptProfileCompiler` still reports a `legacy` provenance/fallback state when no structured profile is present.
  - `ContextBuilder` still contains a manual layer assembly branch that bypasses the canonical prompt services.
- A second cluster of review findings concerns rollout/evidence modules and outdated test wording. Dependency review showed the rollout/evidence modules still back live admin/shadow-review flows, so they are not safe deletion targets in this pass.

## Proposed design

### Components / modules
- `src/backend/runtime/community-prompt-profile-compiler.ts`
- `src/backend/runtime/context-builder.ts`
- `src/backend/runtime/**` rollout/evidence modules if still clearly transitional
- affected tests under `src/backend/runtime/__tests__/`, `src/backend/routes/__tests__/`, and `src/backend/services/__tests__/`

### Interfaces & contracts
- Prompt-profile provenance should describe canonical data sources only.
- Context building must not silently reconstruct prompt layers through deleted legacy logic.
- Test language should reflect the current product contract instead of transition-era naming.
- Rollout/evidence surfaces stay intact until their live admin/shadow-review consumers are explicitly retired.

### Boundaries & dependency rules
- Keep runtime prompt assembly inside the dedicated prompt services.
- Do not introduce new fallback contracts while removing old ones.
- If a rollout/evidence module still powers a live admin/debug API, keep the behavior stable unless the entire surface is explicitly removed in this pass.

## Data migration (if applicable)
- No database migration is planned for this follow-up.
- Backward compatibility strategy: none for deleted runtime compatibility branches; explicit invariant failures are preferred over silent fallback.

## Non-functional considerations
- Security/auth/permissions: no auth model change expected.
- Performance: neutral; deleting fallback code should reduce branching.
- Observability (logs/metrics/traces): if explicit invariants replace silent fallback, preserve actionable error messages for debugging.

## Open questions
- None for this pass.
