# Forum Semantic And LLM Runtime Residual Closeout — Roadmap

## Goal
- Close the remaining real semantic/governance drift and the remaining adapter/runtime truth-source drift without introducing a new long-lived compatibility layer.

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed
- Host plan artifact path(s): (none)
- Requirements baseline: (none)
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/forum-semantic-and-llm-runtime-residual-closeout/roadmap.md`
- Mode fallback used: non-Plan default applied: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | chat plan + implementation request | goal, scope, ordering, cutover policy | highest | hard decisions already locked |
| Existing task bundles | `T-142`, `T-145`, `T-146`, `T-901` | prior ownership and residual gaps | high | used as historical baseline only |
| Existing roadmap | (none) | N/A | medium | N/A |
| Model inference | N/A | fill implementation gaps only | lowest | only after repo inspection |

## Non-goals
- Introduce a new public API version.
- Preserve old creator-community slug entrypoints.
- Deliver a real native-provider runtime implementation.
- Change the unrelated `T1..T5` agent stage-tier system.

## Open questions and assumptions
### Open questions (answer before execution)
- None. User decisions are already locked.

### Assumptions (if unanswered)
- Existing external clients can tolerate removal of `/v1` legacy semantic fields after the repo-internal cutover. (risk: medium)
- Search and analytics backfill can be driven by repo-local scripts/tests without requiring new product-surface feature flags. (risk: low)

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | Creator-community slug strategy | old launch slug vs canonical family naming | hard-rename to `creator-recommendation` / `creator-relationship` | latest user-confirmed instruction | none |
| C2 | Public API compat | long-lived legacy mapping vs staged deletion | two-stage removal in-place on `/v1` | latest user-confirmed instruction | none |
| C3 | LLM runtime target | patch current debt only vs native-ready boundary | adapter-first execution plus native-ready interface | latest user-confirmed instruction | none |

## Scope and impact
- Affected areas/modules: shared semantic taxonomy, launch config loaders, stage/governance services, Prisma schema/migrations, read API, search/analytics projections, forum/search frontend surfaces, LLM gateway/runtime.
- External interfaces/APIs: `/v1` read payloads, community slugs in links/routes, LLM execution telemetry fields.
- Data/storage impact: Prisma migration plus semantic backfill for community proposal, incubation, viewer analytics, and search docs.
- Backward compatibility: intentionally time-boxed; repo-internal compatibility during migration only.

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with host plan artifact
- [x] Boundaries/non-goals are aligned
- [x] Constraints are aligned
- [x] Milestones/phases ordering is aligned
- [x] Acceptance criteria are aligned
- Intentional divergences:
  - Historical tasks marked `done` remain unchanged; this task is a residual closeout layer.

## Project structure change preview (may be empty)
### Existing areas likely to change (may be empty)
- Modify:
  - `src/shared/`
  - `src/backend/launch/`
  - `src/backend/services/`
  - `src/backend/routes/`
  - `src/backend/repos/`
  - `src/backend/llm/`
  - `src/frontend/features/`
  - `config/launch/`
  - `prisma/`
- Delete:
  - (none)
- Move/Rename:
  - `<TBD>` schema fields and config keys during cutover

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `prisma/migrations/*`
- New interface(s)/API(s) (when relevant):
  - adapter runtime interface under `src/backend/llm/`
- New file(s) (optional):
  - targeted migration/backfill helpers only if existing scripts are insufficient

## Phases
1. **Phase 1**: Semantic and governance truth-source cutover
   - Deliverable: canonical slugs, canonical governance fields, schema/migration chain, backend services no longer depending on `t4*` truth fields
   - Acceptance criteria: backend/service/repo paths are canonical-first and DB writes no longer emit legacy semantic fields
2. **Phase 2**: Read-model, UI, and public API cleanup
   - Deliverable: canonical-only domain/read models, UI surfaces aligned, legacy `/v1` response fields removed
   - Acceptance criteria: forum/search surfaces and read API no longer expose `is_t4` or `editorial_shelf`
3. **Phase 3**: LLM adapter/runtime closeout
   - Deliverable: adapter-first execution path and stronger registry validation
   - Acceptance criteria: gateway executes via adapter binding, not direct `gateway_kind` dispatch

## Step-by-step plan (phased)
### Phase 0 — Discovery
- Objective: confirm residual drift inventory and reuse the smallest safe set of existing contracts/tests.
- Deliverables:
  - residual task bundle
  - route/component inventory for semantic and LLM changes
- Verification:
  - governance sync succeeds
  - initial grep inventory matches expected drift points
- Rollback:
  - N/A

### Phase 1 — Semantic and Governance Cutover
- Objective:
  - remove legacy creator/T4 business truth from config, services, repo types, and DB schema
- Deliverables:
  - renamed slugs
  - renamed config/schema keys
  - migration/backfill for proposal/incubation/view-event data
- Verification:
  - targeted backend/governance tests pass
  - migration SQL reflects canonical columns
- Rollback:
  - revert migration and canonical service changes together

### Phase 2 — Read-model and UI Cleanup
- Objective:
  - make canonical semantics the only runtime/read-model truth and align author identity/proof rendering
- Deliverables:
  - read API payload cleanup
  - search/read projection cleanup
  - UI rendering split for identity vs proof
- Verification:
  - read/search/frontend tests pass
  - grep shows no runtime/public response references to removed legacy fields
- Rollback:
  - restore response adapter layer before reintroducing UI mixed rendering

### Phase 3 — LLM Runtime Closeout
- Objective:
  - make adapter binding the execution truth-source while keeping runtime native-ready
- Deliverables:
  - provider runtime interface
  - openai-compatible adapter implementation
  - stronger direct fallback validation
- Verification:
  - registry validator passes
  - LLM gateway/adaptor tests pass
- Rollback:
  - restore prior gateway-to-client dispatch while keeping validation tightening isolated if needed

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm exec tsc --noEmit`
- Automated tests:
  - targeted Vitest suites for stage/governance/read/search/ui/llm
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs --strict`
- Manual checks:
  - inspect `/c/<slug>` targets and read API payload shapes
- Acceptance criteria:
  - repo no longer uses legacy creator/T4 truth fields in mainline runtime
  - public author rendering separates identity and proof
  - read/search/analytics no longer emit legacy semantic fields
  - gateway execution plan records actual adapter-driven execution

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| Cross-cutting rename breaks launch config or tests | medium | high | cut over shared taxonomy and loaders first | targeted launch/governance tests | revert shared/config/migration change set |
| DB migration/backfill leaves stale data paths | medium | high | expand/contract with explicit repository cutover and targeted assertions | migration review + repo tests | revert migration before Phase 2 hard deletion |
| LLM adapter refactor changes runtime behavior | medium | high | preserve existing openai-compatible request shape and exhaustively test | llm-gateway/adaptor tests | restore prior dispatch path |

## Optional detailed documentation layout (convention)
If you maintain a detailed dev documentation bundle for the task, the repository convention is:

```
dev-docs/active/forum-semantic-and-llm-runtime-residual-closeout/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

## To-dos
- [x] Confirm planning-mode signal handling and fallback record
- [x] Confirm input sources and trust levels
- [x] Confirm merge decisions and conflict log entries
- [x] Confirm open questions
- [x] Confirm phase ordering and DoD
- [x] Confirm verification/acceptance criteria
- [x] Confirm rollout/rollback strategy
