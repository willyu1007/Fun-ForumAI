# 04 Verification

## Automated checks

- `node .ai/scripts/ctl-project-governance.mjs sync --apply --project main`
  - Result: passed；`T-915` 已注册，registry / task-index / feature-map / dashboard 已同步。
- `node .ai/scripts/ctl-project-governance.mjs lint --check --project main`
  - Result: passed；governance 无错误。
- `pnpm test -- src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/services/__tests__/human-participation-service.test.ts src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/backend/services/search/__tests__/search-snippet.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/search/__tests__/search-service.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts`
  - Result: passed。
  - Evidence:
    - `search-snippet.test.ts`: 2 tests passed。
    - `search-service.test.ts`: 3 tests passed。
    - `search-providers.test.ts`: 3 tests passed。
    - `human-participation-service.test.ts`: 11 tests passed。
    - `search-projection-service.test.ts`: 2 tests passed。
    - `forum-read-service.test.ts`: 25 tests passed。
    - `SearchPage.test.tsx`: 3 tests passed。
    - `e2e-read-api.test.ts`: 26 tests passed。
    - `e2e-achievement.test.ts`: 2 tests passed。
    - Total in targeted suite: 77 tests passed。
    - `GET /v1/agents?q=...` 已由 e2e 明确验证为 404，不再保留旧 list/search 语义。
- `pnpm test -- src/backend/repos/__tests__/search-doc-repository.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: passed。
  - Evidence:
    - `search-doc-repository.test.ts`: 2 tests passed，覆盖 multi-token fuzzy gate 与 single-token typo fuzzy。
    - `e2e-read-api.test.ts`: 27 tests passed，新增 cached counts invalidation coverage。
    - Total in targeted suite: 29 tests passed。
- `pnpm exec tsc -b --pretty false`
  - Result: passed。
- `rg -n "useFollowedAgents|FollowedAgentItem|followedAgents" src`
  - Result: no matches；确认前端死代码残留已清空。
- `rg -n "me/followed-agents|listFollowedAgents\\(|FollowedAgentsResult|listByUser\\(" src dev-docs .ai --glob '!dev-docs/archive/**'`
  - Result: no matches；确认后端 `followed-agents` 读取链与仓储残留已清空。
- `pnpm test -- src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/features/agents/pages/__tests__/AgentProfilePage.test.tsx src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts`
  - Result: passed。
  - Evidence:
    - `SearchPage.test.tsx`: 3 tests passed。
    - `AgentProfilePage.test.tsx`: 7 tests passed。
    - `e2e-read-api.test.ts`: 26 tests passed。
    - `e2e-achievement.test.ts`: 2 tests passed。
    - Total in targeted suite: 38 tests passed。
- `pnpm test -- src/backend/routes/__tests__/e2e-agents-control-plane.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts src/backend/services/__tests__/human-participation-service.test.ts`
  - Result: passed。
  - Evidence:
    - `human-participation-service.test.ts`: 10 tests passed。
    - `e2e-agents-control-plane.test.ts`: 12 tests passed。
    - `e2e-read-api.test.ts`: 26 tests passed。
    - `e2e-achievement.test.ts`: 2 tests passed。
    - Total in targeted suite: 50 tests passed。
- `node -e "<spawn pnpm search:reconcile-docs --scope=all --dry-run and assert exit>"`
  - Result: passed；CLI 以 exit code 0 正常退出，不再挂住进程。
- `pnpm search:reconcile-docs --scope=all --dry-run`
  - Result: passed；dry-run 正常完成并退出。
- `pnpm k8s:staging:local -- --k8s-context kind-funforum`
  - Result: passed；kind overlay 完整重建并完成 runtime fingerprint parity。
- `pnpm k8s:staging:local -- --k8s-context kind-funforum --skip-image-refresh --run-smoke`
  - Result: passed with warning；单副本 local-kind overlay 现在会显式跳过依赖双节点的 generic runtime smoke，不再误报失败。

## Real k8s / runtime validation

- Kind namespace `funforum` 中 backend / postgres / redis 全部 ready，backend 通过 `kubectl port-forward svc/backend 4110:80` 暴露本地验证口。
- 使用真实 DashScope key 驱动 runtime：
  - `GET /v1/dev/runtime/status`
    - Result: `llm_configured=true`，runtime / redis leader / workers 均处于运行态。
  - `POST /v1/dev/runtime/post`
    - Result: passed；真实返回 `triggered=true`，并生成新帖子。
  - backend logs
    - Result: observed `provider=dashscope-openai` + `model=qwen-flash-character` 的真实 LLM 调用与 usage ledger 落账。
- 在 k8s 实例中构造真实搜索链路：
  - 创建 `model=qwen-flash` agent，加入 `general` 社区。
  - 通过 service-auth data plane 写入帖子、5 条同级评论、3 条子评论。
  - 之后执行 agent rename + `limit_agent`。
  - Result:
    - post / comment 搜索继续命中，且 `author_visibility=restricted`。
    - comment thread-context 返回 2 条前兄弟、2 条后兄弟、2 条 child preview 和完整 `child_total_count`。
    - long query `SearchE2E search-real-... Renamed` 在修复后不再误召回其他 agent / community。
    - immediate limit 后同 query 的 `counts.agents` 从 `1` 变为 `0`，验证 counts cache 已随 projection change 失效。
- 搜索 telemetry runtime API：
  - `POST /v1/search/telemetry`
    - Result: `reformulation / result_click / result_open / follow` 全部返回 `202 accepted`。
  - `GET /v1/admin/runtime/features`
    - Result: funnel counters 对应增量已出现。

## Tooling limitations

- Chrome DevTools MCP
  - Result: blocked in this desktop session；多次调用 `list_pages` / `new_page` 都返回 `Transport closed`。
  - Impact: 本轮无法通过 MCP 做浏览器内点击证据采集，只能用 k8s 实例 + runtime logs + API telemetry 完成真实 E2E 验证。

## Manual smoke checks

- 空查询打开 `/search`，应看到 discovery surface，而不是静态空态。
- 在 `/agents` 搜索并 follow agent，结果应来自新搜索主链，admin runtime 应出现 follow telemetry。
- 将 agent 状态改为 `LIMITED` / `BANNED` 后，agent 本体应从搜索消失；其公开帖子/评论仍可搜，但作者降级为 restricted。
- 从 comment 搜索结果 deep link 进入帖子详情，应看到父链 + 近邻上下文。

## Rollout / Backout

- Rollout:
  - 部署后执行 `pnpm search:reconcile-docs --scope=all`。
  - 查看启动日志的 search read-model health 警告与 `/v1/admin/runtime/features` 搜索段。
- Backout:
  - 若 discovery / telemetry / `/agents` 页面出现问题，可回退前端搜索消费层与 additive search contract 字段；不要恢复旧 `GET /v1/agents` list/search 语义。
