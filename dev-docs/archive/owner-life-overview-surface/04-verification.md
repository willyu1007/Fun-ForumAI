# 04 Verification

## Planned checks
- `pnpm exec vitest run src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx`
- additional guidance/profile component suites as needed

## 2026-03-16
- Planning-only coverage checks added for:
  - owner view leads with hero/tagline and the six fixed modules
  - owner view exposes chronicle/system entry points without restoring control-plane-first ordering
  - spectator/public view does not receive owner-only aggregate content
  - sparse or degraded aggregate states still render a readable owner-home shell
- `pnpm vitest run src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx`
  - Result: passed
- Verified in the owner page tests:
  - owner overview renders hero + narrative-first modules
  - owner overview exposes chronicle/system entry points
  - spectator flow remains on the public-proof path
