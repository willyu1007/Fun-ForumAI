# 03 Implementation Notes

## 2026-04-09

- Reopened `T-937` to execute the post-audit semantic convergence hard-cut instead of creating a new task bundle.
- Locked execution order for this restart:
  - Phase 1: public read DTO hard-cut to nested canonical-only + frontend selector cutover + creator interaction-contract test repair
  - Phase 2: `authoring_shapes` strong typing, launch `discussion_seed_types`, community `preferred_card_modes`, and governance visibility compatibility removal
- Reuse rule for this restart:
  - keep search / viewer-event / DB flat semantic columns only as derived storage/index fields
  - stop treating flat fields as public contract or business-read fallback
- Phase 1 implemented:
  - public `/v1/feed`, `/v1/home`, `/v1/posts/:id`, `/v1/highlights`, and `/v1/communities` now serialize nested semantic contracts only and strip top-level duplicate flat semantic fields
  - backend read/search/programming paths were cut over to nested semantic selectors, while flat fields remain derived storage/index outputs only
  - web runtime pages/components (`HomePage`, `CommunitiesPage`, `PostCard`, `PostCompact`) now read semantic state from nested contracts
  - creator community interaction-contract tests were updated to `open_reply / none / direct_reply`
- Phase 2 implemented:
  - `authoring_shapes` is now a canonical taxonomy (`discussion_root`, `story_episode`, `aftershow_recap`, `note_root`, `programming_slot`) with exact registry coverage
  - launch community rules now reject legacy `preferred_visual_modes`, reject unknown `authoring_shapes`, and materialize authoring-only `discussion_seed_types`
  - launch config was migrated to `preferred_card_modes`; `highlight_card` and `debate_prompt` were removed from `authoring_shapes`
  - governance control-plane now accepts only `incubation_visibility_mode`; `recommended_visibility` was removed from backend/frontend recommendation contracts
  - Prisma SSOT was updated to remove `recommended_visibility`, and migration preview `20260409162217_t942_drop_recommended_visibility` backfills `incubation_visibility_mode` before dropping the old column
  - deleted unused legacy forum author badge files: `AuthorBadgeRail.tsx`, `author-identity.ts`, `author-badge-icons.ts`
- Verification completed:
  - `pnpm vitest run src/backend/launch/__tests__/community-rules.test.ts src/backend/launch/__tests__/visual-rollout.test.ts src/backend/launch/__tests__/semantic-taxonomy-registry.test.ts src/backend/services/__tests__/community-governance-service.test.ts src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/home-programming-snapshot-service.test.ts`
  - `pnpm vitest run src/frontend/features/forum/components/__tests__/PostCard.test.tsx src/frontend/features/forum/components/__tests__/PostCompact.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx`
  - `pnpm exec prisma format`
  - `pnpm exec prisma validate`
  - `pnpm exec prisma generate`
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
- Residual note:
  - repo-wide `pnpm exec tsc -b` was initially still failing outside the semantic-convergence slice
- Follow-up repo-wide typecheck cleanup completed the same day:
  - removed stale frontend unused symbols in agent creation, feedback, and safety-center files
  - updated `useAuth()` test mocks to include the newer email/phone contact-change methods and pending flags
  - aligned allocator tests with the now-async `EventAllocator.allocate()` contract
  - refreshed media/runtime test mocks and helper casts to match current repository interfaces
  - updated attention-opportunity fixtures to the current `ThreadTurnAdded` event + forum orchestration capsule shapes
  - restored `PerceivedEvidenceEntry.actual_anchor_turn_id` in forum-read evidence windows
  - corrected stale forum-read rollout assertions so `single_cover` on `home_root_card` now expects `hero_eligible: false` unless an explicit hero rule applies
  - after these fixes, repo-wide `pnpm exec tsc -b` passes cleanly

## 2026-04-06

- Created residual closeout bundle `T-937`.
- This task intentionally sits on top of earlier semantic/governance and provider-runtime programs rather than rewriting their historical records.
- Execution order is fixed:
  - shared semantic/governance truth-source
  - read-model/API/UI cleanup
  - LLM adapter/runtime closeout
- Final residual cleanup removed the remaining legacy ingress that could re-open dual-track development:
  - dropped `t4`/`t4_blogger`/`t4_capable`/`t4_revisit` loader aliases from shared taxonomy, launch contracts, system roster, stage director authoring, and programming ops
  - enforced canonical-only `creator_note_*` launch template blocks and renamed the per-community runtime block to `creator_note_runtime`
  - removed inert `t4_longform_only` from stage-spec schemas, source templates, exported stage-template dist payloads, and test fixtures
  - renamed `strictT4`-style metrics and gate helpers to strict-publication terminology so runtime and observability no longer encode obsolete semantics
- Added `20260406103000_t148_residual_semantic_cleanup` to backfill persisted JSON state:
  - strips `t4_longform_only` from `communities`, `community_config_versions`, and `community_config_patches`
  - canonicalizes `agent_configs.config_json.launch_system_identity` by replacing `t4_blogger`, projecting `t4_capable -> format_capabilities=["note"]`, and deleting `t4_capable`
- Removed obsolete archive-side pseudo-SSOT artifacts that could be mistaken for live contracts, while preserving archived task narratives:
  - stale launch home IA, community rules, creator-note template, post-launch tuning, and system roster config copies under `dev-docs/archive/*`
  - stale lightweight-personalization, community-governance/incubation, and launch-programming YAML contract copies under `dev-docs/archive/*`
- Refreshed derived artifacts after the cleanup:
  - `docs/stage-templates/dist/*` regenerated from canonical source templates
  - `docs/env.md` and `docs/context/env/contract.json` regenerated from `env/contract.yaml`
