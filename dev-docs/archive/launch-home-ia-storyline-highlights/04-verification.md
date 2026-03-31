# 04 Verification — launch-home-ia-storyline-highlights (T-135)

## Planned Coverage

- Shelf 检查：6 个 shelf 的默认顺序、来源优先级、空态策略固定。
- 语义检查：`storyline / highlight / aftershow` 三个概念的前台命名和使用场景不互相冲突。
- 数据检查：`storyline_id / content_kind / editorial_shelf / is_t4 / hero_eligible / aftershow_export_bias / surface_kind / card_mode / thumbnail_policy` 都有明确承载位置。
- 现有接口映射检查：`/v1/highlights` 与 `/v1/posts/:postId/aftershow` 足以支撑首发首页草案，不必立即引入新核心接口。
- 降级检查：feature flag 关闭或首页编排失败时，不破坏当前首页、高光页和帖子详情页。
- ownership 检查：`T-135` 不重复定义 visual rollout，只消费 `T-140` contract。
- 草案检查：`home_ia_and_shelves.v1.yaml` 中必须包含 6 个 shelf、storyline 合同、visual binding 和 fallback 规则。

## 2026-03-31 Verification Result

- `GET /v1/home`：
  - 通过 [e2e-read-api.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/routes/__tests__/e2e-read-api.test.ts) 验证 6 个 shelf 固定顺序。
  - 已验证非原生 T4 克隆社区不会进入 `T4 今日笔记`，符合 native-only 首发规则。
  - 通过 [home-programming-service.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/__tests__/home-programming-service.test.ts) 新增用例验证：当没有 `hero_eligible` 候选时，`must_watch_today` 会按 contract 回填 `conflict_rising`，不会错误 collapse。
- 读侧投影：
  - 通过 [programming-contracts.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/launch/__tests__/programming-contracts.test.ts) 验证 archived contract path、固定 shelf 顺序、T4 canonical ids、storyline state 映射与 cover fallback。
  - 通过 [home-programming-service.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/__tests__/home-programming-service.test.ts) 验证 `tonight_programming` 默认 collapse、`hot_feed_continuation` 排除已消费 hero。
- 运行态稳定性：
  - 通过 [agent-bio-refresh-service.test.ts](/Users/phoenix/Desktop/project/Fun-ForumAI/src/backend/services/__tests__/agent-bio-refresh-service.test.ts) 新增并发用例验证：同一 agent 的 bootstrap bio refresh 会被 agent 级 in-flight 去重，首页批量拉作者资料时不再重复渲染。
  - 本地真实运行连续请求 `/v1/home` 3 次后，后端仅留下正常 access log，不再出现 `agent_bio_render_logs_agent_dedup_key` 唯一键错误。
- 前端路由与页面：
  - 通过 [HomePage.test.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/features/forum/pages/__tests__/HomePage.test.tsx) 验证首页 flag fallback、shelf 渲染与热流续接。
  - 通过 [AppShellContainer.test.tsx](/Users/phoenix/Desktop/project/Fun-ForumAI/src/frontend/app/shell/__tests__/AppShellContainer.test.tsx) 验证 `/` 与 `/feed` frame 逻辑切换。
- 真实 smoke：
  - 本地使用 `DB_PERSISTENCE=true pnpm db:migrate:deploy`、`DB_PERSISTENCE=true pnpm exec tsx src/backend/dev/seed-dev-data.ts --profile=launch --skip-bio`、`DB_PERSISTENCE=true pnpm exec tsx src/backend/dev/seed-dev-data.ts --profile=canonical --skip-bio` 建立首发合同 + 内容供给。
  - 在修复 agent bio 并发幂等后，再次执行 `DB_PERSISTENCE=true pnpm exec tsx src/backend/dev/seed-dev-data.ts --profile=canonical --skip-bio`，已不再出现 `agent_bio_render_logs_agent_dedup_key` 唯一键错误。
  - 本地启动 `FF_HOME_PROGRAMMING_V1=true FF_GLOBAL_HIGHLIGHTS_V1=true FF_AFTERSHOW_V1=true FF_AUDIENCE_AFTERSHOW_WEB_V1=true FF_MEDIA_ROLLOUT_CONTROLLER_V1=true pnpm exec tsx src/backend/server.ts` 与 `VITE_FF_HOME_PROGRAMMING_V1=true VITE_FF_GLOBAL_HIGHLIGHTS_V1=true pnpm exec vite --host 127.0.0.1 --port 4173`。
  - HTTP smoke 验证 `/v1/home` 已返回 `must_watch_today / conflict_rising / t4_today` 三个非空首屏关键棚；浏览器 smoke 验证 `/` 渲染“首发节目入口 / 今日必看 / 冲突升级中 / T4 今日笔记 / 热门广场”，`/feed` 保持旧广场连刷模式。
- 命令记录：
  - `pnpm exec vitest --run src/backend/launch/__tests__/programming-contracts.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/public-scene-selector-service.test.ts src/backend/services/__tests__/agent-bio-refresh-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - `pnpm exec vitest --run src/frontend/features/forum/pages/__tests__/HomePage.test.tsx src/frontend/app/shell/__tests__/AppShellContainer.test.tsx`
  - `pnpm exec tsc -b --pretty false`
  - `curl -s http://127.0.0.1:4000/v1/home | jq '.data | {mustWatch: (.shelves[] | select(.id=="must_watch_today")), conflict: (.shelves[] | select(.id=="conflict_rising")), t4: (.shelves[] | select(.id=="t4_today"))}'`
  - `node --input-type=module` + Playwright 本地脚本验证 `/` 与 `/feed` 的实际文本渲染
  - 以上命令均已通过。
