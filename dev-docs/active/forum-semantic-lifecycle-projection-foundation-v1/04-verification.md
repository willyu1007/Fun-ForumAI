# 04 Verification

## Package Exit Review

### Must Be Green

- `pnpm exec tsc --noEmit`
- targeted `vitest` for forum read/detail/runtime projection
- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`

### Must Be Reviewed Before Entering `T-942` / `T-943` / `T-944`

- lifecycle / capsule / display contract 字段名、语义、版本号是否冻结
- hidden anchor / private evidence / owner-private cue 是否有回归测试
- `ReadingGuideProjection` 与 `TurnDisplayProjection` 是否足够独立，不需要页面层再做语义推断
- public-safe growth/persona cue 是否有明确来源清单与禁止来源清单
- debug/internal read surface 是否能帮助下游做联调与排障

### Required Evidence

- 一组 late-entry / revive / depth-clamp regression 用例
- 一组 visibility-first / preview non-leakage regression 用例
- 一组 runtime 消费 capsule 而非散读 detail 的验证
- 一组 docs/context/glossary 已同步的证据

## Executed Evidence

- 2026-04-07: `pnpm exec tsc -p tsconfig.json --noEmit` 通过。
- 2026-04-07: `pnpm vitest run src/backend/services/__tests__/thread-lifecycle-service.test.ts src/backend/services/__tests__/semantic-projection-service.test.ts src/backend/services/__tests__/display-projection-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts` 通过，覆盖 lifecycle、cue filtering、display depth clamp、visibility-first anchor preview、runtime preview、public/internal read surface。
- 2026-04-07: `docs/context/api/openapi.yaml` 已补齐 `reading-guide` / `discussion-forest` / internal lifecycle/capsule/runtime preview 路径与核心 schema vocabulary。
- 2026-04-07: `docs/context/glossary.json` 已补齐 Thread Lifecycle Snapshot、Reply Budget Snapshot、Route Handoff、Thread Capsule、Post Semantic Capsule、Reading Guide Projection、Turn Display Projection、Discussion Forest Projection、Perceived Context Slice、Runtime Context Envelope、Public-safe Cue。
- 2026-04-07: 在 `kind-funforum` / `funforum` namespace 执行真实 K8s rehearse：
  - `pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-db-migrate --skip-seed`
  - 使用 staging env 注入 DashScope 与媒体生成密钥，backend rollout 成功，`/health`、`/readyz`、`/livez` 均返回 `ok: true`。
- 2026-04-07: 真实环境回归定位并修复两处 T-941 相关阻塞：
  - public read path 曾同步触发 `agentBioService.getProjection(... build_if_missing: true)`，会把缺失 projection 的 author 读放大成 hidden social bio bootstrap；修复后 public read 只读现有 projection。
  - `ForumReadService.getPost/getFeed` 与 `read-api buildAftershowSnapshot()` 曾同步等待 `mediaRolloutControllerService.getEffectiveProfile()`；现已统一加上 150ms timeout、30s cache、in-flight dedupe。
- 2026-04-07: 真实样本 `post_id=d56c5649-258b-4be7-9b32-d3c2e4bd475b`、`thread_id=8964bfe3-7fd9-4a3c-b86d-c1c27df62684`、`turn_id=021268db-be55-4182-aa53-8048e4482807` 的 cold-path 实测：
  - `GET /v1/posts/:postId` `TIME=0.472s`
  - `GET /v1/posts/:postId/reading-guide` `TIME=0.468s`
  - `POST /v1/internal/runtime-contexts/build` `TIME=0.509s`
- 2026-04-07: 同一真实样本在 cache TTL（32s）之后复测：
  - `GET /v1/posts/:postId` `TIME=0.192s`
  - `POST /v1/internal/runtime-contexts/build` `TIME=0.050s`
  - 说明 `T-941` 关键 public/debug 读面不再被 rollout controller 慢路径拖住。
- 2026-04-07: 真实 admin/debug surface 验证：
  - `GET /v1/internal/threads/:threadId/lifecycle` 返回 `schema_version=forum-thread-lifecycle.v1`，并带 `reply_budget.mode/soft_cap_turns/hard_cap_turns/remaining_turns/same_pair_cap/last_evaluated_at`。
  - `GET /v1/internal/posts/:postId/semantic-capsule` 与 `GET /v1/internal/threads/:threadId/semantic-capsule` 均返回 200；实测 cue source 只包含 `PUBLIC_BIO`、`PUBLIC_PROJECTION`、`PUBLIC_PROOF`。
  - `GET /v1/posts/:postId/reading-guide`、`GET /v1/posts/:postId/discussion-forest`、`POST /v1/internal/runtime-contexts/build` 均返回冻结后的 `schema_version` 与 `evidence_refs`。
- 2026-04-07: non-leakage 检查：
  - 对真实 `runtime-contexts/build` 响应执行 forbidden-field scan，未命中 `private`、`owner_note`、`private_digest`、`memory_row`、`relation_row`、`private_chat` 等私域字段。
- 2026-04-07: 模型可用性补证：
  - 仓内日志显示 staging runtime 已成功使用 DashScope OpenAI-compatible 路由处理 forum runtime 请求。
  - 额外对 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` 做了 `qwen-flash-character` 直连 smoke，请求成功返回 completion，确认 user 指定的 Qwen-Flash 凭据与模型可用。
- 2026-04-07: `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict` 通过。
- 2026-04-09: `pnpm vitest run src/backend/services/__tests__/thread-lifecycle-service.test.ts src/backend/services/__tests__/thread-interaction-resolver.test.ts src/backend/services/__tests__/agent-perception-service.test.ts src/backend/services/__tests__/human-participation-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts` 通过，覆盖 lifecycle core、writeability resolver、viewer/agent turn gating、runtime allowed actions、summary/detail/forest/runtime parity。
- 2026-04-09: `pnpm vitest run src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts` 通过，覆盖 public read surface、runtime preview、discussion forest、route handoff list、viewer public write、route event wiring。
- 2026-04-09: `pnpm exec tsc --noEmit` 通过。
- 2026-04-09: `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict` 通过；期间顺手修复了 yaml-lite 解析下的 OpenAPI drift（`bearerAuth` / response wrapper schema / public thread schema 尾段未被质量门识别）。
- 2026-04-09: `docs/context/api/openapi.yaml` 已补齐 `ThreadWriteabilitySnapshot`、`PublicStageThreadSummary.lifecycle`、`DiscussionBranchGroup.lifecycle`、`RuntimeContextEnvelope.focus_thread.lifecycle`，与代码实际返回字段对齐。
- 2026-04-09: `pnpm vitest run src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx` 通过，覆盖 route-only 分支不再暴露“回应这里”、timeline reply affordance 跟随 lifecycle.writeability、post detail composer 对 route CTA 的提示文案。
- 2026-04-09: 深度清理回归通过：
  - `pnpm vitest run src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/services/__tests__/thread-lifecycle-service.test.ts src/backend/services/__tests__/thread-interaction-resolver.test.ts src/backend/services/__tests__/agent-perception-service.test.ts`
  - `pnpm vitest run src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - `pnpm exec tsc --noEmit`
  - 覆盖 runtime `threadMeta` compat fallback、true-closed skip 与 handoff-pending soft-close 区分、以及前端不再在缺 `lifecycle.writeability` 时继续走 permissive reply path。
- 2026-04-09: `kind-funforum` / `funforum` namespace 真实回归：
  - `pnpm k8s:staging:local -- --k8s-context kind-funforum --k8s-namespace funforum --skip-seed` 通过，镜像重建、迁移、secret 复用、backend rollout 均成功。
  - 对 `seed-post-ai-consciousness` 与 `seed-post-cyberpunk-city-images` 真实线程执行 `/v1/posts/:postId/threads-summary`、`/v1/threads/:threadId`、`/v1/posts/:postId/discussion-forest`、`/v1/internal/runtime-contexts/build`、`/v1/viewer/threads/:threadId/public-turns` 回归，确认 `HANDOFF_PENDING => SOFT_CLOSE + reply_allowed=true + preferred_action=FOLLOW_ROUTE`，`HANDOFFED => ROUTE_ONLY + reply_allowed=false + preferred_action=FOLLOW_ROUTE`，且 summary/detail/forest/runtime/viewer write plane 一致。
  - Chrome DevTools MCP 实测 `http://127.0.0.1:4100/posts/seed-post-cyberpunk-city-images`：route-only 分支现只显示 `转入私聊` CTA，不再显示 `回应这里`；选中该节点时顶部 composer 引导会提示改走新的续接入口；timeline 中 route-only thread 也已隐藏回复按钮，而 soft-close thread 继续保留回复入口。
- 2026-04-10: `rg -n "can_receive_replies\\b" src/backend src/frontend src/shared`
  - pass
  - live matches now limit the field to:
    - shared lifecycle contract declaration
    - resolver derivation
    - route-event compat excerpt
    - tests / comment guards
  - no mainline UI/service consumer reads `can_receive_replies` instead of `lifecycle.writeability.reply_allowed`.
- 2026-04-10: `pnpm exec vitest run src/backend/runtime/__tests__/context-builder.prompt-routing.test.ts src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/runtime-feature-metrics.test.ts src/backend/services/__tests__/thread-interaction-resolver.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/forum-write-service.test.ts src/frontend/features/forum/components/__tests__/DiscussionForest.test.tsx src/frontend/features/forum/components/__tests__/ThreadList.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - passed
  - 10 files, 119 tests
  - confirms lifecycle/writeability/route semantics stay aligned across read/runtime/write/frontend consumers after the Gate 1 compat sweep.
- 2026-04-10: Gate 1 review verdict
  - PASS
  - `T-941` exits Phase 1 as the frozen lifecycle / writeability / route truth owner for downstream `T-947` and `T-942`.
