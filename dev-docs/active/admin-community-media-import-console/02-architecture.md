# 02 Architecture — admin-community-media-import-console (T-302)

## Boundary

T-302 is an online workflow layer over the existing media domain. It must not create a parallel media model.

Canonical chain:

```text
MediaAsset
  -> MediaSemanticSnapshot
  -> SceneMediaBinding
  -> MediaContextProjection / reuse policy / retrieval artifacts
  -> existing consumers
```

## Write Model

Platform import:

```text
upload or URL
  -> managed asset ingest
  -> source_kind/platform target policy
  -> media_pool binding: platform_canonical:global
  -> reuse policy for platform_canonical
  -> response view
```

Community import:

```text
upload or URL
  -> managed asset ingest
  -> source_kind/community target policy
  -> media_pool binding: community_commons:<communityId>
  -> reuse policy for community_commons
  -> response view
```

## Reuse Policy Default

Phase-1 decision:

- platform/global import defaults `allow_quote_original=false`
- community commons import defaults `allow_quote_original=false`
- both UI surfaces include an explicit admin switch to enable direct original reuse for the imported asset

This keeps "asset is available as a reference/derivation source" separate from "asset may be directly shown again as the original image."

## API Boundary

Candidate endpoints:

- `POST /v1/admin/media/platform-canonical/imports/upload`
- `POST /v1/admin/media/platform-canonical/imports/url`
- `GET /v1/admin/media/platform-canonical/assets`
- `POST /v1/admin/communities/{communityId}/media/commons/imports/upload`
- `POST /v1/admin/communities/{communityId}/media/commons/imports/url`
- `GET /v1/admin/communities/{communityId}/media/commons/assets`

Existing low-level registration endpoints remain available for registering an existing asset ID.

URL import is in phase 1 for both platform and community surfaces. It remains admin-only and must reuse the existing remote image validation posture: HTTPS requirement, allowed image MIME types, size limit, and image signature validation.

### Proposed Request Shapes

Upload endpoints use `multipart/form-data`:

- `file`: required image file, same 10MB max as existing agent media upload
- `allow_quote_original`: optional boolean-like form value, defaults false

URL endpoints use JSON:

- `source_url`: required HTTPS image URL
- `allow_quote_original`: optional boolean, defaults false

`operator_note` is not part of the phase-1 stable request contract because T-302 does not add persistence for import-session notes. It may be revisited only if existing records can carry the note without changing storage or list semantics.

List endpoints use query params:

- `limit`: optional, default 50, max 100

### Proposed Response Shape

Import endpoints should return:

- `asset`: id, source kind, media URL, MIME, size, dimensions, lifecycle, visibility, created time
- `semantic_snapshot`: current snapshot id and compact public-safe summary
- `pool_binding`: binding id, scene type/id, display policy, created time
- `reuse_policy`: policy id, allowed modes, cross-agent quote flag, copyright state, status
- `retrieval`: `ready | pending | failed`, document ids, doc scopes, active/searchable embedding count, last error if present
- `usage_summary`: binding/use counts and latest usage timestamp where cheap to compute

List endpoints should return the same item shape in `items`, plus `pool` summary and `next_cursor` only if cursor pagination is implemented without new persistence.

## Permissions

Phase-1 decision:

- platform canonical import: admin only
- community commons import: admin only

The repo currently has no human community operator permission model. `RoleAssignment` is scoped to agent/stage role assignment. If community operator roles are introduced later, permission expansion should be explicit and tested separately.

## Data Migration

None planned. Any implementation requiring new persisted fields is out of scope for T-302 phase 1 unless the roadmap is reopened.

## Consumer Contract

Imported assets must be consumable through existing media URLs, pool bindings, reuse policies, and projections/retrieval paths. The UI should display import result metadata but should not become the system of record.

Phase-1 consumption decision:

- Management UI visibility is immediate after asset, semantic snapshot, pool binding, and reuse policy persistence.
- Planner/retrieval eligibility is gated by existing catalog/retrieval document and embedding/index readiness.
- Import responses and asset lists should surface retrieval/index status as `ready`, `pending`, or `failed` using existing records where possible.
- T-302 must not add new persistence solely to track consumption state.

Retrieval status contract:

- `ready`: at least one retrieval document for the asset has an active embedding snapshot with `search_status='searchable'`.
- `pending`: retrieval documents exist but no active searchable embedding exists, or embedding is backfill-required because the gateway/index path is unavailable.
- `failed`: the latest embedding snapshot for the asset's retrieval document has an error code/message and is not searchable.

## Frontend Landing Points

- Admin console: add a new platform media import page under the existing admin shell at `/admin/media-assets`.
- Community management: replace the current upload-placeholder flow in `/c/:slug/settings` with a community commons import panel scoped to `community.id`.
- Shared UI: use one reusable import/list panel component with mode-specific copy and endpoint hooks for platform vs community scope.

Community settings consumption contract:

- Importing a community image registers it in `community_commons:<communityId>` and makes it visible in the community media list.
- Importing does not automatically change `banner_image_url` or `avatar_image_url`.
- When the admin is editing banner or avatar, an imported media item may be selected by its `media_url` for the active visual target.
- The existing community surface save flow remains responsible for persisting `banner_image_url` or `avatar_image_url`.

## Listing And Usage Summary

Phase 1 includes simple DB-backed pool asset lists:

- platform list source: `scene_media_bindings` where `scene_type='media_pool'` and `scene_id='platform_canonical:global'`
- community list source: `scene_media_bindings` where `scene_type='media_pool'` and `scene_id='community_commons:<communityId>'`
- asset metadata source: existing `media_assets`
- policy source: existing `media_reuse_policies`
- semantic source: current `media_semantic_snapshots`
- usage summary source: existing scene bindings, `post_media`, and/or lineage edges

Usage summary should stay lightweight:

- total binding/use count
- public display count where available
- latest usage timestamp
- scene type distribution if cheap to compute
- optional link to existing lineage trace

Do not add new persistence for usage summaries in T-302.

## Deferred Architecture

- bulk manifest import UI
- full asset library/history browser
- complex usage graph UI
- trend analytics
- non-admin community operator permissions
- destructive lifecycle controls
- dedicated project-domain media pools if a real `Project` model is introduced later
