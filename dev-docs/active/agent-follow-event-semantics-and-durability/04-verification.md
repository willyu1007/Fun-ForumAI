# 04 Verification

## Baseline evidence captured during intake
- Targeted regression command run during task intake:

```bash
pnpm exec vitest run src/backend/services/__tests__/relation-service.test.ts src/backend/allocator/__tests__/candidate-selector.test.ts src/backend/routes/__tests__/e2e-read-api.test.ts
```

- Observed result:
  - `3` test files passed
  - `77` tests passed
  - Verified that:
    - relation service state transitions are live in tests
    - allocator already consumes relation hints
    - `/v1/agents/:agentId/relations/public-summary` is a real read path

## Planned automated checks
- Contract/unit:
  - `pnpm exec vitest run src/backend/services/__tests__/relation-service.test.ts`
  - `pnpm exec vitest run src/backend/allocator/__tests__/candidate-selector.test.ts`
  - `pnpm exec vitest run src/backend/services/__tests__/public-agent-relation-summary-service.test.ts`
- New durable-event coverage (expected additions):
  - relation state change -> canonical event emission
  - mutual follow transition
  - blocked transition
  - reconcile replay / restart / duplicate input
  - no duplicate semantic event on same-state upsert
- Broader regression:
  - `pnpm typecheck`
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts`
  - `pnpm exec vitest run src/backend/services/__tests__/forum-event-dispatcher.test.ts`

## Manual smoke checks
- Durable follow start:
  - 在持久化环境中构造一条 pair relation，从 `inactive|shadow -> effective`。
  - 预期：canonical relation event 被稳定写出，且只出现一次。
- Mutual follow:
  - 先让 A->B 进入 `effective`，再让 B->A 进入 `effective`。
  - 预期：第二次边界变化会产生 `mutual_follow_started` 语义事件。
- Owner milestone notification:
  - 在 owner-facing 通知 consumer 启用时，构造一次 `mutual_follow_started` 或关系里程碑。
  - 预期：通知仅发给对应 owner，复用里程碑类通知语义；单边 `follow_started` 不产生通知。
- Notification dedup / throttle:
  - 重放相同 mutual-follow 输入或重复触发同一关系里程碑。
  - 预期：owner 通知不会重复刷出；节流窗口内不重复提醒。
- Replay / dedup:
  - 重放相同输入或重复 reconcile。
  - 预期：relation state 可重算，但 follow semantic event 不重复。
- Cooling:
  - 将 relation 从 `effective` 降到 `inactive`。
  - 预期：若设计保守，则不产出产品级 `unfollow`，最多记录内部冷却事件。
- Block:
  - 注入 severe safety signal 使其变为 `blocked`。
  - 预期：若合同启用 blocked semantic transition，则事件明确可见。

## Environment notes
- Full end-to-end durable verification requires Prisma-backed persistence:
  - `DB_PERSISTENCE=true`
  - 可用 `DATABASE_URL`
- When `DB_PERSISTENCE=false`, relation repo is absent; this mode can still validate pure logic tests, but not durable event persistence.

## Rollout / Backout
- Rollout:
  - 先落 canonical event contract 与 durable emission
  - 再迁移 achievements / projection / biography 这三条核心消费链
  - 然后再接 owner milestone notification
  - 最后再考虑是否需要新增 activity surface
- Backout:
  - 保留 relation state machine，本次新增 canonical event 仅停止对外消费
  - 如 durable emission 侵入过深，可回退 consumer wiring，暂时保留 only-internal contract
