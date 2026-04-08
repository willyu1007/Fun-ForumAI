# 04 Verification

## Package Exit Review

### Must Be Green

- forest page component tests
- post detail deep-link / mobile / desktop smoke
- `pnpm exec tsc --noEmit`
- targeted eslint for changed forum detail files

### Must Be Reviewed Before Entering `T-944` Main Cutover

- 帖子详情是否真正形成 `guide -> forest -> timeline` 的消费顺序
- 首屏 read path 是否已从全量 detail 退出
- explainability cue 是否仅停留在公共层
- audience rail / aftershow rail / aside seats 是否仍然可共存
- guide/focus/fallback telemetry 是否已经就位

### Required Evidence

- 桌面与移动端截图或手测记录
- 旧 `threadId` / `turnId` 深链兼容记录
- forest node focus 与 timeline fallback 对照验证
- telemetry 事件或埋点清单

## 2026-04-07 T-942 Final-Shape Verification

- `pnpm test -- src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - 结果：通过（19 tests）。
  - 覆盖：
    - 首屏保持 forest 主视图，timeline summaries 默认关闭。
    - `threadId` / `turnId` 深链优先映射到 forest focus，不自动回退到 timeline 主视图。
    - participation contract 关闭节点内回复时，composer 退化为“仅发起新公开分支”文案。
    - `guide_render` / `timeline_open` telemetry 与 lazy timeline enabling 已接入页面行为。
- `pnpm test -- src/frontend/features/forum/components/__tests__/ThreadList.test.tsx`
  - 结果：通过（7 tests）。
  - 覆盖：
    - timeline 以 summary-first 渲染，展开后才读取 detail。
    - deep link 通过 `around_turn_id` / `turn_limit` 命中单线程 detail。
    - timeline inline reply 继续走 viewer write contract，并保留 `idempotency_key` + `source_context`。
- `pnpm test -- src/backend/services/__tests__/forum-read-service.test.ts`
  - 结果：通过（30 tests）。
  - 覆盖：
    - `getThreadSummaries` summary contract。
    - `getThread` 的 `turn_cursor` / `around_turn_id` / `include_projection` / `include_capsule` 分支。
    - hidden/private anchor 内容不泄漏到 public preview。
- `pnpm test -- src/backend/services/__tests__/semantic-projection-service.test.ts`
  - 结果：通过（2 tests）。
  - 覆盖：
    - public-safe persona / growth cues 不消费 private-only 内容。
    - reading guide title / summary_line 不再输出 `JOINED_LATE` / `MENTIONED` / `RETURNED_TO_BRANCH` 或对应中文导演语义。
- `pnpm test -- src/backend/routes/__tests__/e2e-read-api.test.ts`
  - 结果：通过（45 tests）。
  - 覆盖：
    - `GET /v1/posts/:postId/threads-summary`
    - `GET /v1/threads/:threadId` 的 summary/detail query params
    - `POST /v1/posts/:postId/watch-telemetry` 的 `202 accepted` 与 invalid payload `400`
    - discussion-forest / reading-guide 既有 frozen contract 回归
- `node .ai/scripts/ctl-openapi-quality.mjs verify --source docs/context/api/openapi.yaml --strict`
  - 结果：通过。
- `node .ai/scripts/ctl-api-index.mjs generate --touch`
  - 结果：通过，刷新 `docs/context/api/api-index.json` 与 `docs/context/api/API-INDEX.md`。
- `pnpm typecheck`
  - 结果：通过。
- `pnpm k8s:staging:local -- --k8s-context kind-funforum --postgres-local-port 55433`
  - 结果：通过。
  - 覆盖：
    - 使用真实 local kind / `funforum` namespace 起一套 staging backend，并注入实际可用的文本模型与文生图 provider 凭据做 smoke。
    - backend rollout 成功，runtime fingerprint / canonical seed profile 可读，说明 T-942 的 read path 能在真实依赖下启动。
- `pnpm k8s:staging:local -- --k8s-context kind-funforum --skip-seed`
  - 结果：通过。
  - 覆盖：
    - 验证 `scripts/k8s-local-staging.mjs` 新增的 Postgres 本地端口 fallback：默认 `55432` 被占用时，脚本会自动切到下一可用端口而不是中断整轮回归。
- Chrome DevTools MCP 手测 `http://127.0.0.1:4101/posts/253a9dbf-a0a2-47bc-b9cc-e5cf84a17cb3`
  - 结果：通过。
  - 覆盖：
    - 首屏只发 `discussion-forest` 与 `watch-telemetry(guide_render)`，未提前拉 `threads-summary`。
    - `threadId` / `turnId` deep link 仍优先落到 forest focus，不会把主视图切回旧 timeline-first 布局。
    - timeline tab 打开后才依次请求 `threads-summary -> GET /threads/:threadId?...around_turn_id=...`，确认 lazy detail 路径成立。
    - 修复后 viewer copy 显示为 `公共观看摘要`，pivot summary 不再出现“旧分支 / 回摆 / 重新点燃”等导演口径。
    - 对 `stage_open_reply.turn_reply_enabled=false` 的真实帖子样本，forest node 只保留 `聚焦` / `定位`，不再露出误导性的 `回应这里` CTA。
- API smoke
  - 结果：通过。
  - 覆盖：
    - `GET /v1/posts/:postId/threads-summary?limit=2` 返回 timeline 摘要字段，不再夹带全量 turn detail。
    - `GET /v1/threads/:threadId?turn_limit=3&around_turn_id=...` 返回 `returned_mode=around` 与锚点周边 turn slice。
    - `POST /v1/posts/:postId/watch-telemetry` 对有效事件返回 `202 accepted`，对非法 `event_type` 返回 `400`。
- 测试执行注意事项
  - 首次并发触发两个 `pnpm test -- ...` 命令时，双方都会进入 `pretest -> pnpm ui:build`，导致 `packages/ui-web` 产物竞争并出现瞬时失败；改为顺序执行后均稳定通过。该现象是测试执行方式的并发噪声，不是 T-942 功能回归。
