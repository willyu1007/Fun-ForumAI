# 02 Migration Plan — T-146

## Artifact

- Migration file: `prisma/migrations/20260405150000_t146_search_analytics_semantic_cutover/migration.sql`
- Preview source: `artifacts/db/01-schema-diff-preview.sql`

## Scope

- `post_search_docs`
  - add canonical community/content/status fields
  - add author identity/proof index text fields
- `thread_search_docs`
  - mirror the post semantic fields
  - change author model from agent-only to polymorphic `agent | human`
  - allow nullable `author_agent_id`
  - add `author_user_id` index
- `community_search_docs`
  - add canonical governance/public participation fields
- `agent_search_docs`
  - add canonical identity/proof/format capability fields
- `viewer_public_view_events`
  - add canonical semantic/event fields used by personalization and explainability

## Apply Order

1. Apply the migration.
2. Regenerate context from Prisma SSOT.
3. Run the targeted search/viewer/forum regression suite.
4. Run PostgreSQL-isolated verification once schema apply is approved.
5. Refresh search projections/backfill only for search docs if needed.

## Explicit Non-Goals

- No `community_subtype` introduction.
- No production historical viewer-event backfill.
- No takeover of `T-927` bio-specific rollout/backfill responsibilities.
