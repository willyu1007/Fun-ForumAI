# 06 Execution Runbook — admin-community-media-import-console (T-302)

## Purpose

This runbook turns the approved roadmap into an implementation sequence. A future executor should be able to follow it without reopening product questions.

## Execution Rules

- MUST keep T-302 in the existing media chain: `MediaAsset -> MediaSemanticSnapshot -> SceneMediaBinding -> MediaContextProjection / retrieval`.
- MUST NOT change Prisma schema or create migrations.
- MUST keep platform/global and community imports admin-only in phase 1.
- MUST default `allow_quote_original=false` for both platform canonical and community commons imports.
- MUST expose an explicit UI switch before enabling direct original reuse.
- MUST update API contract artifacts in the same implementation batch as route changes.
- MUST perform a review gate at the end of each slice before moving to the next slice.
- MUST use a thin backend orchestration service for import/list assembly instead of putting ingest/register/index/list logic directly in route handlers.

## Recommended Implementation Slices

### Slice 1 — API Contract And Backend Orchestration

Files likely touched:

- `docs/context/api/openapi.yaml`
- `docs/context/api/api-index.json`
- `docs/context/api/API-INDEX.md`
- `src/backend/validation/schemas.ts`
- `src/backend/routes/admin/admin-media-routes.ts`
- `src/backend/media/admin-media-import-service.ts` (new, preferred)
- `src/backend/container/llm.ts`
- `src/backend/container/index.ts`
- `src/backend/media/media-reuse-governance-service.ts`

Implementation steps:

1. Add OpenAPI paths and schemas for the six T-302 endpoints.
2. Run OpenAPI quality verification before implementing the route body.
3. Add validation schemas for URL import, upload form fields, and list query params.
4. Add `allow_quote_original?: boolean` support to platform canonical registration; default false from the new online import flow.
5. Add a small admin media import service that owns:
   - upload ingest
   - URL ingest
   - pool registration
   - retrieval indexing attempt
   - response DTO assembly
   - pool asset list assembly
6. Mount routes in `admin-media-routes.ts` with `requireHumanAuth` and `requireAdmin`.
7. Keep existing low-level asset registration endpoints working.
8. Regenerate API index after route implementation and rerun context verification.

Expected backend behavior:

- Upload import persists a managed asset from bytes, creates a semantic snapshot, registers the pool binding and reuse policy, attempts retrieval indexing, and returns the unified DTO.
- URL import follows the same path after existing remote image validation.
- List endpoints assemble records from existing pool bindings and related media records.
- Retrieval status is `ready` only when existing retrieval docs have active searchable embeddings.
- Retrieval status is `pending` when docs/snapshots exist but embedding is backfill-required or missing.
- Retrieval status is `failed` when existing embedding records expose an error.

Review gate:

- Endpoint paths, auth, request bodies, and response DTO match `docs/context/api/openapi.yaml`.
- `operator_note` is not exposed as a phase-1 stable contract field.
- No Prisma schema or migration changes exist.
- Platform/global and community policy defaults are both false for quote-original.

### Slice 2 — Backend Tests

Files likely touched:

- `src/backend/routes/__tests__/admin-media-import-routes.test.ts` (new or nearest existing route test)
- `src/backend/media/__tests__/admin-media-import-service.test.ts` (new, if service is introduced)
- Existing media reuse governance tests if platform canonical policy defaults change.

Required cases:

- rejects unauthenticated user
- rejects non-admin user
- rejects missing upload file
- rejects unsupported image type
- rejects oversized image
- rejects non-HTTPS URL
- rejects private-network URL through existing remote validation
- platform upload imports into `platform_canonical:global`
- platform URL imports into `platform_canonical:global`
- community upload imports into `community_commons:<communityId>`
- community URL imports into `community_commons:<communityId>`
- default policy excludes `quote_original`
- explicit switch includes `quote_original`
- list endpoint returns DB-backed asset rows and usage summary
- retrieval status serializes ready/pending/failed without new persistence

Review gate:

- Negative and happy-path tests exist for both platform and community surfaces.
- Default false and explicit true reuse policy paths are tested.
- Tests do not rely on a new DB table or import-session persistence.

### Slice 3 — Frontend API And Admin Console

Files likely touched:

- `src/frontend/api/types.ts`
- `src/frontend/api/query-keys.ts`
- `src/frontend/api/hooks/admin.ts`
- `src/frontend/app/route-components.tsx`
- `src/frontend/app/router.tsx`
- `src/frontend/features/admin/components/AdminSidebar.tsx`
- `src/frontend/features/admin/pages/AdminPages.tsx`
- `src/frontend/features/admin/pages/admin-panel/MediaAssetsTab.tsx` (new, preferred)
- Shared import/list panel component if reused by community settings.

Implementation steps:

1. Add response/request types for T-302 media import DTOs.
2. Add query keys and hooks for platform list/upload/URL import.
3. Add `/admin/media-assets` route under the admin shell.
4. Add admin sidebar entry under content production or platform management.
5. Build platform canonical import UI:
   - upload/URL mode control
   - preview/result area
   - explicit reusable-original switch defaulting off
   - error and busy states
   - simple DB-backed asset list
   - retrieval status chip
   - usage summary fields

Review gate:

- Frontend types match the backend/OpenAPI DTO.
- Import result and list entries render the same item shape.
- The reusable-original switch defaults off.
- The page is reachable from the admin shell and remains admin-only through existing shell behavior.

### Slice 4 — Community Settings Integration

Files likely touched:

- `src/frontend/features/forum/pages/CommunitySettingsPage.tsx`
- Shared import/list panel component from Slice 3
- `src/frontend/features/forum/pages/__tests__/CommunitySettingsPage.test.tsx`

Implementation steps:

1. Replace the current upload-placeholder dialog with a community commons import panel.
2. Scope all requests to `community.id`.
3. Keep existing preset avatar/banner selection and community surface save flow intact.
4. Let imported images be selectable for the relevant visual target only after import succeeds.
5. Show the community media list and retrieval status without turning the page into a DAM.

Review gate:

- Import success does not automatically persist banner/avatar changes.
- Imported media can be selected into local draft state for the active banner/avatar target.
- Existing preset image selection and save behavior still work.
- Community media list remains scoped to the current `community.id`.

### Slice 5 — Verification And Handoff

Commands:

```bash
node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict
node .ai/scripts/ctl-api-index.mjs generate --touch
node .ai/skills/features/context-awareness/scripts/ctl-context.mjs verify --strict
node .ai/scripts/ctl-project-governance.mjs lint --check --project main
pnpm typecheck
```

Also run the targeted backend and frontend tests added in Slices 2-4.

Manual smoke checks:

- Admin imports a platform image by upload.
- Admin imports a platform image by URL.
- Admin imports a community image by upload from `/c/:slug/settings`.
- Admin imports a community image by URL from `/c/:slug/settings`.
- Direct original reuse stays off unless the switch is enabled.
- Imported asset appears in the relevant list with preview, policy, retrieval status, usage summary, and media URL.
- No Prisma schema or migration file is changed.

Review gate:

- `04-verification.md` records commands, targeted tests, and manual smoke results.
- `03-implementation-notes.md` records deviations from the plan.
- `05-pitfalls.md` records any issue found during execution that future work should not repeat.

## Response DTO Contract Notes

Use the field groups below in OpenAPI and frontend types. Exact nested schema names may vary, but the meaning should remain stable.

- `asset`: `asset_id`, `source_kind`, `media_url`, `mime_type`, `file_size_bytes`, `width`, `height`, `visibility_policy`, `lifecycle_status`, `created_at`
- `semantic_snapshot`: `snapshot_id`, `theme`, `scene`, `mood`, `public_safe_summary`, `tags`
- `pool_binding`: `binding_id`, `scene_type`, `scene_id`, `display_policy`, `created_at`
- `reuse_policy`: `policy_id`, `allowed_reuse_modes`, `cross_agent_quote_allowed`, `copyright_state`, `status`
- `retrieval`: `status`, `document_ids`, `doc_scopes`, `searchable_embedding_count`, `last_error_code`, `last_error_message`
- `usage_summary`: `total_binding_count`, `public_display_count`, `latest_usage_at`, `scene_type_counts`

Do not include `operator_note` in this DTO for phase 1.

## Rollback Plan

- Backend rollback: remove new admin import/list routes and orchestration service; leave existing low-level registration endpoints unchanged.
- Frontend rollback: remove `/admin/media-assets` route/sidebar entry and community settings import panel; keep existing preset image flow.
- API context rollback: revert the OpenAPI paths and regenerate `api-index`.
- Data rollback: no schema rollback is expected. Imported assets may remain as existing media records; if needed, use existing lifecycle/governance controls rather than deleting records ad hoc.

## Done Criteria

- API contract, backend routes, frontend hooks, and UI all agree on the same DTO.
- Both platform and community imports work for upload and URL.
- Both surfaces default `allow_quote_original=false`.
- List views are DB-backed from existing records.
- Retrieval readiness is visible and not faked.
- No DB schema or media-chain changes are introduced.
- Verification evidence is recorded in `04-verification.md`.
