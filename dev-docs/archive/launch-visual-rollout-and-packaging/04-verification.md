# 04 Verification — launch-visual-rollout-and-packaging (T-140)

## Planned Coverage

- surface 检查：5 个关键 surface 都有 target ratio 与 card mode。
- control 检查：`surface_rollout / budget_guardrail / hero_rules / thumbnail_policy` 都具备明确字段。
- ownership 检查：社区级 policy 与平台级 surface rollout 不重叠。
- rollback 检查：预算耗尽和视觉失败时均有可执行降级路径。

## 2026-03-31

- `git diff --check`
  - 结果：通过，无空白或 patch 格式问题。
- `rg -n "surface_kind|card_mode|thumbnail_policy|hero_eligible" src/backend src/frontend | head -n 200`
  - 结果：确认字段已接到 launch runtime、ForumReadService、GlobalHighlightsService、read-api 与前端 API types。
- `node -v`
  - 结果：失败，`zsh:1: command not found: node`
- `pnpm -v`
  - 结果：失败，`zsh:1: command not found: pnpm`
- `bun -v`
  - 结果：`PATH` 中失败；后续确认 `/Users/phoenix/.bun/bin/bun` 可用，版本 `1.3.6`
- `/Users/phoenix/.bun/bin/bun x tsc -b --pretty false`
  - 结果：通过。
- `/Users/phoenix/.bun/bin/bun x eslint src/backend/launch/visual-rollout.ts src/backend/services/forum-read-service.ts src/backend/services/global-highlights-service.ts src/backend/routes/read-api.ts src/frontend/api/types.ts src/backend/launch/__tests__/visual-rollout.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/services/__tests__/global-highlights-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - 结果：通过。
- ad-hoc `bun` + `supertest` runtime smoke
  - 结果：通过。真实 API smoke 命中：
    - `GET /v1/feed` 返回 `home_root_card/single_cover/required_if_available/hero_eligible=true`
    - `GET /v1/posts/:postId` 返回同样的 root post packaging metadata
    - `GET /v1/highlights` 在带 attachment 的帖子上返回 `highlight_card/single_cover/required/hero_eligible=true`
    - `GET /v1/posts/:postId/aftershow` 返回 `aftershow_card/recap_card/optional/hero_eligible=false`
    - `t4_root_card` 在无 thumbnail 时保持空包装，符合 contract
- `/Users/phoenix/.bun/bin/bun x vitest run src/backend/launch/__tests__/visual-rollout.test.ts`
  - 结果：失败，测试运行时在 Bun + Vitest 组合下导入 `zod` 时炸在 unrelated 模块初始化，不是 T-140 业务断言失败。
- Chrome DevTools MCP / k8s:
  - 结果：当前桌面会话没有 Chrome DevTools MCP 工具，且本机无 `kubectl / kind / docker`，无法执行浏览器点击证据或 local-kind k8s 验证。
- `/Users/phoenix/.bun/bin/bun .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - 结果：通过。`registry/dashboard/feature-map/task-index` 已同步为 `archived`，`dev_docs_path` 已切到 `dev-docs/archive/launch-visual-rollout-and-packaging`。
- `/Users/phoenix/.bun/bin/bun .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - 结果：通过。
- `find .ai/.tmp -maxdepth 3 -type f | sort`
  - 结果：空结果，T-140 临时 smoke/test 产物已清理。
- 影响：
  - 当前 shell 仍无法执行原生 `pnpm test`
