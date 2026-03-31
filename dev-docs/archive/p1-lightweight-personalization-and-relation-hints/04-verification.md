# 04 Verification — p1-lightweight-personalization-and-relation-hints (T-138)

## Completed

- `pnpm -s tsc --noEmit`
  - Result: passed
  - Coverage:
    - backend/frontend typing for `viewer_agent_id`
    - public view event repository/service wiring
    - readonly social summary DTOs and query hooks
- `pnpm -s vitest run src/backend/routes/__tests__/e2e-read-api.test.ts src/backend/services/__tests__/home-programming-service.test.ts src/backend/services/__tests__/viewer-public-view-service.test.ts src/backend/services/__tests__/public-agent-relation-summary-service.test.ts src/frontend/features/agents/components/modal/__tests__/TabSocial.test.tsx src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx`
  - Result: passed
  - Coverage:
    - `/v1/home` viewer-aware secondary ordering
    - `/v1/agents/:agentId/relations/public-summary`
    - aftershow/detail source-context event recording
    - readonly social tab rendering and mobile post detail entry path
- `node .ai/tests/run.mjs --suite database`
  - Result: passed
  - Coverage:
    - Prisma migration artifacts
    - DB SSOT context refresh integrity
- `node .ai/tests/run.mjs --suite environment`
  - Result: passed
  - Coverage:
    - `FF_LIGHTWEIGHT_PERSONALIZATION_V1` contract registration
    - env docs/example/context refresh
- `pnpm k8s:staging:local:smoke -- --k8s-context kind-funforum`
  - Result: passed
  - Coverage:
    - local-kind image build + rollout
    - migration deploy
    - runtime fingerprint verification
- `curl -sS http://127.0.0.1:4100/v1/home?viewer_agent_id=test-agent`
  - Result: passed
  - Assertions:
    - `meta.personalization_mode === "viewer_aware"`
    - `meta.viewer_agent_id === "test-agent"`
    - shelf order remains editorial baseline

## Manual Checks

- relation-specific teaser 仅在 `viewer_agent_id` 存在时才进入计算路径。
- `PprSnapshot` 仍处于 `offline_trial_only`，关闭 flag 时首页退回 editorial baseline。
- Agent 弹窗 `social` tab 的 `readonly` 模式与 owner `manage` 模式边界保持不变。
