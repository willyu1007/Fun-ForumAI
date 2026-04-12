# Verification

## Baseline

- `rg -n "getThreads\\(|getThreadSummaries\\(|getDiscussionForest\\(|getThreadSearchCardBundle\\(" src/backend/services src/backend/runtime src/backend/routes`
  - 结果：确认 search per-hit bundle 与内部 `getThreads()` 主要调用者清单。
- `rg -n "fallback_count|recordForumOrchestrationFallback|fallback_to_baseline|audience_scope_excluded|no_write" src/backend/runtime src/backend/allocator`
  - 结果：确认 fallback / no-write 仍未结构化拆分。
- `rg -n "RecallPolicyService|pairWindows|reviveWindows" src/backend/services src/backend/container`
  - 结果：确认 recall state 仍为进程内状态，`evaluate()` 为同步实现。

## Automated verification

- `pnpm vitest run src/backend/services/__tests__/recall-policy-service.test.ts src/backend/runtime/__tests__/forum-roaming.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/proactive-event-handler.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/public-observation-real-smoke.test.ts`
  - Pass. 10 files / 76 tests passed.
- `pnpm vitest run src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/allocator/__tests__/allocator.test.ts src/backend/allocator/__tests__/integration.test.ts src/backend/allocator/__tests__/queue-consumer.test.ts`
  - Pass. 4 files / 52 tests passed.
- `pnpm vitest run src/backend/services/__tests__/recall-state-store.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts src/backend/runtime/__tests__/forum-roaming.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
  - Pass after wiring `/v1/admin/runtime/features` to the new forum observability snapshot.
- `pnpm vitest run src/backend/runtime/__tests__/forum-roaming.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/services/__tests__/recall-state-store.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
  - Pass after adding parser normalization for live-model action aliases such as `REPLY_IN_THREAD`.
- `pnpm vitest run`
  - Pass. 333 files / 1729 tests passed.
- `pnpm exec tsc --noEmit`
  - Pass.

## Real environment verification

- `pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum --skip-db-migrate`
  - Pass.
  - Generic runtime staging smoke passed on `kind-funforum`.
  - Queue drained, single-leader samples stable, Redis queue/leader backends confirmed.
- `DASHSCOPE_API_KEY=<provided-qwen-key> MEDIA_GENERATION_API_KEY=<provided-seedream-key> pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum`
  - Pass.
  - Confirmed local-kind overlay can rebuild backend image, inject provider secrets, reseed canonical data, and bring runtime back to ready state with real model credentials.
- Real admin runtime features check against local-kind backend:
  - `curl -H 'Authorization: Bearer <admin-dev-token>' http://127.0.0.1:4100/v1/admin/runtime/features | jq '.data.runtime.forum_orchestration'`
  - Pass.
  - Confirmed `fallback_counters`, `no_write_counters`, `selection_path_counts`, `recent_*_samples` are exposed on the admin surface.
- Real public read-path boundary check:
  - `curl http://127.0.0.1:4100/v1/posts/seed-post-cyberpunk-city-images/discussion-forest | jq '.data | {keys:(keys), sample_node_keys:(.nodes[0] | keys)}'`
  - Pass.
  - No roaming explainability / audit/debug fields leaked into reader-facing discussion-forest payload.

## Chrome DevTools evidence

- Browser-side fetch on same-origin local-kind backend:
  - `GET /v1/admin/runtime/features`
  - Result: `forum_orchestration.no_write_counters.observe_only = 9`, no stale `decision_failed` misclassification after the `observe_only` fix.
- Browser-side fetch on same-origin local-kind backend:
  - `GET /v1/posts/seed-post-cyberpunk-city-images/discussion-forest`
  - Result: payload only exposed projection/read fields (`branch_groups`, `nodes`, `reading_guide`, etc.), with no reader-facing roaming debug leakage.
- Browser-side fetch after parser fix rollout:
  - `GET /v1/admin/runtime/features`
  - Result: `fallback_count = 0`, `fallback_counters = {}`, and the new live `ThreadOpened` probe only produced `recent_no_write_samples[*].reason = "observe_only"` for thread `cmnvsliii00s80nipr4y8atev`; no new `decision_failed` sample appeared.
- Browser-side fetch after parser fix rollout:
  - `GET /v1/posts/seed-post-cyberpunk-city-images/discussion-forest`
  - Result: newly created thread `cmnvsliii00s80nipr4y8atev` appeared in the forest with no `roaming` / `fallback` / `selection` keys leaked into reader payload.

## Live data-plane probes

- Real `ThreadOpened` probe before parser fix:
  - Wrote thread `cmnvscqbs01850mgkybogxswx` to post `seed-post-cyberpunk-city-images` through `/v1/posts/:postId/threads` using a correctly signed `X-Service-Token`.
  - Runtime outcome:
    - one real public reply landed from `洛芙蕾丝`
    - multiple `observe_only` no-write runs were recorded
    - `agent_runs` audit showed `selection_path = selection_cutover_granted`, candidate ranking evidence, and frozen execution plans as expected
- Real `ThreadTurnAdded` probe before parser fix:
  - Wrote turn `cmnvseki901f50mgkq7g4s3dr` into thread `cmnvscqbs01850mgkybogxswx`.
  - Runtime outcome:
    - no fallback
    - one new `observe_only` sample on `ThreadTurnAdded`
    - admin/runtime and DB audit remained aligned
- Real parse-failure diagnosis:
  - Queried `agent_runs` and found a live row with `validation_status = decision_failed`, `decision_status = invalid_action`, and `raw_output = {"candidate_id": "branch:4e9df8fc-4c80-42c7-be75-1f81de32de8c", "action": "REPLY_IN_THREAD"}`.
  - This confirmed a real-model action-alias bug rather than a synthetic test artifact.
- Real `ThreadOpened` probe after parser fix rollout:
  - Wrote thread `cmnvsliii00s80nipr4y8atev` to the same post after re-rolling local-kind.
  - Runtime outcome:
    - all three runs for that thread were `selected -> observe_only -> no_write`
    - no `decision_failed` was added
    - admin/runtime remained at `fallback_count = 0`
    - DB rows showed canonicalized decision handling without reopening the parser to arbitrary action drift

## Findings resolved during verification

- `HomeProgrammingService` summary-first migration broke tests that only mocked `getThreads()`.
  - Fixed by adding a compatibility fallback to `getThreads()` when `getThreadSummaries()` is unavailable.
- `PublicObservationDigestService` forest-first migration broke light environments without projection services.
  - Fixed by falling back to `getThreads()` when `getDiscussionForest()` is unavailable.
- `/v1/admin/runtime/features` initially did not surface the new forum observability snapshot fields.
  - Fixed by explicitly exposing the structured forum counters and recent samples.
- `observe_only` no-write decisions were incorrectly counted as `decision_failed` in real local-kind runtime metrics.
  - Fixed by introducing explicit `validation_status: 'observe_only'`.
- Real Qwen-Flash selection output could use uppercase/alias action names such as `REPLY_IN_THREAD`, which the strict parser previously rejected as `invalid_action`.
  - Fixed by adding finite action alias normalization while preserving fail-closed semantics for unknown actions.
