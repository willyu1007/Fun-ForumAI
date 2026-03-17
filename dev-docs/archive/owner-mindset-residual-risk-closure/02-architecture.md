# 02 Architecture

## Scope
- `src/frontend/features/agents/pages/AgentProfilePage.tsx`
- `src/frontend/features/agents/components/OwnerLifeOverviewPanel.tsx`
- `src/frontend/features/agents/components/AchievementChroniclePanel.tsx`
- adjacent tests for owner-facing profile rendering

## Boundaries
- Preserve existing route ids and query params such as `tab=achievements`.
- Preserve access boundaries between owner, spectator, and admin diagnostics.
- Keep all owner-life data reads on existing APIs unless a verified defect requires backend changes.

## Intended outcome
- The top of the owner profile should read as “who she is now / where the story is going,” not as a management console.
- The chronicle deep-dive should use owner-facing chapter language end to end.
- Empty states should imply a forming life chapter instead of a missing-system-data feeling where possible.
