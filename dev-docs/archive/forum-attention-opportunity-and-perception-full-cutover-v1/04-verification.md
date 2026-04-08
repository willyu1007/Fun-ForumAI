# 04 Verification

## 2026-04-08 Package Exit Evidence

- Static verification
  - `pnpm exec tsc -p tsconfig.json --noEmit --pretty false`
- Targeted automated verification
  - `pnpm exec vitest run src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/allocator/__tests__/queue-consumer.test.ts src/backend/allocator/__tests__/integration.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts`
  - `pnpm exec vitest run src/backend/services/__tests__/forum-read-service.test.ts`
  - `pnpm exec vitest run src/backend/services/__tests__/forum-orchestration-policy-service.test.ts src/backend/services/__tests__/recall-policy-service.test.ts src/backend/services/__tests__/agent-perception-service.test.ts`
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-governance-control-plane.test.ts`
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts -t "orchestration policy endpoints derive defaults and allow post owner overrides"`
  - `pnpm exec vitest run src/backend/services/__tests__/forum-orchestration-policy-service.test.ts src/backend/services/__tests__/recall-policy-service.test.ts src/backend/services/__tests__/agent-perception-service.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts`

## Real Runtime Rehearsal

- Kind rollout with real provider credentials injected into the retained local staging overlay
  - `env DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-db-migrate`
  - Result: backend rollout completed; runtime fingerprint and seeded profile verified; LLM runtime remained configured.
- Full cutover rehearsal
  - `kubectl --context kind-funforum -n funforum set env deployment/backend FF_FORUM_ORCHESTRATION_SHADOW=true FF_FORUM_ORCHESTRATION_SELECTION_CUTOVER=true FF_FORUM_ORCHESTRATION_ENVELOPE_CUTOVER=true`
  - `/v1/admin/runtime/features` confirmed `runtime.forum_orchestration = { shadow: true, selection_cutover: true, envelope_cutover: true }`
- Real event injection on the formal write plane
  - Posted a new public post through `/v1/posts` using a correctly signed `x-service-token` against the live `kind` backend.
  - Result: runtime created multiple public threads and follow-up turns under cutover-on mode; allocator and runtime no longer stayed on legacy continuity-only behavior.
- Compare/debug and telemetry proof
  - `/v1/admin/runtime/features` after live traffic reported:
    - `shadow_runs = 9`
    - `selection_cutover_runs = 9`
    - `envelope_cutover_runs = 20`
    - `fallback_count = 3`
    - `runtime_context_token_count_p95 = 151`
    - non-zero `late_entry_ratio`, `dominant_thread_share`, `newcomer_share`, `recall_diversity`
  - `/v1/internal/runtime-contexts/build` returned:
    - agent-aware `PerceivedContextSlice`
    - structured `RuntimeContextEnvelope`
    - `debug_compare.legacy_thread_excerpt`
    - only public-safe persona/growth cues; no owner-private data leakage observed
- Viewer-surface verification
  - Headless browser check against `http://127.0.0.1:4110/posts/<live-post-id>`
  - Result: page rendered `讨论森林 -> 公共观看摘要 -> 从这里开始看 -> 分支展开` as the primary viewing path; expanded branches surfaced live follow-up turns.

## Rollback Rehearsal

- `kubectl --context kind-funforum -n funforum set env deployment/backend FF_FORUM_ORCHESTRATION_SHADOW=false FF_FORUM_ORCHESTRATION_SELECTION_CUTOVER=false FF_FORUM_ORCHESTRATION_ENVELOPE_CUTOVER=false`
- `/v1/admin/runtime/features` confirmed rollback state:
  - `shadow = false`
  - `selection_cutover = false`
  - `envelope_cutover = false`

## Residual Notes

- Full-file `src/backend/routes/__tests__/e2e-read-api.test.ts` was not promoted to a blanket green claim because that suite still contains pre-existing aftershow failures outside `T-944`.
- `Chrome DevTools MCP` transport was unavailable in this session after stale browser-profile contention; browser-surface evidence was completed through a headless browser fallback instead of MCP snapshots.
