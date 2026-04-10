# 04 Verification

## Startup

- 2026-04-08: `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass (`[ok] Sync complete.`)
- 2026-04-08: `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass (`[ok] Lint passed.`)

## Final checks

### Residual anchor-truth checks

- selected/perceived/write anchor chain regression
- runtime serialization snapshot including browse reason / allowed actions / route constraints
- selected-vs-actual-anchor mismatch metric evidence

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
- 2026-04-09: `pnpm exec vitest run src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts`
  - pass
  - 4 test files passed
  - 20 tests passed
  - covers:
    - branch-revive writeback uses resolved `final_write_anchor_turn_id`
    - missing `reply_thread_id` fails closed
    - event target stays separate from prompt-facing focus
    - legacy flatten no longer rewrites null anchor to `thread.id`
    - `instruction.audit_metadata.forum_targeting` carries full triad plus `written_anchor_turn_id`
    - aggregate mismatch metrics accumulate for selected-vs-actual and resolved-vs-written anchor drift
- 2026-04-09: `pnpm exec tsc --noEmit`
  - pass
  - confirms the new runtime-only `forum_targeting` contract, parser changes, audit metadata wiring, and metrics additions compile cleanly
- 2026-04-09: `pnpm exec vitest run src/backend/allocator/__tests__/quota-calculator.test.ts src/backend/allocator/__tests__/integration.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts`
  - pass
  - 6 test files passed
  - 43 tests passed
  - confirms the thread-scoped quota fix does not regress T-945 runtime targeting/writeback behavior
- 2026-04-09: `pnpm exec vitest run src/backend/llm/__tests__/credential-broker.test.ts src/backend/allocator/__tests__/quota-calculator.test.ts src/backend/allocator/__tests__/integration.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts`
  - pass
  - 7 test files passed
  - 48 tests passed
  - confirms the live concurrency follow-up fix:
    - saturated primary credential pools still surface `RateLimitError`
    - broken lower-priority fallback secrets no longer masquerade as missing primary Qwen credentials
- 2026-04-09: `pnpm exec tsc --noEmit`
  - pass
  - rerun after the allocator quota-scope fix and credential-broker error-classification fix
- 2026-04-09: `pnpm exec vitest run src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - pass
  - 3 test files passed
  - 33 tests passed
  - confirms route-handoff gating stays aligned across forest, timeline, and post-detail composer guidance
- 2026-04-09: `pnpm exec tsc --noEmit`
  - pass
  - rerun after the frontend route-handoff gating cleanup and shared writeability helper extraction
- 2026-04-09: `pnpm exec vitest run src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts src/backend/allocator/__tests__/quota-calculator.test.ts src/backend/allocator/__tests__/integration.test.ts src/backend/llm/__tests__/credential-broker.test.ts src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - pass
  - 10 test files passed
  - 83 tests passed
  - provides one combined regression packet for:
    - runtime anchor triad / writeback truth
    - thread-scoped quota and credential saturation fixes
    - forest / timeline / post-detail route-handoff UX gating

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
- 2026-04-09: local patched backend on `http://127.0.0.1:4101` using kind Postgres/Redis via port-forward (`55432 -> postgres`, `56379 -> redis`) and isolated runtime prefix `llm-forum:runtime:t945fix`
  - pass
  - seeded/used the live canonical `seed-post-cyberpunk-city-images` post, then replayed a real branch-revive thread with agent-authored turns
  - `POST /v1/internal/runtime-contexts/build` on revive focus turn `cmnrl3rgo002f4knohsx274xs` showed:
    - `browse_reason=REVIVE`
    - `focus_turn_id=cmnrl3rgo002f4knohsx274xs`
    - `selected_anchor_turn_id=cmnrl3rgo002f4knohsx274xs`
    - `actual_anchor_turn_id=cmnrl3ra700264knok4yuk4n2`
    - `allowed_actions=["IGNORE","REPLY"]`
  - `POST /v1/dev/runtime/tick` then processed the queued revive event successfully and produced public thread turns with persisted `anchor_turn_id=cmnrl3ra700264knok4yuk4n2`
  - `agent_runs` rows for trigger event `3ab26473-4608-4c11-b545-c8652401f736` persisted `output_json.audit_metadata.forum_targeting` with:
    - `focus_turn_id=cmnrl3rgo002f4knohsx274xs`
    - `selected_anchor_turn_id=cmnrl3rgo002f4knohsx274xs`
    - `actual_anchor_turn_id=cmnrl3ra700264knok4yuk4n2`
    - `final_write_anchor_turn_id=cmnrl3ra700264knok4yuk4n2`
    - `written_anchor_turn_id=cmnrl3ra700264knok4yuk4n2`
  - this closes the required live evidence chain:
    - event target vs perceived focus remain separate
    - final write anchor follows resolved actual anchor
    - persisted writeback matches audit metadata rather than falling back to the event target
- 2026-04-09: standalone `chrome-devtools-mcp@latest --headless --isolated --viewport 1440x1200 --slim` against `http://localhost:3000/posts/seed-post-cyberpunk-city-images`
  - pass
  - dev-auth cookie switch succeeded through the live Vite proxy (`POST /v1/auth/dev/switch`)
  - default post-detail state showed:
    - `讨论森林` and `时间线`
    - `公共观看摘要`
    - `发起新的公开分支`
  - route-handoff cards now stay single-track:
    - the `查看 Aftershow` article no longer contains `回应这里`
    - the `转入私聊` article no longer contains `回应这里`
  - clicking a real forest `回应这里` button still switched the composer into anchor mode with:
    - `回应当前节点`
    - `当前锚点`
    - `清除锚点`
    - `发送回应`
  - this closes the browser-side Gate requirement that:
    - forest-first post detail remains intact
    - anchor reply mental model still works
    - route handoff no longer mixes public reply affordances into routed branches
- 2026-04-10: `rg -n "targetThreadTurn|ctx\\.targetThreadTurn" src/backend/runtime src/frontend src/shared`
  - pass
  - mainline matches now reduce to:
    - `ContextBuilder` event-target assembly and compat focus fallback
    - prompt-layer compat input (`targetThreadTurnId`)
    - type declarations and tests
  - no `response-parser` final write path or forum media-planning path now consumes `targetThreadTurn` as write-target truth.
- 2026-04-10: `pnpm exec vitest run src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts src/backend/services/__tests__/thread-interaction-resolver.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - passed
  - 10 files, 119 tests
- 2026-04-10: Gate 1 review verdict
  - PASS
  - branch revive / triad separation / mismatch metric evidence remain sufficient for `T-947` and `T-942` to treat anchor semantics as frozen.

## Notes

- 2026-04-09 the built-in desktop Chrome DevTools MCP transport remained closed (`Transport closed`), so browser verification used a standalone `chrome-devtools-mcp` session over stdio/newline JSON instead of the in-app bridge.
- Targeted greps for generic `mode` fields produced unrelated aftershow/media-rollout hits and were excluded from acceptance evidence.
- Negative LLM registry tests were finalized against structured `RegistryResolutionError.details.issues` rather than brittle message-only matching.
- Shared frontend helper cleanup intentionally removed compat fallback reads from `public-author.ts`; the affected Search and Shell tests had to be updated to provide canonical `public_projection` fixture data instead of outdated `tagline/public_bio` inputs.
- The final cleanup removed the old `/v1/me/agents` compat bridge entirely; route/e2e coverage now asserts semantic `public_projection` / `public_proof` fields instead of flat `badges` / `tagline` payloads.

## 2026-04-10 Strict Closure Extension

- `pnpm exec vitest run src/backend/services/__tests__/agent-public-projection-service.test.ts src/backend/services/__tests__/public-agent-relation-summary-service.test.ts src/frontend/widgets/dev/__tests__/DevBadgeDebugPanel.test.tsx`
  - pass
  - 3 test files passed
  - 5 tests passed
  - confirms the remaining author-side services no longer regress after switching from legacy highlights DTOs to semantic `public_projection / public_proof / top_chronicle`
- `pnpm exec vitest run scripts/lib/__tests__/launch-readiness.test.ts src/backend/launch/__tests__/visual-rollout.test.ts src/backend/launch/__tests__/community-rules.test.ts src/backend/launch/__tests__/programming-contracts.test.ts`
  - pass
  - 4 test files passed
  - 30 tests passed
  - confirms strict convergence gate and canonical-only launch/runtime contract tests stay green together
- `node -e "import('./scripts/lib/launch-readiness.mjs').then(({ validateStrictSemanticConvergence }) => console.log(JSON.stringify(validateStrictSemanticConvergence(), null, 2)))"`
  - pass
  - returned `{ "ok": true, "detail": "strict semantic convergence gate passed" }`
- `pnpm exec vitest run src/backend/dev/__tests__/launch-semantic-canonicalization.test.ts`
  - pass
  - 1 test file passed
  - 3 tests passed
  - locks the historical alias map used by the new launch semantic backfill CLI
- `pnpm launch:canonicalize:semantic-fields -- --scope=all`
  - pass with environment note
  - CLI executed and returned structured dry-run summary
  - current local database is not rollout-ready for this step and reported missing tables:
    - `post_search_docs`
    - `thread_search_docs`
    - `viewer_public_view_events`
  - this is treated as an environment readiness note, not a code failure; apply mode remains blocked until the target DB contains those tables
- `pnpm exec tsc -p tsconfig.json --noEmit --pretty false`
  - pass
  - confirms the strict-closure extension compiles after the author/search/runtime refactor
- `pnpm exec vitest run scripts/lib/__tests__/launch-readiness.test.ts src/backend/dev/__tests__/launch-semantic-canonicalization.test.ts src/backend/launch/__tests__/visual-rollout.test.ts src/backend/launch/__tests__/community-rules.test.ts src/backend/launch/__tests__/programming-contracts.test.ts src/backend/services/__tests__/agent-public-projection-service.test.ts src/backend/services/__tests__/public-agent-relation-summary-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/global-highlights-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/dev-badge-debug.test.ts src/frontend/widgets/dev/__tests__/DevBadgeDebugPanel.test.tsx`
  - pass
  - 14 test files passed
  - 129 tests passed
  - covers the full strict-closure touch surface across launch/runtime, read/search, author presentation, dev debug, and semantic backfill mapping
- `pnpm exec vitest run src/backend/launch/__tests__/system-roster.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/llm-gateway.test.ts`
  - pass
  - 3 test files passed
  - 51 tests passed
  - confirms the repo-wide gate cleanup after the strict-closure work did not regress launch system identity or LLM gateway/type contracts
- `pnpm lint`
  - pass
- `pnpm typecheck`
  - pass
- `pnpm verify:launch:ci`
  - pass
  - `18/18 passed, 0 failed`

## 2026-04-10 Repo Cleanup + E2E Closeout

- `pnpm exec vitest run src/backend/services/__tests__/achievement-chronicle-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/frontend/widgets/dev/__tests__/DevBadgeDebugPanel.test.tsx src/backend/services/__tests__/public-observation-real-smoke.test.ts scripts/lib/__tests__/launch-readiness.test.ts`
  - pass
  - 5 test files passed
  - 43 tests passed
  - confirms the strict-closure cleanup removed legacy author/highlight exits, dual-read forum media parity, and stale debug vocabulary without regressing forum read or public observation smoke behavior
- `pnpm exec playwright test tests/web/playwright/forum-orchestration.e2e.spec.ts tests/web/playwright/forum-p0.visual.spec.ts --project=desktop-light --project=mobile-light`
  - initial run exposed real regressions:
    - `HighlightsPage` crashed on stale highlight payload assumptions (`post.media.some`, later downstream incomplete boundary reads)
    - `CommunitiesPage` rendered `NaN` member counts from stale fixtures missing `active_member_count`
    - remaining `forum-p0.visual` failures were stable snapshot drift after those runtime issues were fixed
- `pnpm exec playwright test tests/web/playwright/forum-p0.visual.spec.ts --project=desktop-light --project=mobile-light --update-snapshots`
  - pass
  - regenerated 8 snapshots
  - updates the forum P0 visual baselines to the current post-cutover UI after stale fixture/test expectations were corrected
- `pnpm exec playwright test tests/web/playwright/forum-orchestration.e2e.spec.ts tests/web/playwright/forum-p0.visual.spec.ts --project=desktop-light --project=mobile-light`
  - pass
  - 12 tests passed
  - proves the browser paths are green after fixing runtime assumptions and refreshing the visual baselines
- `pnpm lint`
  - pass
- `pnpm typecheck`
  - pass
- `pnpm verify:launch:ci`
  - pass
  - `18/18 passed, 0 failed`
