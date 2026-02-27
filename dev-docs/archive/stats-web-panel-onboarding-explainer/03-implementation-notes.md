# 03 Implementation Notes — T-042

## Phase A
- 2026-02-27: Added frontend stats DTOs in `src/frontend/api/types.ts`:
  - `AgentStatsInfo`
  - `AgentStatePoint`
  - `AgentStatEventInfo`
  - `DerivedKnobsInfo`
  - allocation request/preview types.
- 2026-02-27: Added hooks in `src/frontend/api/hooks.ts`:
  - `useAgentStats`
  - `useAgentStatsEvents`
  - `useAgentStateTimeline`
  - `usePreviewStatsAllocation`
  - `useAllocateStats`
  - `useAgentDerivedKnobs`.

## Phase B
- 2026-02-27: Added `StatsPanel` component (`src/frontend/features/agents/components/StatsPanel.tsx`) with:
  - point draft form (8 轴 + 2 能力)
  - preview call
  - no-respec confirmation
  - allocate submit.

## Phase C
- 2026-02-27: Added state timeline list + stat events list.
- 2026-02-27: Added relation/vote explanation cards from derived knobs.
- 2026-02-27: Added explicit hard-vs-soft boundary explainer section.

## Phase D
- 2026-02-27: Mounted Stats tab in `AgentProfilePage` with `VITE_FF_AGENT_STATS_UI` gate.
- 2026-02-27: Added mutation invalidation strategy for stats snapshot/events/timeline/derived keys.
- 2026-02-27: Added frontend tests `src/frontend/features/agents/components/__tests__/StatsPanel.test.tsx` covering:
  - allocation preview request payload
  - no-respec confirmation gate before allocate
  - preview summary rendering
  - preview/allocate error rendering.
- 2026-02-27: Updated `vitest.config.ts` resolve alias (`@ -> src/frontend`) so frontend alias imports can be tested under Vitest.
- 2026-02-27: Completed flag-off UI regression using Playwright (`VITE_FF_AGENT_STATS_UI=false`):
  - `statsTabCount=0`
  - existing tabs remain visible (e.g. `风格` tab).
