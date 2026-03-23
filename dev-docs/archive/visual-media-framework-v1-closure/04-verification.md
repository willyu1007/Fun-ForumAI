# 04 Verification — visual-media-framework-v1-closure (T-914)

- 2026-03-23
  - `pnpm typecheck`
    - Result: pass
  - `pnpm vitest run src/backend/media/__tests__/media-semantic-service.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/media/__tests__/media-generation-service.test.ts src/backend/media/__tests__/media-write-bridge.test.ts src/backend/media/__tests__/media-lifecycle-service.test.ts src/backend/media/__tests__/media-reuse-governance-service.test.ts src/backend/media/__tests__/visual-directive-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/inclination-asset-service.test.ts`
    - Result: 9 files, 61 tests passed
  - `node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs`
    - Result: pass
  - `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
    - Result: pass, `docs/context/db/schema.json` refreshed

- Coverage notes
  - Verified scratch generation contract: planner can emit `generate_from_scratch`; generation service can create scratch jobs without source projections.
  - Verified `same_thread_public`: thread-root keyed candidate retrieval works and supports cross-agent public reuse.
  - Verified root post read path now prefers attachment/projection view over legacy `post_media`.
  - Verified private-origin closure: owner-private originals are no longer treated as direct public display candidates without explicit public visibility.

- 2026-03-23
  - `pnpm vitest run src/backend/media/__tests__/media-write-bridge.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/media/__tests__/media-reuse-governance-service.test.ts src/backend/services/__tests__/inclination-asset-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts`
    - Result: 6 files, 65 tests passed
  - `pnpm typecheck`
    - Result: pass

- Additional coverage notes
  - Verified scheduler owner-pool prioritization now ignores private-only assets.
  - Verified owner `Promote -> Demote` round trip in both service unit tests and authenticated E2E route flow.
  - Verified direct-attach bridge now blocks Promote+`url_import` originals when source policy lacks `quote_original`.
  - Verified root-post parity mismatch observability no longer blocks feed reads.

- 2026-03-23
  - `pnpm vitest run src/backend/services/__tests__/inference-profile-service.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/media/__tests__/media-generation-service.test.ts`
    - Result: 3 files, 19 tests passed
  - `pnpm vitest run src/backend/services/__tests__/achievements-orchestrator.test.ts src/backend/repos/__tests__/agent-signal-log-repository.test.ts src/backend/services/__tests__/achievement-chronicle-service.test.ts`
    - Result: 3 files, 14 tests passed
  - `pnpm typecheck`
    - Result: pass
  - `pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum`
    - Result: pass, local-kind backend/postgres/redis rollout ready; local overlay confirmed `LLM_MODEL=qwen-flash-character` + `LLM_VISIBLE_MODEL_PIN=qwen-flash-character`
  - `curl -sS -X POST http://127.0.0.1:4000/v1/dev/media/e2e/generation -d '{"mode":"reference"}'`
    - Result: pass, `decision=generate_from_private_projection`, `generation_status=succeeded`, public post only挂载 generated derivative，不泄露 private original
  - `curl -sS -X POST http://127.0.0.1:4000/v1/dev/media/e2e/generation -d '{"mode":"scratch"}'`
    - Result: pass, `decision=generate_from_scratch`, `generation_status=succeeded`, public post `b7b77dce-58c5-4cb9-bc25-051f457d322d` 可读出 generated image + alt text
  - `curl -sS -X POST http://127.0.0.1:4000/v1/dev/media/t911/highlights-sample`
    - Result: pass, sample agent `4b1aa5de-6dc6-4c42-bf2a-f1e2d40da5d0` 成功生成 public sample post `371e7040-b798-4f3d-b141-ca8935a264d2`，并在 `/v1/agents/:agentId/highlights` 返回带 `visual.asset_id` 的 chronicle entry
  - Chrome DevTools MCP
    - Result: 首页 `http://localhost:3000/` 可见 `T-911 高光视觉样本帖` 与 `Media E2E Scratch Generation`；两个帖子详情页都渲染出图片与 alt text。
    - Result: `http://localhost:3000/posts/371e7040-b798-4f3d-b141-ca8935a264d2` 页面显示 T-911 public image；`http://localhost:3000/posts/b7b77dce-58c5-4cb9-bc25-051f457d322d` 页面显示 scratch generated image。
    - Result: `http://localhost:3000/agents/4b1aa5de-6dc6-4c42-bf2a-f1e2d40da5d0/chat` 私聊页成功上传 `/tmp/media-e2e-private-chat.png`、发送消息并收到 Agent 回复。
  - Browser network evidence
    - Result: `POST /attachments` => `201`, `POST /messages` => `200`；响应中 `attachment_asset_id=cmn2u02bx01fm0mltamwytiu7`，Agent 回复明确识别“纯红色图片”。
  - Backend privacy/runtime evidence
    - Result: `GET /v1/agents/4b1aa5de-6dc6-4c42-bf2a-f1e2d40da5d0/chat/sessions/cmn2ty87w010m0mltevqrwijm/messages?limit=20` 返回 human message + image attachment + delivered agent reply。
    - Result: `GET /v1/private/agents/4b1aa5de-6dc6-4c42-bf2a-f1e2d40da5d0/life-overview` 返回 `owner_projection.latest_session.session_id=cmn2ty87w010m0mltevqrwijm`，且 `carryover_topics` 持续包含图像相关主题，证明 private image 已进入 runtime/memory 路径。
  - Backend log sanity
    - Result: deploy/backend 日志可见 visible routes 使用 `qwen-flash-character` 且带 `preferred_model_hint`；最终复验阶段 `rg 'ERR_MODULE_NOT_FOUND|Unique constraint failed'` 无命中。

- Real E2E coverage notes
  - Verified final local-kind visible text routes now bias to `qwen-flash-character` instead of defaulting to `qwen-plus-character`.
  - Verified production image now contains the director-history maintenance runtime dependencies; no startup-time `ERR_MODULE_NOT_FOUND` remains.
  - Verified PG dedup repositories no longer emit Prisma unique constraint noise during recurring batch execution.

- 2026-03-23
  - `node --check scripts/cleanup-media-dev-e2e-artifacts.mjs`
    - Result: pass
  - `APP_ENV=dev DATABASE_URL=postgresql://postgres@127.0.0.1:55432/llm_forum node scripts/cleanup-media-dev-e2e-artifacts.mjs --force`
    - Result: dry-run 命中 9 个样例 agent、30 个样例 post、5 个 private session、8 个 generation job、15 个 media asset、135 个 binding。
  - `APP_ENV=dev DATABASE_URL=postgresql://postgres@127.0.0.1:55432/llm_forum node scripts/cleanup-media-dev-e2e-artifacts.mjs --apply --force`
    - Result: pass，媒体 E2E 样例数据已从 kind 本地库清除。
  - `APP_ENV=dev DATABASE_URL=postgresql://postgres@127.0.0.1:55432/llm_forum node scripts/cleanup-media-dev-e2e-artifacts.mjs --force`
    - Result: dry-run 回读为 0，确认样例 agent/post/private session/image plan/generation job/media asset/binding 已归零。
  - `pnpm typecheck`
    - Result: pass
  - `pnpm vitest run src/backend/media/__tests__/image-planner-service.test.ts src/backend/media/__tests__/media-generation-service.test.ts src/backend/media/__tests__/media-write-bridge.test.ts src/backend/media/__tests__/media-reuse-governance-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/inclination-asset-service.test.ts src/backend/services/__tests__/inference-profile-service.test.ts src/backend/routes/__tests__/e2e-multimodal.test.ts`
    - Result: 8 files, 76 tests passed
  - `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
    - Result: pass，`T-914` 已切到 `dev-docs/archive/visual-media-framework-v1-closure`
  - `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
    - Result: pass
