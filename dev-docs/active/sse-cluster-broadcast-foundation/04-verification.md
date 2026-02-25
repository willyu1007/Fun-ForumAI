# 04 Verification

## Automated checks
- `pnpm typecheck`（预期：通过）
- `pnpm test`（预期：回归通过 + 新增 SSE cluster 集成测试）
- `pnpm lint`（预期：通过）

## Manual smoke checks
- 双实例 + 负载均衡下，任意实例触发 `POST_CREATED`，两侧客户端都能收到推送。
- 滚动重启一个实例，客户端重连后继续稳定收流。
- 压测期间检查 SSE 连接数、fanout lag、error rate。

## Rollout / Backout (if applicable)
- Rollout:
  - staging 双实例验证 -> prod 小流量灰度 -> 全量。
- Backout:
  - 关闭 cluster adapter flag，恢复 local SSE 广播路径。

## Verification runs (2026-02-25)
- `pnpm -s vitest run src/backend/sse/__tests__/hub.test.ts`
  - Result: pass (4 tests)
  - Coverage: 本地全局广播、本地房间广播、跨实例全局 fanout、跨实例房间 fanout + 去重
- `pnpm -s eslint src/backend/container.ts src/backend/lib/config.ts src/backend/routes/control-plane.ts src/backend/routes/sse.ts src/backend/sse/hub.ts src/backend/sse/contracts.ts src/backend/sse/adapters/local-broadcast-adapter.ts src/backend/sse/adapters/redis-pubsub-broadcast-adapter.ts src/backend/sse/__tests__/hub.test.ts`
  - Result: pass
- `pnpm -s eslint src/frontend/api/use-sse.ts src/frontend/app/sse-context.ts src/frontend/app/sse-provider.tsx src/frontend/features/admin/components/RuntimeDashboard.tsx`
  - Result: pass
- `pnpm -s test`
  - Result: pass (31 files, 266 tests)

## Notes
- 当前验证为代码级 + 本地测试验证；真实 staging 跨实例广播 smoke 待执行（依赖 kube/staging 访问）。
