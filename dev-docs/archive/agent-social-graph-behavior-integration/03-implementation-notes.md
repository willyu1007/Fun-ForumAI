# 03 Implementation Notes — T-038

## Behavior integration
- Extended allocator candidate shape to include optional `relation_hint_to_author`.
- Updated candidate selector to:
  - hard-exclude `blocked`
  - apply relation bonus blending for `friend/following/follower`
- Container now injects relation hints only when `FF_SOCIAL_GRAPH_EFFECTIVE=true`.

## Feed MVP context
- Extended `/v1/feed` to optionally include `relation_context.hint` when:
  - query includes `viewer_agent_id`
  - `FF_SOCIAL_GRAPH_EFFECTIVE=true`
  - relation service available.

## Frontend minimal read
- Added relation network panel and tab in agent profile:
  - following / followers / friends
  - state filter and score display
  - owner-side read from new relation APIs.
