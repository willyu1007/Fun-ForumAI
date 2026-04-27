# 03 Implementation Notes — admin-community-media-import-console (T-302)

## 2026-04-26 — Task Package Creation

- Created T-302 task package for roadmap-first alignment.
- Scope is intentionally constrained to online import workflow closure.
- Hard constraints captured:
  - no DB/schema changes
  - no media chain changes
  - reuse existing platform canonical and community commons pool concepts
  - start implementation only after roadmap alignment

## Decisions

- Slug: `admin-community-media-import-console`.
- Task ID: `T-302`.
- Governance sync result: `M-000 > F-000 > T-302` triage inbox.
- Candidate semantic mapping for later confirmation: `F-080 Visual Media Framework V1`.

## Open Implementation Notes

- Confirmed Q1: phase-1 community media import should be admin-only because the current repo has no human community operator permission model.
- Confirmed Q2: both platform/global and community imports default `allow_quote_original=false`; import UI must expose an explicit switch to enable direct original reuse.
- Confirmed Q3: phase 1 should include DB-backed simple pool asset lists and lightweight usage summaries, but not full DAM, complex graph UI, or trend analytics.
- Confirmed Q4: phase 1 includes both upload and URL import for platform/global and community surfaces; URL import remains admin-only and uses existing remote image validation.
- Confirmed Q5: imported assets are management-visible immediately after asset/snapshot/pool/policy persistence; planner/retrieval consumption depends on existing retrieval/index readiness and should be shown as ready/pending/failed.
- Implementation caution: current `registerPlatformCanonicalAsset()` forces `allow_quote_original=true`; T-302 implementation must add/pass an explicit option so platform imports default false and only enable quote-original when the admin switch is on.
- Discovery: backend import/list endpoints should live in existing `src/backend/routes/admin/admin-media-routes.ts`; keep route handlers thin and use a new small orchestration service only if direct route code would duplicate ingest/register/index/list assembly.
- Discovery: existing media ingest methods already cover upload and URL validation through `MediaAssetService.ingestManagedAsset()` and `ingestManagedRemoteAsset()`.
- Discovery: existing retrieval flow is `MediaRetrievalService.ensureAssetIndexed()`, which creates catalog/retrieval docs and active searchable embeddings when configured, or backfill-required snapshots when not.
- Discovery: list assembly can use existing `sceneMediaBindingRepo`, `mediaAssetRepo`, `mediaSemanticSnapshotRepo`, `mediaReusePolicyRepo`, `mediaRetrievalDocumentRepo`, `mediaEmbeddingSnapshotRepo`, and `postMediaRepo`; some repos/services may need to be exported from the container.
- Discovery: admin console currently has `/admin/media-prompts`; preferred UI addition is a separate `/admin/media-assets` page under the admin shell to avoid mixing prompt configuration with imported asset operations.
- Discovery: community management already lives at `/c/:slug/settings`; it has an upload-image placeholder dialog that can be replaced by the community commons import panel.
- Confirm whether new endpoints must be added to OpenAPI before route implementation.

## 2026-04-27 — Implementation

### Scope deviations from plan

- **Platform canonical default flip applies to all callers, not only T-302 imports.** User direction during Slice 1: the existing `POST /admin/media/platform-canonical/assets` route and the `media-injection-worker` should also default `allow_quote_original=false`, not just the new T-302 import endpoints. To make the flag actually take effect, three internal helpers were updated in [`media-reuse-governance-service.ts`](../../../src/backend/media/media-reuse-governance-service.ts):
  - `defaultModesForSource` now branches on `allow_quote_original` for `platform_canonical` (mirroring the pre-existing `community_commons` branch) — without this, the flag was silently ignored for platform pools.
  - `defaultCrossAgentQuoteAllowed` for `platform_canonical` changed from hardcoded `return true` to `return Boolean(allowQuoteOriginal)`.
  - `registerPlatformCanonicalAsset` accepts an optional `allow_quote_original?: boolean` and pass-throughs to `registerPoolAsset`. The existing admin route now reads `req.body.allow_quote_original`; the existing worker call deliberately omits the flag so it inherits `undefined → false` semantics.
- **Existing low-level admin route schema extended**, not just retired in favor of T-302 endpoints. `createPlatformCanonicalAssetSchema` gained an optional `allow_quote_original` to mirror `createCommunityCommonsAssetSchema`, so the legacy route can opt back in to the original quote mode if needed. This is a non-breaking superset.
- **Test coverage decision**: per Slice 2 review, route-level integration tests in `admin-media-import-routes.test.ts` are the primary suite (15 cases covering the 14 cases the runbook enumerated plus a list assertion). A focused service unit test (`admin-media-import-service.test.ts`, 4 cases) was added for retrieval status mapping because the three-way `ready/pending/failed/no-doc` branches are hard to exercise via the route-level happy path under the test container's offline embedding gateway.

### Concrete decisions made during execution

- New thin orchestration service lives at `src/backend/media/admin-media-import-service.ts`. It exposes `importPlatformUpload / importPlatformUrl / importCommunityUpload / importCommunityUrl` and `listPlatformAssets / listCommunityAssets`, plus private helpers `assembleItem / resolveRetrievalStatus / resolveUsageSummary`. Route handlers stay thin: auth + schema parse + service call + error mapping.
- Container exports added: `mediaAssetService`, `adminMediaImportService` from `src/backend/container/index.ts`. `mediaAssetService` is exported because the route integration test stubs `ingestManagedRemoteAsset` via `vi.spyOn` to bypass the real network for URL import happy paths.
- Frontend DTO contract lives in `src/shared/admin-media-import.ts` and is re-exported via `src/frontend/api/types.ts`. Backend response types are kept compatible (string aliases instead of internal union enums) so the shared contract is a stable surface independent of repo-internal type renames.
- New shared frontend component `src/frontend/features/admin/components/MediaImportPanel.tsx` accepts mutation/query hooks via props (dependency-injection style) so it serves both the admin console (`MediaAssetsTab`) and the community settings dialog without branching on mode internally.
- Optional `selectAction` prop on `MediaImportPanel` was added in Slice 4 specifically to satisfy the community-settings flow ("选作 Banner / 选作头像"). Importing media never auto-saves the community surface — `onSelectMedia` only updates parent local state and the existing `saveCommunitySurface` flow remains responsible for persistence.
- API hook `useAdminCommunityCommonsAssets(communityId, params)` accepts `null` and disables itself; the import-mutation hooks (`useAdminCommunityMediaImportUpload(communityId)` / `useAdminCommunityMediaImportUrl(communityId)`) require a string and are only mounted inside `CommunityCommonsImportDialog`, which is only rendered after `community` is loaded (parent has already returned early on missing community).
- OpenAPI lint constraint: `ctl-openapi-quality` does not resolve `$ref` for path parameters. The community-scoped endpoints inline-declare `communityId` rather than reusing `#/components/parameters/CommunityIdParam`, matching the rest of the file.

### File-by-file summary

- Contract: [`docs/context/api/openapi.yaml`](../../../docs/context/api/openapi.yaml) (+ regenerated `api-index.json` / `API-INDEX.md` / `registry.json`).
- Backend: `validation/schemas.ts`, `media/media-reuse-governance-service.ts`, `routes/admin/admin-media-routes.ts`, new `media/admin-media-import-service.ts`, `media/index.ts`, `container/llm.ts`, `container/index.ts`.
- Frontend: new `shared/admin-media-import.ts`, `api/types.ts`, `api/query-keys.ts`, `api/hooks/admin.ts`, new `features/admin/components/MediaImportPanel.tsx`, new `features/admin/pages/admin-panel/MediaAssetsTab.tsx`, `features/admin/pages/AdminPages.tsx`, `app/route-components.tsx`, `app/router.tsx`, `features/admin/components/AdminSidebar.tsx`, `features/forum/pages/CommunitySettingsPage.tsx`.
- Tests: new `backend/media/__tests__/admin-media-import-service.test.ts` (4), new `backend/routes/__tests__/admin-media-import-routes.test.ts` (15), new `frontend/features/admin/components/__tests__/MediaImportPanel.test.tsx` (6), updated `frontend/features/forum/pages/__tests__/CommunitySettingsPage.test.tsx` (2 cases — placeholder assertion replaced).
