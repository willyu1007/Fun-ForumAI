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
- `pnpm test -- src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/widgets/shell/__tests__/ShellTopBarContainer.test.tsx`
  - Result: passed。
  - Evidence:
    - `SearchPage.test.tsx`: 3 tests passed。
    - `ShellTopBarContainer.test.tsx`: 10 tests passed。
    - Total in targeted suite: 13 tests passed。
- `pnpm exec playwright test tests/web/playwright/agent-modal.visual.spec.ts --project=desktop-light`
  - Result: initially failed on visual diff only；after code fix, strict-mode blocker消失，只剩 search redesign 带来的预期基线差异。
- `pnpm exec playwright test tests/web/playwright/governance-auth.visual.spec.ts --project=desktop-light`
  - Result: passed；证明 `TopBarSearch` 空查询隐式请求问题修复后，governance 页面不再出现异步未收敛的假红。
- `pnpm exec playwright test tests/web/playwright/forum-p0.visual.spec.ts --project=desktop-light`
  - Result: passed except `community feed happy path` 的预期 avatar asset diff；确认差异来自 commit 自己切换到 PNG preset。
- `pnpm exec playwright test tests/web/playwright/realtime-p0.visual.spec.ts --project=desktop-light`
  - Result: passed。
- `pnpm exec playwright test tests/web/playwright/agent-modal.visual.spec.ts -g 'search result' --update-snapshots`
  - Result: passed；已刷新 desktop / tablet / mobile, light / dark 的 readonly modal 基线。
- `pnpm exec playwright test tests/web/playwright/forum-p0.visual.spec.ts -g 'community feed happy path' --update-snapshots`
  - Result: passed；已刷新 community avatar PNG preset 对应的基线。
- `pnpm exec playwright test --update-snapshots`
  - Result: passed；剩余 mobile / tablet shell-level 基线已与新顶部搜索入口对齐，96 tests passed。
- `rg -n "comm-avatar-(01-pixel-knight|02-cyber-hacker|03-mecha-pilot|04-tabletop-wizard|05-vaporwave-statue|06-lofi-chill|07-magical-anime|08-goth-vampire|09-skater|10-hiphop-dj|11-pop-idol|12-fitness-chad|13-cafe-barista|14-nature-druid|15-bookworm|16-graffiti-artist)" -S .`
  - Result: no matches；确认删除的 16 张社区头像资源在 repo 中已无引用。
- `pnpm test -- src/frontend/features/forum/pages/__tests__/CommunityFeedPage.test.tsx src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/widgets/shell/__tests__/ShellTopBarContainer.test.tsx`
  - Result: passed。
  - Evidence:
    - `CommunityFeedPage.test.tsx`: 3 tests passed。
    - `SearchPage.test.tsx`: 3 tests passed。
    - `ShellTopBarContainer.test.tsx`: 10 tests passed。
    - Total in targeted suite: 16 tests passed。
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - Result:
    - First rerun failed only because Playwright still引用旧基线；Errors 1 / Warnings 0。
    - Final rerun passed；latest run id `20260327T002407Z-67237`，Errors 0 / Warnings 0，`eslint=PASS`，`playwright=PASS (96 tests)`。
- `pnpm exec prisma validate`
  - Result: passed；`prisma/schema.prisma` 对新增 `PostSearchDoc.agentVoteDown` 字段校验通过。
- `node .ai/scripts/ctl-db-ssot.mjs sync-to-context`
  - Result: passed；`docs/context/db/schema.json` 已刷新，DB context checksum 更新。
- `pnpm exec tsc -b --pretty false`
  - Result: passed。
  - Notes:
    - 搜索相关变更与本轮顺手清理的 `FeedPage.tsx` 未使用变量一起通过整仓 TypeScript 构建。
- `pnpm test -- src/backend/services/search/__tests__/search-snippet.test.ts src/backend/services/search/__tests__/search-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/frontend/features/search/pages/__tests__/SearchPage.test.tsx src/frontend/widgets/shell/__tests__/TopBarSearch.test.tsx`
  - Result: passed。
  - Evidence:
    - `search-snippet.test.ts`: 5 tests passed，覆盖 fenced code block 移除与 plain-text preview。
    - `search-service.test.ts`: 3 tests passed，覆盖 `SearchPostItem.agent_vote_down` contract 透传。
    - `search-providers.test.ts`: 4 tests passed，覆盖 `PostSearchProvider` 的 `agent_vote_down` 透传。
    - `search-projection-service.test.ts`: 2 tests passed，覆盖 `refreshPost()` 写入 `agent_vote_up/down`。
    - `SearchPage.test.tsx`: 8 tests passed，覆盖 hover card / 双入口 / sentiment bar / restricted author 文本降级 / 固定深色 rail / 社区头像 `object-cover`。
    - `TopBarSearch.test.tsx`: 1 test passed，覆盖顶部搜索下拉社区头像 `object-cover`。
    - Total in targeted suite: 23 tests passed。
- `python3 .ai/skills/features/ui/ui-governance-gate/scripts/ui_gate.py run --mode full`
  - Result: failed, but only on unrelated pre-existing frontend governance violations；latest run id `20260328T155535Z-94855`。
  - Remaining gate errors:
    - `src/frontend/index.css` feature-layer visual CSS (`background`, `color`)
  - `eslint` 已通过；SearchPage 与 FeedToolbar 的 className 问题不再出现在 gate 报告中。

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

## 2026-04-10 Phase F Verification

- `pnpm exec vitest run src/backend/services/search/__tests__/search-service.test.ts src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
  - Result: passed; 62 tests.
  - Evidence:
    - `search-service.test.ts`: 3 tests passed.
    - `search-providers.test.ts`: 7 tests passed, including thread-provider lean hydration evidence.
    - `search-projection-service.test.ts`: 3 tests passed, including `refreshThread()` using `getThreadSearchCardBundle()`.
    - `e2e-read-api.test.ts`: 49 tests passed; `/v1/search` public contract and `/v1/votes/human` compatibility remained green.
- `pnpm search:reconcile-docs --scope=all --dry-run`
  - Result: passed; exited with code 0.
  - Summary:
    - `scope: all`
    - `dry_run: true`
    - `refreshed: { posts: 0, threads: 0, communities: 0, agents: 0 }`
  - This confirms reconcile CLI still runs and exits after the lean refresh-path migration.
- `pnpm exec tsc --noEmit`
  - Result: passed.

### Lean-Path Grep Evidence

- `rg -n "forumReadService\\.getThread\\(|getThread\\(hit\\.doc|refreshVoteTarget\\(|searchProjectionService" src/backend/services/search src/backend/services/search-projection-service.ts src/backend/routes/read-api.ts -g '*.ts'`
  - Result:
    - no search provider call to full `forumReadService.getThread()`
    - `refreshVoteTarget()` remains inside `SearchProjectionService`, not `read-api`
    - remaining `read-api` `getThread()` calls are user-facing thread detail reads, not search hot-path hydration.

### Phase F Closeout Decision

- `T-948` handoff has been consumed.
- `/v1/search` public shape stayed compatible.
- Search provider, projection refresh, reconcile, and runtime health no longer require full-thread semantics as the default hot path.
- `T-915` is complete for the closeout program and ready for Gate 3 once `T-949` lands.

## 2026-04-10 Phase 3 Review Addendum

- Review finding:
  - `T-948` search card hydration could drop an old matched turn after merging it with the recent card window.
- Fix owner:
  - Fixed in `T-948` by preserving matched turns first and filling the remaining bounded card with recent turns.
- Search-side verification:
  - `pnpm exec vitest run src/backend/services/search/__tests__/search-providers.test.ts src/backend/services/__tests__/search-projection-service.test.ts src/backend/services/search/__tests__/search-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts`
    - Result: passed; 62 tests.
  - `pnpm search:reconcile-docs --scope=all --dry-run`
    - Result: passed; dry-run completed with `refreshed: { posts: 0, threads: 0, communities: 0, agents: 0 }`.
  - `pnpm exec tsc --noEmit`
    - Result: passed.
