# 04 Verification

## Completed

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `pnpm exec vitest run src/backend/launch/__tests__/community-rules.test.ts src/backend/launch/__tests__/programming-contracts.test.ts src/backend/launch/__tests__/semantic-taxonomy-registry.test.ts src/backend/services/__tests__/community-governance-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/launch-programming-ops-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: 8 files passed, 90 tests passed
- `pnpm exec vitest run src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/agents/components/__tests__/AgentHoverCard.test.tsx src/frontend/features/forum/pages/__tests__/HomePage.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/forum/components/__tests__/PostCard.test.tsx src/frontend/features/forum/components/__tests__/PostCompact.test.tsx`
  - Result: 7 files passed, 46 tests passed
- `pnpm exec vitest run src/backend/llm/__tests__/llm-client.test.ts src/backend/llm/__tests__/registry-contract.test.ts src/backend/llm/__tests__/llm-gateway.test.ts`
  - Result: 3 files passed, 34 tests passed
- `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs --strict`
  - Result: OK, registries are structurally and contractually valid
- `pnpm exec tsc --noEmit`
  - Result: passed
- `pnpm exec tsc -b`
  - Result: passed after repo-wide follow-up cleanup on 2026-04-09
- `git diff --check`
  - Result: passed
- `pnpm stage:templates:validate`
  - Result: passed, 50 templates validated and 20 launch templates exported
- `node .ai/tests/run.mjs --suite environment`
  - Result: passed

## Live Rehearsal

- `DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** pnpm k8s:staging:local -- --k8s-context kind-funforum`
  - Result: local kind staging deployed successfully with real Qwen and Doubao credentials
  - Runtime fingerprint before final hotfix: `sha256:e4ee368b59c82fe6f168b0d15633740b628677fe6a0f9ab439402f2126bba54a`
  - Runtime fingerprint after final hotfix: `sha256:babdc9de30b0d662365375735b438fbf7165beefb01457c03d770e5c71aa105f`
- `kubectl --context kind-funforum exec -n funforum deploy/backend -- pnpm search:rebuild-docs`
  - Result: rebuild completed, no legacy creator slug search documents remained in `post_search_docs`, `thread_search_docs`, or `community_search_docs`
- `kubectl --context kind-funforum exec -i -n funforum deploy/postgres -- psql -U postgres -d llm_forum -v ON_ERROR_STOP=1 -f - < prisma/migrations/20260406103000_t148_residual_semantic_cleanup/migration.sql`
  - Result: migration SQL executed successfully after fixing a null-identity guard in the `agent_configs` normalizer
- `kubectl --context kind-funforum exec -n funforum deploy/postgres -- psql -U postgres -d llm_forum -At -c "<residual-count-query>"`
  - Result: all residual counts dropped to `0` for:
    - `agent_configs` containing `t4_blogger|t4_capable`
    - `communities.rules_json` containing `t4_longform_only`
    - `community_config_versions.rules_json` containing `t4_longform_only`
    - `community_config_patches.patch_json/proposed_rules_json` containing `t4_longform_only`
- `kubectl --context kind-funforum logs -n funforum deploy/backend --since=10m --tail=500`
  - Result: live environment exposed and then confirmed the closure of three runtime defects:
    - fixed image packaging drift by shipping full `config/` into the backend image
    - fixed chat-reply route escalation into nonexistent `base` profiles
    - fixed scheduled-post stage gating so the runtime no longer burns LLM calls on agents that cannot legally post
- `curl -sS -X POST http://127.0.0.1:4000/v1/dev/runtime/post | jq`
  - Result before final scheduler hotfix: `{"triggered":true,"error":"Selected agent has no stage-eligible writable communities"}`
  - Result after final scheduler hotfix: `{"triggered":false,"error":"No stage-eligible posting candidates"}`
- `curl -sS http://127.0.0.1:4000/v1/dev/runtime/post/stats | jq`
  - Result after final scheduler hotfix: scheduler reports `lastSkipAt`, confirming skip cooldown instead of 5s failure churn
- `kubectl --context kind-funforum logs -n funforum deploy/backend --since=2m --tail=200`
  - Result after final scheduler hotfix: no repeated `scheduled-post: failed` runtime-loop lines

## Browser E2E

- Chrome DevTools MCP against `http://127.0.0.1:3001`
  - `/communities` and `/admin` only surfaced canonical creator slugs: `creator-recommendation` and `creator-relationship`
  - `/v1/posts/:id`, `/v1/communities`, and `/v1/search?tab=communities` no longer exposed `is_t4`, legacy `editorial_shelf`, `t4-picks`, or `t4-relations`
  - `/v1/admin/runtime/features` confirmed adapter-attributed LLM usage in live data
- Chrome console audit on `/admin`
  - Before frontend accessibility fix: DevTools reported unlabeled form controls and fields missing `id`/`name`
  - After fixing `GovernanceTab`, `AgentRiskProfileCard`, and `DisclosureCapCard`: only Vite/React DevTools informational messages remained; no form accessibility issues were reported

## Targeted Regression Suites Added This Round

- `pnpm exec vitest run src/backend/runtime/__tests__/post-scheduler.test.ts src/backend/runtime/__tests__/runtime-loop.test.ts`
  - Result: 2 files passed, 13 tests passed
  - Added coverage for:
    - scheduler skip cooldown when no stage-eligible posting candidates exist
    - candidate selection constrained to agents with stage-eligible writable communities
- `pnpm exec vitest run src/frontend/features/admin/pages/__tests__/AdminPanel.test.tsx src/frontend/features/admin/pages/admin-panel/__tests__/AdminUsersTab.test.tsx`
  - Result: 2 files passed, 7 tests passed
- `pnpm exec vitest run src/backend/launch/__tests__/community-rules.test.ts src/backend/launch/__tests__/programming-contracts.test.ts src/backend/launch/__tests__/semantic-taxonomy-registry.test.ts src/backend/launch/__tests__/system-roster.test.ts src/backend/launch/__tests__/lightweight-personalization.test.ts src/backend/launch/__tests__/visual-rollout.test.ts src/backend/stage/__tests__/stage-spec.test.ts src/backend/stage/__tests__/stage-template-ops.test.ts src/backend/stage/__tests__/public-director-contract.test.ts src/backend/routes/__tests__/stage-template-scripts.test.ts src/backend/services/__tests__/aftershow-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/launch-programming-ops-service.test.ts src/backend/services/__tests__/public-scene-catalog-service.test.ts src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts`
  - Result: 17 files passed, 133 tests passed
  - Added regression coverage for:
    - canonical-only creator-note template contracts
    - rejection of legacy roster aliases and legacy lightweight-personalization keys
    - stage-spec/stage-template cleanup after removing `t4_longform_only`
    - renamed strict-publication trust-context gates and creator-note packaging fixtures
- `pnpm vitest run src/frontend/features/auth/components/__tests__/UnifiedAuthCard.test.tsx src/frontend/features/auth/pages/__tests__/AuthPageRedirect.test.tsx src/frontend/features/user/pages/__tests__/SafetyCenterPage.test.tsx src/backend/allocator/__tests__/allocator.test.ts src/backend/media/__tests__/media-generation-service.test.ts src/backend/media/__tests__/media-semantic-service.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/services/__tests__/attention-opportunity-broker.test.ts`
  - Result: 8 files passed, 50 tests passed
- `pnpm vitest run src/backend/services/__tests__/forum-read-service.test.ts`
  - Result: 1 file passed, 31 tests passed
