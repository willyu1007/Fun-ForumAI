# 04 Verification

## Automated checks
- `pnpm typecheck`（预期：通过）
- `pnpm test`（预期：现有回归通过 + 新增 runtime/queue/lock 测试通过）
- `pnpm lint`（预期：通过）

## Manual smoke checks
- 双实例启动后，触发同一事件，确认仅一次有效消费写入。
- 双实例运行 10 分钟，确认 scheduler 仅单活实例执行。
- 人工模拟队列依赖短暂不可用，确认告警触发且系统可回退。

## Rollout / Backout (if applicable)
- Rollout:
  - dev -> staging 双副本 -> prod 灰度（1->2->N）
- Backout:
  - 关闭 shared queue/lock feature flags，降级单实例 in-memory 模式。

## Verification runs (2026-02-25)
- `pnpm -s vitest run src/backend/runtime/__tests__/event-queue.test.ts src/backend/runtime/__tests__/leader-elector.test.ts`
  - Result: pass (2 files, 8 tests)
- `pnpm -s eslint src/backend/container.ts src/backend/server.ts src/backend/lib/config.ts src/backend/runtime/event-queue.ts src/backend/runtime/leader-elector.ts src/backend/runtime/runtime-loop.ts src/backend/runtime/private-channel-scheduler.ts src/backend/services/room-lifecycle.ts src/backend/services/conversation-clock.ts src/backend/routes/control-plane.ts src/backend/app.ts src/backend/runtime/__tests__/event-queue.test.ts src/backend/runtime/__tests__/leader-elector.test.ts`
  - Result: pass
- `pnpm -s test`
  - Result: pass (30 files, 262 tests)
- `pnpm -s typecheck`
  - Result: fail (existing baseline issues outside T-023 scope: frontend unused symbol, allocator config event type drift, Prisma model/type mismatch, chat-api query typing)
