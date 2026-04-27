# 00 Overview — admin-community-media-import-console (T-302)

## Status

- State: in-progress
- Implementation phase: code complete and merged into `main` on 2026-04-27; both API-level HTTP smoke (`ops/smoke/t302/run-smoke.ts` 11/11) and DOM-level UI smoke (Chrome MCP, full upload + selectAction flow on both surfaces) have passed. Awaiting product-owner sign-off to move to `done`.
- Depends on: roadmap alignment, admin media route boundary confirmation, frontend admin/community management landing-point confirmation.
- Current status: Slices 1–5 landed in code and are integrated with the T-301 `main` changes; OpenAPI/api-index/context verification, project governance sync, typecheck, targeted backend + frontend test suites, target ESLint, and in-process HTTP smoke all pass; zero Prisma schema or migration changes.
- Next step: product-owner closeout; if accepted, move the task to `done` and archive the bundle.

## Goal

Add online media import workflows to the admin console and community management surfaces so operators can import images into existing platform canonical and community commons media pools without changing the database schema or the established media domain chain.

## Non-goals

- Do not change Prisma schema, migrations, or DB context artifacts for phase 1.
- Do not bypass `MediaAsset -> MediaSemanticSnapshot -> SceneMediaBinding -> MediaContextProjection`.
- Do not build a full media asset management system.
- Do not change generation/planner/retrieval semantics except by making assets available through existing pool registration paths.
- Do not expose unaudited public upload endpoints.

## Context

The repo already has the media domain and governance primitives needed for this feature:

- agent owner upload/URL import paths that create media assets and semantic snapshots
- platform canonical and community commons pool registration
- reuse policies for controlling original quote vs derivative/reference use
- local/S3 storage abstraction and `/v1/media/local/*` read path
- human auth currently exposes `user | admin`; existing `RoleAssignment` is for agent/stage roles, not human community operators

T-302 should close the online operator workflow around those capabilities rather than introducing a second media model.

## Acceptance Criteria

- [x] Roadmap open questions are answered or accepted as assumptions.
- [x] Phase-1 community media import permission is admin-only.
- [x] Platform/global and community media imports default `allow_quote_original=false` with an explicit UI switch to enable direct original reuse.
- [x] Phase 1 includes DB-backed simple pool asset lists with lightweight usage summaries.
- [x] Phase 1 supports both upload and URL import for platform/global and community media imports.
- [x] Platform canonical online import works from admin console (`/admin/media-assets`, route + tab + sidebar entry wired; covered by 15 route integration cases + 6 panel cases).
- [x] Community commons online import works from community management (`/c/:slug/settings` upload entry; covered by `CommunitySettingsPage` integration test + select-action panel test).
- [x] Upload and URL import behavior follows approved phase-1 scope.
- [x] No Prisma schema or migration changes are introduced (verified via `git status --short`; zero changes under `prisma/` or any `migrations/`).
- [x] Imported assets are persisted through existing media asset/snapshot/binding/policy services (`AdminMediaImportService` only orchestrates `ingestManagedAsset` / `ingestManagedRemoteAsset` + `registerPlatformCanonicalAsset` / `registerCommunityCommonsAsset` + `ensureAssetIndexed`).
- [x] Planner/retrieval consumption is gated by existing retrieval/index readiness and surfaced as ready/pending/failed in operator views.
- [x] Pool asset lists are assembled from existing media/binding/policy/usage data without new persistence (uses `sceneMediaBindingRepo.findByScene`, `mediaAssetRepo.findByIds`, `mediaSemanticSnapshotRepo.findCurrentByAssetId`, `mediaReusePolicyRepo.findBySubject`, `mediaRetrievalDocumentRepo.listByAssetId`, `mediaEmbeddingSnapshotRepo.listByRetrievalDocumentId`, `postMediaRepo.findByAssetId`).
- [x] New API/UI behavior is covered by targeted tests, a real-HTTP smoke harness (`ops/smoke/t302/run-smoke.ts`, 11/11 assertions passed), and a Chrome-MCP-driven DOM smoke covering both `/admin/media-assets` and `/c/:slug/settings` (full upload + selectAction flow with no auto-save side effect). See `04-verification.md`.
- [x] Coverage review maps requirements to execution slices and closes planning gaps.
