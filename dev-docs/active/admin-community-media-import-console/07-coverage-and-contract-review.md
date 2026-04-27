# 07 Coverage And Contract Review — admin-community-media-import-console (T-302)

## Review Verdict

T-302 covers the approved product goal after the closure actions in this review. The task package is implementation-ready once this review is accepted.

The implementation MUST still pass each slice review gate in `06-execution-runbook.md` before moving to the next slice. This is required because T-302 spans API contract, backend media chain, frontend workflow, and context artifacts.

## Requirement Coverage Matrix

| Requirement / Goal | Covered by | Status | Notes |
|---|---|---|---|
| Add online import in admin console | `01-plan.md` Phase 3, `06-execution-runbook.md` Slice 3 | covered | Route is `/admin/media-assets`. |
| Add online import in community management | `01-plan.md` Phase 4, `06-execution-runbook.md` Slice 4 | covered | Landing point is `/c/:slug/settings`. |
| Support upload import | `02-architecture.md` API boundary, `06-execution-runbook.md` Slice 1 | covered | Uses multipart `file`. |
| Support URL import | `02-architecture.md` API boundary, `06-execution-runbook.md` Slice 1 | covered | Uses existing HTTPS/remote image validation. |
| Do not change DB schema | `00-overview.md`, `02-architecture.md`, `06-execution-runbook.md` | covered | Verification must check no Prisma schema/migration changes. |
| Do not change media chain | `00-overview.md`, `02-architecture.md`, `06-execution-runbook.md` | covered | Existing asset/snapshot/binding/policy/retrieval chain remains canonical. |
| Admin-only phase 1 | `roadmap.md` Q1, `02-architecture.md` Permissions | covered | No community operator role is introduced. |
| Default `allow_quote_original=false` | `roadmap.md` Q2, `02-architecture.md`, `06-execution-runbook.md` | covered | Applies to platform/global and community imports. |
| Explicit reusable-original UI switch | `01-plan.md`, `06-execution-runbook.md` | covered | Switch defaults off on both surfaces. |
| DB-backed list/history | `roadmap.md` Q3, `02-architecture.md` Listing | covered | Simple pool list only, not full DAM. |
| Usage visibility | `02-architecture.md`, `06-execution-runbook.md` | covered after review | Counts/latest timestamps only. |
| Correct media consumption | `roadmap.md` Q5, `02-architecture.md`, `06-execution-runbook.md` | covered after review | Planner eligibility is gated by existing retrieval/index readiness. |
| API docs same implementation batch | `01-plan.md`, `06-execution-runbook.md` | covered after review | Same batch, but contract is edited first inside the slice. |

## Gaps Found And Closure Actions

| Gap | Risk | Closure action | Owner slice |
|---|---|---|---|
| `operator_note` was listed as a possible request field, but there is no approved durable persistence for it. | Contract could promise a field the system cannot list or audit without DB changes. | Remove it from the stable phase-1 request contract. A future note/audit field is deferred unless existing records can carry it without changing persistence. | Slice 1 |
| OpenAPI/context timing said "same batch" but did not state intra-batch ordering. | Route and docs could drift during implementation. | Require this order inside Slice 1: OpenAPI draft -> OpenAPI verify -> backend implementation -> API index generation -> context verify. | Slice 1 |
| Community settings import flow did not define how imported media affects banner/avatar selection. | Import might succeed but not support the visible management workflow. | Imported community media becomes selectable for the active visual target by `media_url`; it does not auto-apply until the existing community surface save flow is used. | Slice 4 |
| Retrieval readiness was conceptual but not precise enough for tests. | UI could mark assets consumable before planner can retrieve them. | Define exact statuses: `ready`, `pending`, `failed`, based on existing retrieval documents and embedding snapshots. | Slice 1 / Slice 2 |
| Existing platform canonical registration currently enables quote-original by default. | New default policy would be violated for global/platform media. | Add explicit `allow_quote_original` input to platform registration and update callers/tests so T-302 paths default false. | Slice 1 / Slice 2 |
| Usage summary source was broad. | Implementation could overbuild analytics or query too much. | Restrict phase-1 usage summary to existing bindings, `post_media`, and optional lineage link/counts; no trend analytics. | Slice 1 |
| Review gates were implicit. | Later implementation could skip contract review before frontend work. | Add per-slice review gates and "do not proceed" criteria in `06-execution-runbook.md`. | All slices |

## Process Node Review

### Node 1 — Contract And Backend Boundary

Inputs:

- Approved roadmap decisions Q1-Q5.
- Existing media chain and repo services.
- `docs/context/api/openapi.yaml` as API SSOT.

Outputs:

- Six OpenAPI endpoint definitions.
- Shared import/list DTO schema.
- Validation schemas.
- Thin backend orchestration service boundary.

Review gate before Node 2:

- Confirm endpoint paths, auth, request bodies, and response DTO are stable.
- Confirm `operator_note` is not part of the phase-1 stable contract.
- Confirm `src/backend/media/admin-media-import-service.ts` or equivalent thin service owns import/list assembly.
- Confirm OpenAPI quality verification passes.
- Confirm no DB schema changes are introduced.

### Node 2 — Backend Import And List Implementation

Inputs:

- Node 1 API contract.
- Existing `MediaAssetService`, `MediaReuseGovernanceService`, `MediaRetrievalService`, media repos, and storage adapter.

Outputs:

- Admin-only upload/URL import endpoints.
- DB-backed pool list endpoints.
- Unified response serializer.
- Platform canonical policy default fixed to false for T-302.

Review gate before Node 3:

- Confirm upload and URL import both persist asset, snapshot, binding, policy, and retrieval status.
- Confirm low-level existing registration endpoints still work.
- Confirm retrieval status is not fabricated.
- Confirm no DB schema/migration changes exist.

### Node 3 — Backend Test Coverage

Inputs:

- Node 2 backend implementation.

Outputs:

- Route/service tests for auth, validation, import, list, policy default, and retrieval status.

Review gate before Node 4:

- Confirm happy-path and negative-path tests exist for platform and community.
- Confirm explicit `allow_quote_original=true` is tested separately from default false.
- Confirm remote URL validation is covered through existing validation behavior.

### Node 4 — Frontend API And Admin Console

Inputs:

- Stable backend DTO and frontend types.

Outputs:

- Frontend API hooks and query keys.
- `/admin/media-assets` route and sidebar entry.
- Platform canonical import/list UI.

Review gate before Node 5:

- Confirm frontend DTO matches OpenAPI/backend response.
- Confirm import result and list refresh use the same item shape.
- Confirm UI switch defaults off and is explicit.
- Confirm admin-only page behavior follows existing admin shell pattern.

### Node 5 — Community Management Integration

Inputs:

- Shared frontend import/list contract.
- Existing `/c/:slug/settings` community surface workflow.

Outputs:

- Community commons import panel scoped by `community.id`.
- Imported asset selection for the active banner/avatar target.
- Existing surface save flow preserved.

Review gate before Node 6:

- Confirm importing media does not automatically mutate community surface settings.
- Confirm selecting imported media only changes local draft state until existing save is triggered.
- Confirm preset image selection still works.
- Confirm community asset list is scoped and cannot show another community pool.

### Node 6 — Whole-task Verification And Handoff

Inputs:

- Completed backend, frontend, API docs, and context artifacts.

Outputs:

- Verification log in `04-verification.md`.
- Updated implementation notes and pitfalls.
- Passing targeted tests, typecheck, OpenAPI quality, API index generation, context verification, and project governance lint.

Review gate for completion:

- Confirm all acceptance criteria in `00-overview.md` are checked or explicitly deferred.
- Confirm no unapproved DB/media-chain changes.
- Confirm manual smoke covers upload and URL import on both surfaces.
- Confirm final task package reflects actual implementation, not just planned scope.

## Overall Planning Decision

The implementation should proceed in the following locked order:

1. Contract and backend boundary.
2. Backend import/list implementation.
3. Backend tests.
4. Frontend API and admin console.
5. Community management integration.
6. Verification and handoff.

Do not start frontend UI work until Node 1 and Node 2 contracts are reviewed. Do not complete the task until Node 6 reconciles implementation evidence back into the task package.
