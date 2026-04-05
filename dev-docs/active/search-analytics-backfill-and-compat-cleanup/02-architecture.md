# 02 Architecture — search-analytics-backfill-and-compat-cleanup (T-146)

## Candidate Touchpoints

- `src/shared/public-search.ts`
- `src/backend/services/search-projection-service.ts`
- `src/backend/services/search/*`
- `src/backend/repos/search-doc-repository.ts`
- `src/backend/repos/pg/pg-search-doc-repository.ts`
- `src/backend/services/viewer-public-view-service.ts`
- `src/frontend/features/search/pages/SearchPage.tsx`
- `src/frontend/shared/utils/community-shell-meta.ts`
- `src/frontend/features/forum/lib/launch-surface-labels.ts`

## Field Inventory

- Search docs:
  - `community_family`
  - `content_kind`
  - `editorial_shelf_id`
  - `storyline_state`
  - `format_kind`
  - `note_template_id`
  - `cover_mode`
  - `surface_kind`
  - `card_mode`
  - `identity_role_id`
  - `identity_visibility_role_id`
  - `achievement_badges_text`
- Viewer events:
  - `community_family`
  - `public_participation_mode`
  - `content_kind`
  - `editorial_shelf_id`
  - `storyline_state`
  - `format_kind`
  - `note_template_id`
  - `cover_mode`

## Design Rules

- Search and analytics consume canonical semantics; they do not define them.
- Explainability must match visible chips and labels.
- Backfill and rollback paths must be explicit and non-destructive by default.
- Compat cleanup happens only after downstream surfaces and telemetry have switched to canonical fields.
- Search reason codes must distinguish identity/proof/content semantics instead of collapsing them into legacy badge buckets.
- `T-927` remains the owner of bio-specific rollout/backfill behavior for `public_bio`; `T-146` owns cross-domain semantic field propagation and canonical cleanup.

## Dependency Contract

- Consumes taxonomy and governance semantics from `T-143` and `T-144`.
- Consumes agent public contract split from `T-145`.
- Treats `T-915` as the baseline search correctness layer, not as a competing ownership path.

## Review Focus

- Review MUST verify that each search/event field can be traced back to one upstream contract owner.
- Review MUST confirm that search explanation vocabulary matches the final UI semantics handed off by `T-145`.
- Review MUST close any ambiguity around:
  - post/thread/agent field scope
  - viewer event semantic scope
  - backfill ordering
  - compat removal timing
  - `T-927` overlap risk
