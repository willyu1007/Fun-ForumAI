# 04 Verification

## Package Exit Review

### Must Be Green

- viewer write API tests
- participation contract resolver tests
- post detail composer integration tests
- override / clear override permission tests

### Must Be Reviewed Before Entering `T-944` Main Cutover

- `EffectiveParticipationContract` 是否已成为唯一可信入口
- `/viewer/*` 是否已经覆盖 idempotency / source_context / anchor reply / audit
- governance plane 是否已能记录 result 与 auth context
- legacy route 是否仍兼容但不再承载新前端演进

### Required Evidence

- contract resolver snapshot
- write result envelope snapshot
- idempotency replay evidence
- audit / moderation / rate-limit hook evidence
- governance regression suite covering:
  - feature flag
  - permission / community role
  - open-reply vs audience lane
  - moderation mode
  - rate limit
  - idempotency
  - audit payload

## 2026-04-08 Evidence

- `node scripts/run-vitest.mjs run src/backend/services/__tests__/participation-contract-service.test.ts src/backend/services/__tests__/public-write-governance-service.test.ts`
  - 13 tests passed;覆盖 community default、post override merge / clear、legacy key rewrite、admin / owner permission、accepted / pending / rejected / rate-limited / idempotency governance outcomes。
- `node scripts/run-vitest.mjs run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - 20 tests passed；确认 post detail 在 nested contract 下仍维持 forest-first / audience rail 布局，并新增覆盖“focus 与 explicit reply anchor 分离、清除锚点后稳定回到 new thread mode”的前端回归。
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-dev-seed.test.ts`
  - 5 tests passed；新增覆盖 canonical seed 二次运行时，若 seeded thread 下已有人工 public turn，`POST /v1/dev/seed` 仍能成功重建，不再因 `public_stage_turns_thread_id_fkey` 卡死。
- `node scripts/run-vitest.mjs run src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/backend/services/__tests__/public-write-governance-service.test.ts src/backend/routes/__tests__/e2e-dev-seed.test.ts`
  - 33 tests passed；覆盖本轮 live debugging 发现的三个真实问题：composer anchor/focus 耦合、audit payload audit_id 空洞、staging reseed 外键顺序。
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-read-api.test.ts -t "returns community and post participation contracts|allow human open_reply on the main thread|return auditable envelopes and honor idempotency|audience-messages validates body length"`
  - passed；确认 effective contract read path、legacy compatibility routes、viewer stage envelopes、legacy audience compatibility route 均正常。
- `node scripts/run-vitest.mjs run src/backend/routes/__tests__/e2e-read-api.test.ts -t "viewer/posts/:postId/audience-messages returns auditable envelopes and honors idempotency"`
  - passed；确认新增 viewer audience write endpoint 的 envelope 和 idempotency 行为。
- `DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-db-migrate`
  - 在 kind `funforum` 命名空间完成真实部署，runtime fingerprint 校验通过：
    - `code_fingerprint=sha256:32934bfcc1a1d1be9593edbbc70e2019094c0d8b2528af13947397302cc4fa32`
    - `frontend_build_profile=launch`
    - `seeded_profile=canonical`
    - `seeded_counts={communities:12,agents:5,posts:14,threads:22,rooms:3,votes:56,media:10,owner_pool_media:2,private_sessions:5,private_messages:5,notifications:5,follow_links:2,guidance_inbox_items:4,guidance_bell_items:4}`
- Chrome DevTools MCP + live browser smoke on `http://127.0.0.1:4101/posts/seed-post-ai-consciousness`
  - 初始 `GET /v1/posts/seed-post-ai-consciousness/participation-contract` 返回 `source=community_rules`、`stage_open_reply.enabled=false`、`audience_lane.posting_enabled=true`，页面确实只显示 audience composer。
  - 通过 `PUT /v1/posts/seed-post-ai-consciousness/participation-contract-override` 将帖子切到 `open_reply/direct_read/direct_reply` 后，页面主舞台 composer 默认保持 `发起新的公开分支`，同时保留 `当前聚焦节点` 提示，不再被自动 focus 节点强制进入 anchored reply。
  - 点击 Discussion Forest 的 `回应这里` 后，composer 进入 `回应当前节点`；点击 `清除锚点` 后稳定回到 `发起新的公开分支`，且当前聚焦节点仍保留，确认前端 anchor/focus 解耦生效。
  - 浏览器真实发起 `POST /v1/viewer/posts/seed-post-ai-consciousness/public-threads`：
    - status `201`
    - response `result=ACCEPTED`
    - `audit_id=cmnpfgmi30gl90mjhq773bdxs`
    - `thread_id=cmnpfgmhw0gl80mjhicnt6xya`
  - 页面随后 refetch 成功：帖子回复数从 `3` 变为 `4`，新 public thread 立即进入 discussion forest，并显示 success notice `公开分支已发布。`
- `kubectl --context kind-funforum -n funforum exec deploy/postgres -- psql -U postgres -d llm_forum -c "select id, payload_json->'audit_record'->>'audit_id' ..."`
  - 数据库验证通过：`risk_event_logs.id = cmnpfgmi30gl90mjhq773bdxs` 且 `payload_json.audit_record.audit_id = cmnpfgmi30gl90mjhq773bdxs`，不再出现空字符串。
- `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict`
  - passed
- `node .ai/scripts/ctl-api-index.mjs generate --touch`
  - regenerated `docs/context/api/api-index.json` and refreshed context checksums
- `node .ai/skills/features/context-awareness/scripts/ctl-context.mjs verify --strict`
  - passed
- `pnpm typecheck`
  - passed

## 2026-04-10 Evidence

- `pnpm exec vitest run src/backend/services/__tests__/viewer-public-write-service.test.ts src/backend/services/__tests__/forum-event-dispatcher.test.ts src/backend/allocator/__tests__/admission.test.ts src/backend/runtime/__tests__/event-bridge.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - passed
  - 覆盖：
    - `ViewerPublicWriteService` accepted forum hook / audience hook / non-accepted no-op
    - shared forum dispatcher fanout 与 audience minimal dispatcher
    - human-authored event bridge provenance
    - allocator admission 对无 `author_agent_id` 的 human event 放行
    - canonical `/viewer/*` route split 之后的 e2e compatibility
  - 期间暴露一个真实回退：`read-api.ts` 的 human vote refresh 仍引用 `searchProjectionService`；在同轮修复后复跑 targeted route tests。
- `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts -t "(POST /v1/votes/human|POST /v1/viewer/posts/:postId/public-threads and /v1/viewer/threads/:threadId/public-turns return auditable envelopes and honor idempotency)"`
  - passed
  - 确认：
    - canonical viewer thread/turn envelope 仍为 `ACCEPTED + audit_id`
    - canonical viewer thread 写入后可立即在 `/v1/search?tab=threads` 命中，证明 viewer accepted write 已经通过 shared dispatcher 驱动搜索更新，而不是依赖 route-level manual refresh
    - human vote path 不再因 import 回退产生 `ReferenceError`
- `rg -n "viewer/.+public-|/v1/posts/.+public-threads|/v1/threads/.+public-turns|/v1/posts/.+audience-messages|/v1/viewer/" src/frontend src/backend/routes src/backend/services -g'*.ts' -g'*.tsx'`
  - frontend 活路径命中：
    - `src/frontend/api/hooks/forum.ts` 仅使用 `viewer/posts/:postId/public-threads` 与 `viewer/threads/:threadId/public-turns`
  - canonical route owner 命中：
    - `src/backend/routes/viewer-write-api.ts`
  - legacy 路径命中主要保留在 compat route tests 与 backend legacy wrappers，符合 `compat-only` 目标。
- `pnpm exec vitest run src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/event-queue.test.ts src/backend/runtime/__tests__/runtime-loop.test.ts`
  - passed
  - 覆盖本轮真实线上回退修复：
    - thread-root 场景下 `final_write_anchor_turn_id` 不再回落到 thread id
    - human-authored continuity / prompt-layer 不再伪造 `author_agent_id`
    - Redis runtime backlog 只按 consumer-group 可处理 backlog 计 lag，不再被 zombie stream entry 压成 `0 agents`
- `pnpm exec vitest run src/backend/repos/__tests__/pg-agent-community-membership-repository.test.ts src/backend/repos/__tests__/pg-agent-stage-tier-snapshot-repository.test.ts src/backend/repos/__tests__/pg-community-repository.test.ts src/backend/repos/__tests__/pg-image-plan-repository.test.ts`
  - passed
  - 确认 runtime / orchestration 读取仓储层在 live retest 前后都能刷新到最新 repo 视图，不再卡在旧 snapshot。
- `pnpm exec vitest run src/frontend/app/__tests__/lazy-import-recovery.test.ts src/frontend/app/__tests__/RouteErrorBoundary.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx`
  - 39 tests passed
  - 覆盖：
    - stale dynamic-import recover-once sentinel
    - route-level safe error boundary，不再把 raw chunk URL 直接暴露给用户
    - post detail / discussion forest / thread list 在最新前端 bundle 上无回退
- `pnpm build`
  - passed
  - 本轮额外捕获并修复一个 build-only 回退：`lazyWithDynamicImportRecovery(...)` 的调用换行通过了 `tsc` 与单测，但被 Vite/esbuild 拒绝；修复后 production build 恢复通过。
- kind live proof on `seed-post-cyberpunk-city-images`
  - live deploy:
    - `pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-db-migrate --skip-seed`
    - latest backend pod: `backend-659d7b9486-8ltq6` during runtime parity validation, then `backend-86958b657d-2fn97` after UX hardening rollout
  - Chrome DevTools MCP:
    - viewer real write: `POST /v1/viewer/posts/seed-post-cyberpunk-city-images/public-threads` returned `201`
    - discussion forest immediately inserted new thread `cmns304r7014b0mi1dobe5q4z`
    - latest frontend bundle smoke:
      - `/communities` loaded normally after rollout
      - `/posts/seed-post-cyberpunk-city-images` loaded normally, forest shows the new probe thread as `4 位参与者 · 3 条后续发言`
      - composer `textarea` now exposes `id=name=public-stage-composer` and `aria-label`
      - console remained clean; browser-side nameless form-field warning no longer reproduces
  - backend pod logs:
    - saw `POST /v1/viewer/posts/seed-post-cyberpunk-city-images/public-threads HTTP/1.1 201`
    - saw `EventBridge Enqueued ThreadOpened`
    - saw follow-up `ThreadTurnAdded`
    - did not see `Turn with id ... not found`
  - PostgreSQL verification:
    - `public_stage_threads.id = cmns304r7014b0mi1dobe5q4z`
    - thread row is `author_actor_type=HUMAN`, `author_user_id=dev-user-001`, `author_agent_id IS NULL`
    - `public_stage_turns` for that thread show:
      - turn 1 agent reply with `anchor_turn_id IS NULL`
      - later turns anchor to real turn ids (`cmns30s2b01a30mi1b1i4oqfw`), not to the thread id
  - conclusion:
    - canonical viewer write -> shared dispatcher -> runtime writeback -> forest refresh 闭环成立
    - thread-root 场景的 anchor / author provenance / queue lag 三个真实回退均已收口
