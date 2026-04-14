# T-201 — LLM Matrix Refresh And Media Fallback V1 Roadmap

## Goal
- Refresh the repository LLM/media model matrix to the new provider lineup, converge hidden director and vision routing on a maintainable set of models, and prepare a controlled path for image-generation failover and provider-specific request extensions.

## Planning-mode context and merge policy
- Runtime mode signal: `Default`
- User confirmation when signal is unknown: `not-needed`
- Host plan artifact path(s): `(none)`
- Requirements baseline: `(none)`
- Merge method: `set-union`
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/llm-matrix-refresh-and-media-fallback-v1/roadmap.md`
- Mode fallback used: `non-Plan default applied: no`

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | current chat | target provider/model matrix, `HY-2.0`, `Seedream 5.0 Lite`, roadmap-first workflow | highest | includes explicit removals (`qwen-deep-research`, `M2-her`, `seed-character`) |
| Existing task context | `dev-docs/active/provider-runtime-alignment-and-model-activation-v1/` | current registry/runtime baseline | high | establishes present gateway constraints and prior provider activation work |
| Repository runtime evidence | `.ai/llm-config/registry/*`, `src/backend/llm/*`, `src/backend/media/*` | exact file impact and migration scope | high | used to avoid inventing modules/contracts |
| Web research | official provider docs | model/API compatibility, staging mapping feasibility | medium | used to validate assumptions, not to override repo facts |
| Model inference | N/A | phase ordering and fallback framing | lowest | used only where repo/user did not specify an answer |

## Non-goals
- Do not implement the code changes in this planning bundle.
- Do not introduce new voice lines or new external providers.
- Do not create a dedicated Doubao voice line in this round; Doubao remains a provider/model option inside existing voice-line families.
- Do not add `qwen-deep-research`, `M2-her`, or `seed-character`.
- Do not commit to unrestricted raw `extra_body` passthrough.
- Do not treat image-generation product docs as proof of vision-understanding compatibility.
- Do not perform live staging/provider validation in this bundle beyond documented follow-up checks.

## Open questions and assumptions
### Open questions (answer before execution)
- Q3: Which exact upstream IDs should be used for `qwen3.5-flash`, `glm-5.1`, and `glm-4.7-flash` in registry files after the final vendor-side confirmation pass?

### Assumptions (if unanswered)
- A1: Phase 1-3 proceed first; typed provider extensions stay out of the first implementation pass and remain a gated follow-up. (risk: low)
- A2: `kimi-k2.5` follows the conservative rollout path and stays outside active visible production lanes until typed provider extensions exist. (risk: low)
- A3: `qwen3.5-plus` becomes the hidden director primary model for digest/plan/vision lanes. (risk: low)
- A4: Vision semantic extraction uses `qwen3.5-plus` primary and `qwen3.5-flash` fallback instead of `qwen-image-2.0`. (risk: low)
- A5: Director text fallback uses `glm-5.1`, and director vision fallback stays fixed on `qwen3.5-flash`. (risk: low)
- A6: `hunyuan-2.0-instruct-20251111` stays out of visible same-profile challenger ordering in this round. (risk: low)
- A7: Image generation uses Ark `Seedream 5.0 Lite` as primary and DashScope `qwen-image-2.0` as fallback via separate gateways. (risk: medium)
- A8: Doubao stays inside existing visible/hidden voice-line profiles and does not become a first-class `voice_line_id` in this round. (risk: low)

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | Vision semantic model | old repo `qwen-vl-*` vs current migration goal | move to `qwen3.5-plus` primary | latest user-confirmed direction plus current compatibility discussion | validate schema stability during implementation |
| C2 | Director line primary | existing hidden line name references `deepseek` vs current desired matrix | use `qwen3.5-plus` as hidden director primary | latest user-confirmed discussion and maintainability | confirm final fallback ordering |
| C3 | Image generation fallback | current single Ark gateway vs desired two-provider failover | plan new fallback router/gateway layer | user-confirmed goal overrides current single-provider design | implement in dedicated media slice |
| C4 | Provider-specific extensions | current runtime has no `extra_body` support vs Kimi/provider needs | plan typed provider extensions, not raw passthrough | architecture safety and prior discussion | decide phase 4 in alignment review |
| C5 | Director fallback ordering | `glm-5.1` vs `deepseek-chat` for text fallback | use `glm-5.1` as text fallback and `qwen3.5-flash` as vision fallback | latest user-confirmed instruction | reflect in final execution matrix |
| C6 | Kimi rollout posture | immediate conservative single-model use vs deferred rollout | defer active visible rollout until typed provider extensions exist | latest user-confirmed conservative direction | keep as follow-up work |
| C7 | HY-2.0 visible challenger posture | keep HY-2.0 visible challengers vs hold out of same-profile ordering | keep `hunyuan-2.0-instruct-20251111` out of same-profile challenger ordering for this round | latest user-confirmed instruction | update final execution matrix and registry migration plan |
| C8 | Doubao integration shape | add a dedicated Doubao voice line vs keep Doubao inside existing lines | do not add a Doubao voice line in this round; keep Doubao as provider/model inventory inside existing routing profiles | latest user-confirmed instruction plus repo impact review | keep implementation registry-first and avoid cross-cutting voice-line changes |

## Scope and impact
- Affected areas/modules:
  - LLM registry (`.ai/llm-config/registry/*`)
  - LLM gateway/runtime (`src/backend/llm/*`)
  - media generation routing (`src/backend/media/*`)
  - env/docs (`env/contract.yaml`, `docs/env.md`)
- External interfaces/APIs:
  - DashScope OpenAI-compatible text/vision
  - ZAI OpenAI-compatible text
  - Moonshot OpenAI-compatible text
  - MiniMax OpenAI-compatible text
  - Tencent Hunyuan OpenAI-compatible text
  - DeepSeek OpenAI-compatible text
  - Ark image-generation API
  - DashScope image-generation API
- Data/storage impact:
  - no schema migration expected
  - usage/cost estimation changes due to model/pricing registry updates
  - media generation job metadata will reflect new provider/model fallback paths
- Backward compatibility:
  - visible/hidden routing behavior will change
  - observability, pricing, and provider-admission expectations must be updated together

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with host plan artifact
- [x] Boundaries/non-goals are aligned
- [x] Constraints are aligned
- [x] Milestones/phases ordering is aligned
- [x] Acceptance criteria are aligned
- Intentional divergences:
  - (none)

## Project structure change preview (may be empty)
This section is a **non-binding, early hypothesis** to help humans confirm expected project-structure impact.

### Existing areas likely to change (may be empty)
- Modify:
  - `.ai/llm-config/registry/`
  - `src/backend/llm/`
  - `src/backend/media/`
  - `env/`
  - `docs/`
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/media/` fallback gateway/router module(s)
  - `src/backend/llm/` typed provider extension support module(s)
- New interface(s)/API(s) (when relevant):
  - typed provider-extension contract for OpenAI-compatible requests
- New file(s) (optional):
  - `src/backend/media/dashscope-qwen-image-gateway.ts`
  - `src/backend/media/fallback-media-generation-gateway.ts`

## Phases
1. **Phase 0: Final Matrix Lock**
   - Deliverable: agreed provider/model target matrix with explicit in-scope and deferred items
   - Acceptance criteria: roadmap alignment review closes all blocking open questions for phase 1
2. **Phase 1: Registry Migration**
   - Deliverable: all LLM registries updated to the new model lineup
   - Acceptance criteria: registry validation passes and callsite/profile expectations match the new matrix
3. **Phase 2: Director/Vision Convergence**
   - Deliverable: hidden director and vision routes converge on the chosen primary/fallback models
   - Acceptance criteria: hidden lanes reference the agreed director/vision matrix and tests cover route selection
4. **Phase 3: Media Generation Failover**
   - Deliverable: media generation supports primary Ark + DashScope fallback
   - Acceptance criteria: fallback logic is test-covered and configuration expresses both providers cleanly
5. **Phase 4: Typed Provider Extensions (Optional/Gated)**
   - Deliverable: controlled provider-specific request extensions for models that require them
   - Acceptance criteria: no raw passthrough; typed schema + tests + backward-compatible defaults

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 — Discovery and lock
- Objective: freeze the exact target matrix and sequence.
- Deliverables:
  - final provider/model matrix table
  - confirmed exact upstream IDs where still pending
  - explicit lock that no new Doubao `voice_line_id` will be introduced in this round
- Verification:
  - roadmap review with explicit sign-off on open questions
  - no unresolved blocking assumption remains for registry migration
- Rollback:
  - N/A

### Phase 1 — Registry migration
- Objective:
  - replace the current candidate matrix, pricing, capabilities, and admission metadata with the new lineup.
- Deliverables:
  - updated `model_profiles.yaml`
  - updated `credential_pools.yaml`
  - updated `model_capabilities.yaml`
  - updated `model_pricing.yaml`
  - updated `provider_admission.yaml`
  - regenerated routing artifact(s)
- Verification:
  - registry validation script passes
  - targeted LLM registry/gateway tests pass
  - no stale removed model IDs remain in registry-owned files
- Rollback:
  - revert registry-only changes and regenerate artifacts

### Phase 2 — Director and vision convergence
- Objective:
  - re-anchor hidden digest/director/vision paths on the agreed maintainable models.
- Deliverables:
  - hidden `qwen-director-v1` profiles updated
  - `vision_summary` candidate set updated
  - callsite inventory expectations aligned where needed
- Verification:
  - hidden/vision routing tests pass
  - media semantic tests confirm schema-compatible outputs
- Rollback:
  - restore prior hidden/vision profiles without touching visible matrix

### Phase 3 — Media generation failover
- Objective:
  - replace the single-provider media generation path with ordered primary/fallback generation routing.
- Deliverables:
  - primary Ark `Seedream 5.0 Lite` gateway retained/updated
  - DashScope `qwen-image-2.0` fallback gateway added
  - composite fallback gateway/router wired into media generation service
  - config/env/docs updated to represent primary + fallback generation
- Verification:
  - media generation unit tests cover primary success, primary failover success, dual failure
  - observability/job metadata reflect selected provider/model
- Rollback:
  - revert to single Ark generation gateway

### Phase 4 — Typed provider extensions (gated)
- Objective:
  - support provider-specific request controls without opening raw JSON passthrough.
- Deliverables:
  - typed provider extension fields in gateway/runtime contracts
  - adapter translation for supported providers
  - safe defaults preserving existing providers
- Verification:
  - LLM client/provider tests cover extension serialization
  - unsupported extension use fails clearly at planning/runtime boundaries
- Rollback:
  - disable extension fields and preserve registry migration/media fallback outcome

### Deferred posture for this round
- Phase 4 is explicitly deferred unless implementation of phases 1-3 proves it is unavoidable.
- `kimi-k2.5` remains out of active visible production lanes in this round.
- `hunyuan-2.0-instruct-20251111` remains out of visible same-profile challenger ordering in this round.
- Doubao remains part of existing routing profiles and does not become a standalone voice line in this round.
- Director hidden lanes should plan around:
  - primary text/vision: `qwen3.5-plus`
  - text fallback: `glm-5.1`
  - vision fallback: `qwen3.5-flash`

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - `pnpm test -- src/backend/llm/__tests__/registry-contract.test.ts`
  - `pnpm test -- src/backend/llm/__tests__/llm-gateway.test.ts`
  - `pnpm test -- src/backend/media/__tests__/media-semantic-service.test.ts`
  - `pnpm test -- src/backend/media/__tests__/media-generation-service.test.ts`
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
- Manual checks:
  - inspect generated routing artifact diff
  - run a dev image-generation smoke with Ark primary
  - run a controlled fallback smoke for DashScope generation after primary failure injection
- Acceptance criteria:
  - all removed models disappear from active routing registries
  - new matrix is fully represented across profile/capability/pricing/admission layers
  - director and vision lanes use the agreed target models
  - media generation expresses primary/fallback providers explicitly
  - staged provider-specific extension work is either implemented safely or explicitly deferred

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| Exact upstream model IDs differ from current assumptions | medium | high | reserve a final vendor-ID confirmation step before editing registries | registry validation or live probes fail with invalid model IDs | revert registry changes and restore prior IDs |
| Vision semantic outputs drift after moving off prior `qwen-vl-*` models | medium | high | keep schema-focused tests and add fallback to `qwen3.5-flash` | media semantic parsing/tests fail | restore prior vision profile candidates |
| Kimi or other providers need request-shape controls that current runtime lacks | high | medium | gate provider extensions as a separate phase with typed contract | provider requests fail or return validation errors | keep provider out of active lanes until extensions land |
| Media failover adds observability/lineage inconsistency | medium | medium | centralize provider selection in a composite gateway | media generation tests show wrong provider/model/job metadata | revert to single gateway |

## Optional detailed documentation layout (convention)
If you maintain a detailed dev documentation bundle for the task, the repository convention is:

```
dev-docs/active/llm-matrix-refresh-and-media-fallback-v1/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

Suggested mapping:
- The roadmap's **Goal/Non-goals/Scope** → `00-overview.md`
- The roadmap's **Phases** → `01-plan.md`
- The roadmap's **Architecture direction (high level)** → `02-architecture.md`
- Decisions/deviations during execution → `03-implementation-notes.md`
- The roadmap's **Verification** → `04-verification.md`

## To-dos
- [ ] Confirm final target matrix and exact unresolved model IDs
- [ ] Confirm whether typed provider extensions are in-scope for this round
- [ ] Confirm director-line fallback ordering
- [ ] Confirm media generation fallback contract and env shape
- [ ] Confirm verification sequence and rollback boundaries
