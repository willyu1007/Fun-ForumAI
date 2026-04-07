# 03 Implementation Notes

- 2026-04-07
  - 创建任务包，冻结任务边界为“共享 contract + projection service + read/runtime 对接”。
  - 决定首版避免新增持久化表，先基于现有 thread/turn/audience/aftershow 数据实时派生，降低 cutover 风险。
  - `src/shared/forum-orchestration.ts` 已扩充为冻结合同层：补齐 schema version、lifecycle/budget/handoff、evidence refs、public-safe persona/growth cues、reading guide、discussion forest、perceived slice、runtime envelope。
  - `thread-lifecycle-service` / `semantic-projection-service` / `display-projection-service` 已收口为 shared contract 的唯一 builder，明确 `actual_anchor_turn_id` 与 `display_parent_id` 分离，且 `display_depth <= 2`。
  - `forum-read-service` 已改成 visibility-first pipeline：先过滤可见 turn，再派生 preview/guide/forest/capsule/runtime preview；隐藏 anchor 仅允许 `quoted_excerpt` fallback，不再读隐藏 body。
  - `forum-read-service` 的 public read author resolution 已禁止 `agentBioService.getProjection(... build_if_missing: true)`，避免帖子详情 / reading guide / discussion forest 在缺 projection 时同步触发 social bio bootstrap。
  - `forum-read-service` 已为 read path 的 `mediaRolloutControllerService.getEffectiveProfile()` 增加 150ms timeout + 30s cache + in-flight dedupe，防止 `GET /posts/:id` / `GET /feed` 被媒体 rollout 控制面重计算阻塞。
  - `read-api` 的 `buildAftershowSnapshot()` 也已切到同样的 read-path rollout profile helper，避免 `GET /posts/:id` 兼容读面在 aftershow 组装阶段再次被慢控制面拖住。
  - `context-builder` 已改成消费 `forumReadService.buildRuntimeContextPreview()`，runtime 不再在本地重复组装 forum semantic context。
  - `read-api` 已新增 admin-only debug 路由：thread lifecycle、post/thread semantic capsule、internal reading guide / discussion forest、stateless runtime context preview build。
  - `docs/context/api/openapi.yaml` 与 `docs/context/glossary.json` 已同步 T-941 vocabulary，供 `T-942` / `T-943` / `T-944` 直接消费。
  - 已补回归测试：
    - `forum-read-service.test.ts` 覆盖 public projection 不再触发 bio bootstrap。
    - `forum-read-service.test.ts` 覆盖 slow rollout profile 不阻塞 `getFeed/getPost`，且复用 pending fetch。
    - `e2e-read-api.test.ts` 覆盖 aftershow web 打开时 `GET /v1/posts/:postId` 不被 slow rollout profile 阻塞。
