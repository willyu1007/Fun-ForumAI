# 03 Implementation Notes — agent-public-identity-projection-proof-alignment (T-145)

## 2026-04-04

- Created the execution bundle and mapped it to `R-104`.
- Locked the boundary that `T-145` may change agent DTO/read semantics and display-source rules, but may not absorb worldview/bio rendering internals from `T-924` to `T-927`.
- Locked the product decision that bio remains auto-generated and non-editable in this wave.

## 2026-04-04 — scope reinforcement pass

- Expanded the pack to explicitly own `identity_role_id`, `identity_visibility_role_id`, `format_capabilities`, `display_mode`, and `achievement_badges` as public semantic inputs.
- Recorded the role-boundary rule that public identity reads may not mix in scene runtime roles or template archetypes.
- Confirmed the downstream boundary that `T-146` may index and explain these fields, but may not redefine the identity/projection/proof split.

## 2026-04-04 — implementation kickoff

- Promoted the pack to active implementation.
- Locked the implementation order inside the pack:
  - shared author-presentation builder
  - profile/forum/search DTO convergence
  - feed/search/hover/profile surface read-source cleanup
- Added the explicit review deliverables:
  - surface read-source matrix
  - deprecated field derivation rules for `display_badges`, flat `tagline`, and flat `public_bio`
  - identity-first chip rendering evidence on touched public surfaces

## 2026-04-04 — implementation evidence

- Added a shared backend author-presentation builder for public surfaces and made it the main read-source convergence point.
- Unified split public contract emission on touched backend surfaces:
  - agent profile
  - forum author summary
  - search author summary
- Locked the split ownership:
  - `public_identity` provides identity chip inputs
  - `public_projection` provides public bio/tagline text
  - `public_proof` provides achievement badge/proof chips
- Downgraded deprecated flat fields to derived compatibility output only:
  - `display_badges`
  - flat `tagline`
  - flat `public_bio`
- Updated public UI surfaces to consume the split contract instead of inferring from mixed legacy fields:
  - `PostCard`
  - `PostCompact`
  - `ThreadList`
  - search result rows
  - hover card
  - agent profile intro tab
- Tightened the public UI read rule after verification:
  - primary identity chips no longer fall back to `display_badges`
  - `display_badges` remains API compatibility output only and is not a valid semantic source for new UI work
- Applied the wave-1 surface rule:
  - identity chip stays primary on feed/thread/search headers
  - proof chips stay on-demand and appear persistently on hover/profile
  - projection text reads from projection/social-bio sources, not from badge fallback
- Kept the role-boundary intact:
  - scene/template cast roles do not leak into `public_identity`
  - `T-927` remains the owner of bio generation/backfill/rollout quality, not DTO semantics
- Verification evidence:
  - `pnpm exec tsc --noEmit`
  - `pnpm exec vitest run src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx`
