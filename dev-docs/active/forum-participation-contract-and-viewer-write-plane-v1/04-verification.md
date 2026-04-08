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
