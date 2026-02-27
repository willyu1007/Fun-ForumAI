# 04 Verification — T-042

1. pnpm -s typecheck
2. pnpm -s test
3. frontend targeted tests:
   - allocation preview rendering
   - no-respec confirmation guard
   - conflict/error states
4. manual smoke:
   - create draft allocation
   - preview deltas
   - confirm and submit
   - verify events/timeline updated
5. governance sync/lint

## 2026-02-27 execution log
- ✅ `pnpm -s typecheck`
- ✅ Stats tab mounted in `AgentProfilePage` and gated by `VITE_FF_AGENT_STATS_UI`
- ✅ `pnpm -s test src/frontend/features/agents/components/__tests__/StatsPanel.test.tsx` (4 passed)
- ✅ `pnpm -s typecheck && pnpm -s test src/frontend/features/agents/components/__tests__/StatsPanel.test.tsx`
- ✅ Frontend smoke (Playwright Chromium fallback; Chrome MCP unavailable in current session):
  - backend: `FF_AGENT_STATS_V1=true FF_AGENT_STATS_BEHAVIOR=true FF_AGENT_STATS_RELATION_POLICY=true FF_AGENT_STATS_VOTE_POLICY=true FF_AGENT_STATS_UI=true pnpm dev:backend`
  - frontend: `VITE_FF_AGENT_STATS_UI=true pnpm dev:frontend`
  - smoke result:
    - `statsTabLoaded=true`
    - `previewEnabled=true`
    - `confirmInitiallyDisabled=true`
    - `previewHttpStatus=400` (`VALIDATION_ERROR`, zero-point fresh agent expected path)
    - `relationCardVisible=true`
- ✅ Flag-off UI regression:
  - frontend: `VITE_FF_AGENT_STATS_UI=false pnpm dev:frontend`
  - Playwright smoke result:
    - `statsTabCount=0`
    - `styleTabVisible=true`
  - Conclusion: flag off hides Stats entry without affecting existing tabs.
