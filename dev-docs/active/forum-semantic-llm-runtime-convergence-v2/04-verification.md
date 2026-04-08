# 04 Verification

## Startup

- 2026-04-08: `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass (`[ok] Sync complete.`)
- 2026-04-08: `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass (`[ok] Lint passed.`)

## Final checks

### Wave 1 backend verification

- 2026-04-08: `pnpm -s test -- --run src/backend/stage/__tests__/stage-spec.test.ts src/backend/launch/__tests__/community-rules.test.ts src/backend/routes/__tests__/e2e-community-proposals-control-plane.test.ts src/backend/routes/__tests__/e2e-community-config-control-plane.test.ts src/backend/services/__tests__/community-config-service.test.ts src/backend/services/__tests__/aftershow-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/participation-contract-service.test.ts`
  - pass
  - 8 test files passed
  - 72 tests passed

### Wave 2 frontend verification

- 2026-04-08: `pnpm -s test -- --run src/frontend/shared/utils/__tests__/public-author.test.ts src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx`
  - pass
  - 7 test files passed
  - 50 tests passed
- 2026-04-08: `pnpm exec vitest run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - pass
  - 1 test file passed
  - 21 tests passed
  - confirms creator open-reply posts no longer render an audience rail from an empty fallback stub
- 2026-04-08: `pnpm exec vitest run src/frontend/shared/utils/__tests__/public-author.test.ts src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/agents/components/modal/__tests__/TabIntro.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/widgets/shell/__tests__/ShellTopBarContainer.test.tsx`
  - pass
  - 8 test files passed
  - 59 tests passed
  - confirms primary forum/search/agent/shell surfaces still render correctly after `public-author.ts` was reduced to semantic-only helper reads and fixtures were updated to canonical `public_projection` payloads

### Wave 3 LLM verification

- 2026-04-08: `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
  - pass
  - registry structurally and contractually valid
- 2026-04-08: `node .ai/skills/workflows/llm/llm-engineering/scripts/check-llm-config-keys.mjs`
  - pass
  - all in-scope LLM config keys registered
- 2026-04-08: `pnpm -s test -- --run src/backend/llm/__tests__/llm-client.test.ts src/backend/llm/__tests__/llm-gateway.test.ts src/backend/llm/__tests__/registry-contract.test.ts`
  - pass
  - 3 test files passed
  - 38 tests passed

### Grep / contract checks

- 2026-04-08: `rg -n "audience_zone_enabled|agent_reads_audience_zone|agent_reply_via_aftershow" src/shared/semantic-taxonomy.ts src/backend/stage/stage-spec.ts src/backend/validation/schemas.ts src/backend/launch/community-rules.ts src/backend/routes/stage-incubation.ts src/backend/services/community-governance-service.ts`
  - pass
  - no matches in runtime mainline targets
- 2026-04-08: `rg -n "allowed_content_shapes" config/launch docs/stage-templates/source/templates src/backend/stage src/backend/routes src/backend/services src/backend/validation`
  - pass
  - no matches in live/runtime targets
  - note: the token intentionally remains only in the launch-rule guardrail implementation and negative tests
- 2026-04-08: `rg -n "^[[:space:]]+(note_templates|cover_modes|creator_slots|feed_bias):" config/launch/launch_community_rules.v1.yaml`
  - pass
  - no legacy creator-note alias keys in live launch rules
- 2026-04-08: `rg -n "policyId:" src/frontend/features/forum/pages/PostDetailPage.tsx src/frontend/features/forum/pages/HighlightsPage.tsx src/frontend/features/forum/components/ThreadList.tsx src/frontend/features/forum/components/DiscussionForest.tsx src/frontend/features/search/pages/SearchPage.tsx src/frontend/features/agents/components/AgentHoverCard.tsx src/frontend/features/agents/components/modal/TabIntro.tsx`
  - pass
  - all targeted primary surfaces pass explicit semantic badge surface policies
- 2026-04-08: `rg -n "compat_display|compat_badges|readDisplayBadgeLabels|selectCompatAuthorBadgeSlots" src/frontend/shared/utils/public-author.ts`
  - pass
  - no matches; shared author helper no longer keeps compat badge/projection fallback logic on the active frontend path
- 2026-04-08: `rg -n "agent-badge-view|attachPublicAgentBadges|getFeedAuthorIdentity|resolvePublicDisplayBadges" src/backend src/frontend`
  - pass
  - no matches; the stale route bridge, legacy feed-author helper, and dead compat badge helper were deleted after canonical presentation cutover
- 2026-04-08: `rg -n "AuthorBadgeRail|author-badge-icons|author-identity" src/frontend`
  - pass
  - no matches; obsolete forum badge helper files were deleted and no runtime references remain
- 2026-04-08: `rg -n "public_participation_mode: open_reply|audience_signal_ingestion: none|agent_human_response_mode: direct_reply" config/launch/launch_community_rules.v1.yaml docs/stage-templates/source/templates/stage-creator-01.yaml`
  - pass
  - creator live config and template both encode main-thread-only interaction contract

### Global final check

- 2026-04-08: `pnpm exec tsc --noEmit`
  - pass
- 2026-04-08: `pnpm exec tsc --noEmit`
  - pass
  - rerun after creator audience-rail gating fix
- 2026-04-08: `pnpm exec tsc --noEmit`
  - pass
  - rerun after semantic-only frontend helper cleanup and canonical fixture updates
- 2026-04-08: `pnpm exec tsc --noEmit`
  - pass
  - rerun after canonicalizing `buildAgentPublicAuthorPresentation()` and deleting the stale `agent-badge-view` bridge
- 2026-04-08: `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/global-highlights-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/search/__tests__/search-service.test.ts src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx`
  - pass
  - 8 test files passed
  - 100 tests passed
  - proves the final semantic-only author presentation path works across feed/read/search/highlights/dev-seed/owner-agent surfaces without the deleted compat bridge

## Post-implementation E2E

- 2026-04-08: `pnpm exec vitest run src/backend/dev/__tests__/dev-seed-fixtures.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts`
  - pass
  - 2 test files passed
  - 6 tests passed
  - proves canonical dev-seed fixtures keep creator `open_reply + none + direct_reply` and that `/v1/dev/seed` preserves open main-thread writes while rejecting creator audience writes
- 2026-04-08: `pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum --seed-profile canonical --dockerfile /tmp/llm-forum-e2e.Dockerfile`
  - pass
  - local kind rehearsal rebuilt the runtime, injected the redacted real-provider secret into `secret/forum-app-secret`, ran migrations, seeded canonical fixtures, and brought the staging stack ready
  - note: generic smoke remained intentionally skipped because the local selector exposed only one ready backend pod
- 2026-04-08: `curl -sS http://127.0.0.1:4102/v1/posts/seed-post-cyberpunk-city-images | jq '{interaction_contract, audience_thread_meta, threads_count}'`
  - pass
  - showed the creator seed post now resolves `open_reply + none + direct_reply`
  - exposed the residual empty `audience_thread_meta` stub that later drove the frontend rail fix
- 2026-04-08: `curl -sS -X POST http://127.0.0.1:4102/v1/viewer/posts/seed-post-cyberpunk-city-images/public-threads ...`
  - pass
  - accepted a real human main-thread branch on the creator seed post
- 2026-04-08: `curl -sS -X POST http://127.0.0.1:4102/v1/viewer/posts/seed-post-cyberpunk-city-images/audience-messages ...`
  - pass
  - returned `403 FORBIDDEN` with `Post does not allow viewer audience messages`
- 2026-04-08: `pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum --seed-profile canonical --dockerfile /tmp/llm-forum-e2e.Dockerfile`
  - pass
  - rerun after the `PostDetailPage` rail fix to rebuild the frontend assets into the kind runtime
- 2026-04-08: `curl -sS http://127.0.0.1:4101/v1/posts/seed-post-cyberpunk-city-images/participation-contract | jq '.data | {public_participation_mode, audience_lane, stage_open_reply}'`
  - pass
  - verified the rebuilt runtime still exposes creator `open_reply`, `audience_lane.enabled=false`, and `stage_open_reply.enabled=true`
- 2026-04-08: `curl -sS -X POST http://127.0.0.1:4101/v1/viewer/posts/seed-post-cyberpunk-city-images/public-threads ...`
  - pass
  - accepted a second creator main-thread reply after the frontend rebuild
- 2026-04-08: `curl -sS -X POST http://127.0.0.1:4101/v1/viewer/posts/seed-post-cyberpunk-city-images/audience-messages ...`
  - pass
  - still returned `403 FORBIDDEN`, proving the frontend rebuild did not regress the backend contract
- 2026-04-08: Chrome DevTools MCP against `http://127.0.0.1:4101/posts/seed-post-cyberpunk-city-images`
  - pass
  - verified the creator post page now shows:
    - the public stage composer (`发起新的公开分支`)
    - discussion-forest entries including the real human-created thread
    - the right rail placeholder (`帖子上下文区`) instead of a disabled `观众讨论` panel
  - this closes the product-facing “main-thread only” requirement at the actual UI layer

## Notes

- Targeted greps for generic `mode` fields produced unrelated aftershow/media-rollout hits and were excluded from acceptance evidence.
- Negative LLM registry tests were finalized against structured `RegistryResolutionError.details.issues` rather than brittle message-only matching.
- Shared frontend helper cleanup intentionally removed compat fallback reads from `public-author.ts`; the affected Search and Shell tests had to be updated to provide canonical `public_projection` fixture data instead of outdated `tagline/public_bio` inputs.
- The final cleanup removed the old `/v1/me/agents` compat bridge entirely; route/e2e coverage now asserts semantic `public_projection` / `public_proof` fields instead of flat `badges` / `tagline` payloads.
