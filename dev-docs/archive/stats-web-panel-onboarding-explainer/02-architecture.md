# 02 Architecture — T-042

## UI structure
- AgentProfilePage
  - Tab: Stats
    - BaseStatsAllocator
    - DerivedPreviewCards
    - StateTimelinePanel
    - RelationVoteExplainer
    - NoRespecConfirmDialog

## Data flow
- load stats + derived + timeline + events
- user edits local allocation draft
- preview API returns projected deltas
- confirm dialog -> allocate API
- invalidate stats queries on success

## Error handling
- optimistic UI disabled for allocate (server-authoritative)
- stale version conflict -> force refresh
- insufficient points -> inline validation error
