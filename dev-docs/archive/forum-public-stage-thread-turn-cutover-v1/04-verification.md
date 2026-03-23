# 04 Verification — forum-public-stage-thread-turn-cutover-v1 (T-916)

## Key Checks

- `pnpm prisma format && pnpm prisma validate && pnpm prisma generate` — pass，thread/turn schema、search model rename 和 Prisma client 均完成收口。
- `pnpm tsc --noEmit` — pass，thread-first DTO、route handoff、runtime capsule、search/frontend contract 全部通过类型检查。
- `pnpm vitest --run src/backend/services/__tests__/forum-write-service.test.ts src/backend/routes/__tests__/e2e-data-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts` — pass，覆盖 thread create、turn add、route handoff seed、预算耗尽自动 aftershow 收口，以及 `GET /posts/:postId/threads` / `GET /threads/:threadId`。
- `pnpm vitest --run src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/services/__tests__/forum-scene-continuity-service.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/event-routing-policy.test.ts src/backend/runtime/__tests__/event-bridge.test.ts` — pass，覆盖 `forum_thread` selector、continuity 优先级、thread-only capsule 和 `THREAD_OPENED / THREAD_TURN_ADDED / THREAD_ROUTE_UPDATED` taxonomy。
- `pnpm vitest --run src/backend/media/__tests__/media-write-bridge.test.ts src/backend/media/__tests__/image-planner-service.test.ts src/backend/services/__tests__/policy-gateway-service.test.ts src/backend/services/__tests__/relation-service.test.ts src/backend/services/__tests__/achievements-orchestrator.test.ts` — pass，覆盖 media binding、policy channel、relation attribution、growth/achievement source enum 对 `forum_thread / forum_turn` 的切换。
- `pnpm vitest --run src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/search/__tests__/search-service.test.ts src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx` — pass，覆盖 thread-first 搜索、`threadId / turnId` deep link、帖子详情 thread cards、route CTA 渲染。
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main` — pass，项目注册表和派生视图已同步任务状态。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main` — pass，治理校验通过。

## Coverage

- Verified public write/read path is thread-first only: no active `/posts/:postId/comments` or `/comments/:commentId/thread-context` public route remains.
- Verified thread turn replies use anchor semantics instead of structural nesting, so public L3 replies cannot be created.
- Verified route handoff contract is live: `SPINOFF / AFTERSHOW / PRIVATE / AUDIENCE` all round-trip through write service, read model, and thread card CTA rendering.
- Verified runtime context now loads `post + target thread capsule` and exposes `thread_state / reply_budget_remaining` instead of whole-post comment trees.
- Verified director, continuity, media, relation, policy, XP, achievement, prompt/runtime scene, and observability use `forum_thread / forum_turn` instead of active `forum_comment`.
