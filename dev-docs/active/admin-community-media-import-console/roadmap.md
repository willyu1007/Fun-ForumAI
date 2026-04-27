# T-302 — Admin And Community Media Import Console Roadmap

## Goal
- Add online media import flows in the admin console and community management surfaces so operators can import images into existing platform/community media pools without changing the database schema or the established media domain chain.

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed; user explicitly requested task package and roadmap alignment
- Host plan artifact path(s): (none)
- Requirements baseline: current chat discussion and existing media task docs
- Merge method: set-union
- Conflict precedence: latest user-confirmed > existing repo task docs > model inference
- Repository SSOT output: `dev-docs/active/admin-community-media-import-console/roadmap.md`
- Mode fallback used: non-Plan default applied: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | current chat | task ID `T-302`, online import goal, no DB/linkage change, roadmap-first alignment | highest | User wants a task package first, then requirements alignment from the roadmap. |
| Existing media hardening task | `dev-docs/active/media-v1-hardening-contract-lineage-cutover/00-overview.md` | media chain constraints and route naming posture | high | Confirms the media chain and no legacy route fallback posture. |
| Existing media injection task | `dev-docs/archive/media-injection-catalog-and-retrieval-v1/00-overview.md` | existing import scaffolding, target source kinds, retrieval/catalog boundaries | high | Confirms `MediaAsset` remains SoT and import should reuse existing scaffolding where practical. |
| Existing media domain foundation task | `dev-docs/archive/visual-media-domain-foundation-and-v1-semantics-correction/00-overview.md` | owner upload semantics and `post_media` compatibility boundary | high | Confirms `asset -> snapshot -> binding -> projection` is the main chain. |
| Source inspection | `src/backend/media/*`, `src/backend/routes/admin/admin-media-routes.ts`, `src/backend/routes/agent-control.ts`, `src/frontend/*` | available services/routes/UI extension points | medium | Used only to avoid inventing implementation paths. |
| Model inference | N/A | fill small planning gaps | lowest | Captured as assumptions where product choices are still open. |

## Non-goals
- Do not change Prisma schema, migrations, or normalized DB context.
- Do not replace or bypass `MediaAsset -> MediaSemanticSnapshot -> SceneMediaBinding -> MediaContextProjection`.
- Do not build a full DAM/media asset management system in this task.
- Do not change planner/generation/retrieval semantics beyond making imported assets available through existing pool registration paths.
- Do not expose unaudited public upload endpoints.
- Do not add destructive media deletion or bulk lifecycle operations.

## Open questions and assumptions
### Open questions (answer before execution)
- (none)

### Resolved questions
- Q1: Community media import is admin-only in phase 1. The repo currently has human auth roles `user | admin`; `RoleAssignment` is agent/stage role assignment, not a human community operator permission model.
- Q2: Both community commons and platform/global media imports default `allow_quote_original=false`. The import UI must include an explicit switch for enabling direct original reuse.
- Q3: Phase 1 includes DB-backed simple pool asset lists plus lightweight usage summaries. It does not include full DAM workflows, complex graph UI, bulk operations, deletion, or trend analytics.
- Q4: Phase 1 supports both file upload and URL import for platform/global and community media imports. URL import is admin-only, reuses existing remote image validation, and keeps direct original reuse disabled by default.
- Q5: Imported assets are immediately visible in the management UI after asset/snapshot/pool/policy persistence. Planner/retrieval consumption should use existing indexing paths: the import flow should attempt to build existing catalog/retrieval documents, mark assets consumable only when retrieval/index status is ready, and surface pending/failed status without inventing new persistence.

### Standing implementation assumptions
- A4: The feature reuses existing service methods and workers where possible; any missing orchestration is a thin online service wrapper. (risk: low)
- A5: No DB schema change is allowed; if a desired UX requires persistent import session metadata beyond existing media records/jobs, defer that UX. (risk: medium)

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | Data model scope | Rich import UX could benefit from new tables vs user explicitly says no DB changes | No DB/schema changes | Latest user-confirmed constraint | Keep any missing history/listing as deferred. |
| C2 | Media chain | One-step upload could bypass media chain vs existing media tasks require media SoT chain | Reuse existing media chain and pool registration | Existing repo architecture plus user says no chain change | Implement only orchestration/API/UI around current services. |
| C3 | Project media naming | User said project images earlier, then clarified admin console and community management import | Treat "project/platform" import as platform canonical/admin-console import in T-302 | Latest user-confirmed scope | Revisit if a separate Project domain is introduced later. |
| C4 | Platform canonical quote default | Initial roadmap assumption allowed platform original quote by default vs user confirmed default false for both global and community | Default `allow_quote_original=false` for both surfaces | Latest user-confirmed instruction | Add explicit UI switch for enabling original quote. |
| C5 | History list scope | Minimal import result panel vs user wants DB-backed full data visibility | Include simple DB-backed pool list and lightweight usage summary | Latest user-confirmed instruction | Keep full DAM, graph UI, and bulk operations out of scope. |
| C6 | URL import scope | Upload-only would reduce risk vs user confirmed URL import is acceptable | Include URL import in phase 1 for both surfaces | Latest user-confirmed instruction | Keep admin-only, validate URL image, show source/authorization prompt in UI. |
| C7 | Planner/retrieval eligibility | Immediate pool registration alone vs user wants correctly consumable media | Persist asset/snapshot/pool/policy immediately and use existing retrieval/index status as the planner-consumption gate | Latest user-confirmed instruction plus existing retrieval architecture | UI must show retrieval/index status instead of assuming planner eligibility. |

## Scope and impact
- Affected areas/modules:
  - Backend admin media routes and validation.
  - Media service orchestration around managed asset ingestion and pool registration.
  - Frontend admin console media surface.
  - Frontend community management surface.
  - API/context docs if new endpoints are added.
- External interfaces/APIs:
  - Admin-only upload and URL import endpoints for platform canonical media.
  - Admin-only upload and URL import endpoints for community commons media.
  - Admin-only list endpoints for platform canonical and community commons pool assets, including lightweight usage summary.
  - Optional existing-asset registration UI over existing endpoints.
- Data/storage impact:
  - No schema changes.
  - New rows may be written to existing `media_assets`, `media_semantic_snapshots`, `scene_media_bindings`, `media_reuse_policies`, and existing projection/index artifacts as already supported.
  - New objects may be written to existing media storage.
- Backward compatibility:
  - Existing agent media upload, media generation, import CLI, and public read paths remain unchanged.
  - Existing admin pool registration endpoints remain available.

## Consistency baseline for dual artifacts
- [x] Goal is semantically aligned with current user instructions.
- [x] Boundaries/non-goals are aligned with the no-DB/no-chain-change constraint.
- [x] Constraints are aligned with existing media architecture docs.
- [x] Milestones/phases ordering is aligned to roadmap-first execution.
- [x] Acceptance criteria are aligned to online import closure.
- Intentional divergences:
  - (none)

## Project structure change preview (may be empty)
This section is a non-binding, early hypothesis to help humans confirm expected project-structure impact.

### Existing areas likely to change (may be empty)
- Modify:
  - `src/backend/routes/admin/`
  - `src/backend/media/`
  - `src/backend/services/`
  - `src/frontend/features/admin/`
  - `src/frontend/api/`
  - `docs/context/api/`
  - `dev-docs/active/admin-community-media-import-console/`
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - Backend thin orchestration service for online media import.
  - Frontend reusable import panel for platform/community media pools.
- New interface(s)/API(s):
  - `POST /v1/admin/media/platform-canonical/imports/upload`
  - `POST /v1/admin/media/platform-canonical/imports/url`
  - `POST /v1/admin/communities/{communityId}/media/commons/imports/upload`
  - `POST /v1/admin/communities/{communityId}/media/commons/imports/url`
- New file(s) (optional):
  - Exact filenames to be decided during implementation discovery.

## Phases
1. **Phase 1: Roadmap and requirements lock**
   - Deliverable: T-302 task package and roadmap reviewed with the user.
   - Acceptance criteria: open questions are answered or explicitly accepted as assumptions.
2. **Phase 2: Backend online import orchestration**
   - Deliverable: admin/community import endpoints that create/import an asset and register it into the correct pool.
   - Acceptance criteria: upload and URL import write existing media records, pool binding, policy, and return a consumable view.
3. **Phase 3: Admin console import UI**
   - Deliverable: platform canonical import panel and simple asset list in the admin console.
   - Acceptance criteria: admin can import via upload/URL and see asset ID, preview, policy, usage summary, and result status.
4. **Phase 4: Community management import UI**
   - Deliverable: community commons import panel and simple asset list scoped to one community.
   - Acceptance criteria: admin can import into a selected community, choose whether to allow direct original reuse through an explicit switch, and confirm the asset is registered to that community commons pool with usage summary visible.
5. **Phase 5: Verification and release readiness**
   - Deliverable: targeted backend/frontend tests, manual smoke checklist, context docs sync if API changes are added.
   - Acceptance criteria: no DB migration is generated; existing media tests and new import tests pass.

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 — Discovery
- Objective: confirm exact backend service boundaries, existing admin UI routing, and reusable frontend API hook patterns.
- Deliverables:
  - Short implementation note listing final endpoints, route files, service methods, and UI landing points.
- Verification:
  - Confirm no Prisma schema changes are needed.
  - Confirm existing services can create managed assets and register pool policies.
- Rollback:
  - N/A; no product code changes.

### Phase 1 — Requirements Lock
- Objective: close roadmap open questions and freeze phase-1 behavior.
- Deliverables:
  - Updated roadmap and task docs with answered questions.
- Verification:
  - User explicitly approves phase-1 defaults for permissions, `allow_quote_original`, URL import, and listing scope.
- Rollback:
  - Revert documentation edits only.

### Phase 2 — Backend Import API
- Objective: add online import endpoints without changing storage schema or media chain.
- Deliverables:
  - Upload and URL import endpoints for platform canonical and community commons.
  - List endpoints for platform canonical and community commons pool assets.
  - Input validation, admin auth, error mapping, and response serialization.
  - Tests for success, auth failure, invalid payload, oversized/unsupported image, and pool registration.
- Verification:
  - Targeted route/service tests.
  - Existing media asset/control tests remain green.
- Rollback:
  - Remove new route registrations and service wrapper; existing pool registration endpoints remain unaffected.

### Phase 3 — Admin Console UI
- Objective: expose platform canonical import as an operator workflow.
- Deliverables:
  - Admin media page panel with upload/URL mode, preview, import button, result state, and error state.
  - Simple DB-backed asset list with preview, policy state, creation time, usage counts, and latest usage timestamp.
  - API hooks/types for new responses.
- Verification:
  - Component tests for mode switching, validation, successful result rendering, and failure rendering.
  - Manual smoke in local admin console.
- Rollback:
  - Hide/remove new panel and leave backend endpoints disabled/unlinked if needed.

### Phase 4 — Community Management UI
- Objective: expose community-scoped commons import where operators manage communities.
- Deliverables:
  - Community media import panel scoped by `communityId`.
  - Explicit `allow_quote_original` switch defaulting off.
  - Simple DB-backed community asset list showing `asset_id`, community scope, policy mode, preview URL, and usage summary.
- Verification:
  - Component/API tests for community-scoped request construction and result display.
  - Manual smoke that imported asset registers into `community_commons:<communityId>`.
- Rollback:
  - Remove community panel; platform admin import remains independent.

### Phase 5 — Context, Verification, and Handoff
- Objective: finish documentation and regression checks.
- Deliverables:
  - OpenAPI/api-index updated if new endpoints are contract-tracked.
  - Verification log and implementation notes updated.
- Verification:
  - `pnpm typecheck`
  - targeted backend tests for admin media import
  - targeted frontend tests for import panels
  - context verification if OpenAPI changes are made
- Rollback:
  - Revert endpoint/UI commits; no DB rollback needed.

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - Targeted backend route/service tests for new import endpoints.
  - Targeted backend route/service tests for pool asset listing and usage summary.
  - Targeted frontend component/hook tests for admin/community import panels.
  - Existing media governance/service tests affected by orchestration.
- Manual checks:
  - Admin imports an image into platform canonical and sees preview/result.
  - Admin imports an image into one community commons pool and confirms the result references that community.
  - Invalid file type, oversized file, empty URL, invalid/unsupported remote URL, and auth failure display correct errors.
- Acceptance criteria:
  - No Prisma schema or migration changes.
  - New online import flows reuse existing media asset, snapshot, binding, policy, and storage services.
  - Both platform/global and community imports default to no direct original reuse unless an admin explicitly enables it.
  - Pool asset lists are DB-backed and include lightweight usage summary without introducing new persistence.
  - Platform canonical import and community commons import are both closed-loop from UI action to persisted consumable asset.
  - Imported assets are available to existing consumers through current pool/reuse mechanisms, with planner/retrieval eligibility gated by existing retrieval/index readiness.
  - Existing admin pool registration endpoints continue to work.

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| URL import introduces external content/copyright risk | medium | medium | default conservative policy for community commons; expose source URL and policy result | route tests and manual review | disable URL panel or endpoint |
| UI expects historical listing not available without new queries | medium | low | phase 1 shows import result and existing registration only; defer full library listing | roadmap Q3 | remove/defer list UI |
| Import writes asset but pool registration fails | low | medium | orchestrate with clear error and test partial-failure behavior; prefer transaction if repo boundary supports it | route/service tests | archive/block orphaned asset manually if needed |
| Existing media semantic extraction may be slow | medium | medium | show pending/busy state; keep first phase synchronous only if acceptable | manual smoke latency | move semantic completion to existing async import worker in follow-up |
| API contract drift from docs/context | medium | medium | update OpenAPI and regenerate index when endpoints are finalized | context verification | revert contract and route edits together |
| Usage summary becomes a full analytics feature | medium | low | keep summary to counts/latest timestamps and lineage link | scope review | remove analytics fields from phase 1 |

## Optional detailed documentation layout (convention)
The task package uses the repository convention:

```
dev-docs/active/admin-community-media-import-console/
  .ai-task.yaml
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
  06-execution-runbook.md
  07-coverage-and-contract-review.md
```

Suggested mapping:
- The roadmap's Goal/Non-goals/Scope -> `00-overview.md`
- The roadmap's Phases -> `01-plan.md`
- The roadmap's Architecture direction -> `02-architecture.md`
- Decisions/deviations during execution -> `03-implementation-notes.md`
- The roadmap's Verification -> `04-verification.md`
- File-level execution sequence and rollback -> `06-execution-runbook.md`
- Requirement coverage, gaps, and process review gates -> `07-coverage-and-contract-review.md`

## To-dos
- [x] Confirm open questions with the user.
- [x] Lock phase-1 permissions and default reuse policy.
- [x] Confirm URL import ships in phase 1.
- [x] Confirm historical listing and usage summary scope.
- [x] Draft execution runbook.
- [x] Review requirement coverage and close execution-level gaps.
- [ ] Start implementation after execution runbook confirmation.
