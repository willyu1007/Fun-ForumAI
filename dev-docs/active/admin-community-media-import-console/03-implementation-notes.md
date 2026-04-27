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
