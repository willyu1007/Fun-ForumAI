# 01 Plan — admin-community-media-import-console (T-302)

## Phase 1 — Requirements Alignment

1. Review `roadmap.md` with the user.
2. Answer or explicitly accept assumptions for:
   - community import permission model
   - community `allow_quote_original` default
   - platform/global `allow_quote_original` default
   - URL import availability
   - historical imported-assets listing and usage-summary scope
   - immediate retrieval/planner eligibility expectations
3. Update roadmap and overview after alignment.

Acceptance criteria:
- [x] User approves phase-1 behavior.
- [x] Open questions in roadmap are resolved or marked as accepted assumptions.

## Phase 2 — Backend Online Import API And Contract

1. Update `docs/context/api/openapi.yaml` for the six T-302 endpoints in the same implementation batch as the route changes.
2. Add validation schemas for URL import, upload form options, and list query params.
3. Add a thin import orchestration boundary if route code would otherwise duplicate ingest/register/index/list assembly.
4. Implement platform canonical upload and URL import.
5. Implement community commons upload and URL import.
6. Implement simple pool asset list endpoints with lightweight usage summary.
7. Fix platform canonical reuse registration so `allow_quote_original` is explicit and defaults false for T-302.
8. Attempt retrieval indexing through existing retrieval services and serialize `ready | pending | failed`.
9. Regenerate API index and run OpenAPI/context verification.
10. Add targeted backend tests.

Acceptance criteria:
- [ ] Endpoints create/import assets and register the correct media pool.
- [ ] List endpoints return DB-backed pool assets with usage counts/latest usage timestamps.
- [ ] API context artifacts are updated in the same batch as route implementation.
- [ ] Invalid auth, invalid payload, unsupported image, and oversized image are covered.
- [ ] Invalid/unsupported remote URL behavior is covered.
- [ ] Platform and community imports default `allow_quote_original=false`.
- [ ] Retrieval status reflects existing index readiness without new persistence.
- [ ] No DB schema or migration changes.

## Phase 3 — Admin Console UI

1. Add platform canonical import UI at `/admin/media-assets`.
2. Add platform canonical simple asset list with usage summary.
3. Add API hooks/types.
4. Add admin sidebar and route wiring.
5. Show upload/URL mode, preview, busy, success, list, and error states.
6. Show explicit reusable-original switch defaulting off.
7. Show retrieval status and usage summary.
8. Add component/hook tests.

Acceptance criteria:
- [ ] Admin can import platform canonical media through UI.
- [ ] Result exposes preview URL, asset ID, policy state, source kind, and whether direct original reuse was explicitly enabled.
- [ ] Platform asset list refreshes after import and shows retrieval status.

## Phase 4 — Community Management UI

1. Use `/c/:slug/settings` as the community management landing point.
2. Replace the current upload-placeholder dialog with community-scoped import UI.
3. Add community-scoped simple asset list with usage summary.
4. Add explicit `allow_quote_original` control defaulting off.
5. Preserve existing preset avatar/banner selection and surface settings save behavior.
6. Add component/hook tests.

Acceptance criteria:
- [ ] Admin can import into `community_commons:<communityId>`.
- [ ] Result clearly shows community scope and asset metadata.
- [ ] Direct original reuse is off by default and can only be enabled through an explicit admin switch.
- [ ] Usage summary stays limited to counts/latest timestamps and does not become analytics/DAM scope.
- [ ] Imported community media can be selected for the relevant community visual target after successful import.

## Phase 5 — Verification and Handoff

1. Run targeted backend and frontend tests.
2. Run `pnpm typecheck`.
3. Run OpenAPI quality verification, regenerate API index, and run context verification.
4. Record verification results in `04-verification.md`.
5. Update implementation notes and pitfalls as needed.

Acceptance criteria:
- [ ] Verification evidence is recorded.
- [ ] Task docs reflect implemented scope and any deviations.

## Risks and Mitigations

- URL import risk: keep admin-only and validate remote image constraints; allow upload-only fallback.
- Partial write risk: keep orchestration narrow and test failure boundaries.
- UX scope creep: defer bulk manifest import and full DAM/listing unless explicitly approved.
- Contract drift risk: update OpenAPI/api-index when endpoint contracts are finalized.

## Execution Reference

Use `06-execution-runbook.md` for file-level execution order, DTO notes, test matrix, verification commands, and rollback plan.

Use `07-coverage-and-contract-review.md` as the review checklist before moving between process nodes.
