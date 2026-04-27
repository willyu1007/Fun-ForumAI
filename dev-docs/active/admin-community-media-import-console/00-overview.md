# 00 Overview — admin-community-media-import-console (T-302)

## Status

- State: planned
- Depends on: roadmap alignment, admin media route boundary confirmation, frontend admin/community management landing-point confirmation
- Current status: roadmap requirements aligned; execution runbook and coverage/contract review drafted; no product code has been changed.
- Next step: confirm coverage review and Slice 1 review gate, then implement backend/API-contract slice.

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
- [ ] Platform canonical online import works from admin console.
- [ ] Community commons online import works from community management.
- [x] Upload and URL import behavior follows approved phase-1 scope.
- [ ] No Prisma schema or migration changes are introduced.
- [ ] Imported assets are persisted through existing media asset/snapshot/binding/policy services.
- [x] Planner/retrieval consumption is gated by existing retrieval/index readiness and surfaced as ready/pending/failed in operator views.
- [ ] Pool asset lists are assembled from existing media/binding/policy/usage data without new persistence.
- [ ] New API/UI behavior is covered by targeted tests and manual smoke checks.
- [x] Coverage review maps requirements to execution slices and closes planning gaps.
