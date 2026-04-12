# 04 Verification — live-e2e-regression-and-service-split-temp

## 2026-04-11

- `pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum`
  - 结果：通过；local-kind rollout、runtime fingerprint、seed profile、generic runtime smoke 全部通过
  - 备注：generic smoke 现在会自动扩到双副本后再恢复

- Chrome DevTools MCP on `http://localhost:3000/rooms`
  - 结果：真实浏览器路径复现了 watchability 文案污染；修复后复验通过
  - 关键确认：
    - 页面可正常加载房间广场
    - `document.body.innerText.includes('正在追问：') === false`

- `curl -sS http://127.0.0.1:4000/v1/rooms | jq '.data[] | select(.id=="seed-room-code-tasting") | {live_hook, continuity_summary, canonization_note}'`
  - 结果：通过；目标房间的 `live_hook / continuity_summary / canonization_note` 不再包含 `洛芙蕾丝 正在追问：`

- `pnpm test -- --run src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts`
  - 结果：通过，`30` tests

- `pnpm test -- --run src/backend/services/__tests__/home-programming-service.test.ts`
  - 结果：通过，`6` tests

- `pnpm test -- --run src/backend/services/__tests__/forum-read-service.test.ts`
  - 结果：通过，`32` tests

- `pnpm test -- --run src/backend/runtime/__tests__/chat-output-sanitizer.test.ts src/backend/services/__tests__/chat-service.watchability.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/forum-read-service.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/routes/__tests__/e2e-governance-control-plane.test.ts src/backend/routes/__tests__/admin-media-api.test.ts src/backend/routes/__tests__/admin-hot-topic-api.test.ts src/backend/routes/__tests__/feedback-api.test.ts src/backend/routes/__tests__/admin-moderation-api.test.ts src/backend/routes/__tests__/admin-user-access-api.test.ts src/backend/routes/__tests__/admin-invite-codes-api.test.ts src/backend/routes/__tests__/chat-watchability-api.test.ts`
  - 结果：通过，`13` files / `140` tests

- `pnpm typecheck`
  - 结果：通过

## 2026-04-12

- `node scripts/k8s-backend-tunnel.mjs --k8s-context kind-funforum`
  - 结果：通过；本地 `http://127.0.0.1:4000` tunnel 可建立

- `curl -fsS http://127.0.0.1:4000/health`
  - 结果：通过；backend health 正常

- `DASHSCOPE_API_KEY=*** MEDIA_GENERATION_API_KEY=*** pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum`
  - 结果：通过；rollout 期间 tunnel 断开后自动重连，generic smoke 通过

- Chrome DevTools MCP on `http://localhost:3000/rooms`
  - 结果：通过；rollout 后页面继续可用
  - 关键确认：
    - `document.body.innerText.includes('房间广场') === true`
    - `document.body.innerText.includes('正在追问：') === false`
    - 页面未出现 `500` / `Internal Server Error`

- `pnpm test -- --run src/backend/llm/__tests__/registry-contract.test.ts src/backend/routes/__tests__/dev-prompts-render.test.ts src/backend/routes/__tests__/e2e-achievement.test.ts`
  - 结果：通过，`33` tests

- `pnpm test`
  - 结果：通过
  - 覆盖方式：
    - runner 第一阶段并发执行非持久化 route/E2E 测试
    - runner 第二阶段串行执行 `18` 个持久化 route/E2E 测试文件

- `pnpm typecheck`
  - 结果：通过

- `pnpm test:e2e:playwright`
  - 结果：失败，`88` passed / `14` failed
  - 失败聚类：
    - `agent-modal.visual.spec.ts` -> `manage modal keeps owner surfaces covered across active tabs`（6 项：desktop/tablet/mobile x light/dark）
    - `forum-p0.visual.spec.ts` -> `community feed happy path`（6 项：desktop/tablet/mobile x light/dark）
    - `forum-p0.visual.spec.ts` -> `highlights dashboard`（2 项：desktop light/dark）

- `pnpm test:e2e:playwright:update -- tests/web/playwright/forum-p0.visual.spec.ts --grep "community feed happy path|highlights dashboard"`
  - 结果：通过，`24` tests
  - 说明：社区 feed / highlights 的当前截图重新设为新基线

- `pnpm test:e2e:playwright:update -- tests/web/playwright/agent-modal.visual.spec.ts --grep "manage modal keeps owner surfaces covered across active tabs"`
  - 结果：通过，`30` tests
  - 说明：owner manage modal 的 owner-intro / moments 当前截图重新设为新基线

- `pnpm typecheck`
  - 结果：通过

- `pnpm test`
  - 结果：通过，`313` files / `1576` tests + 第二阶段 `18` files / `135` tests

- `pnpm test:e2e:playwright`
  - 结果：通过，`102` passed
