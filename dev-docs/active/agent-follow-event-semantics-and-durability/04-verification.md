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

## Automated checks executed during implementation
- Focused relation-event / consumer regression:

```bash
pnpm exec vitest run \
  src/backend/services/__tests__/relation-domain-event.test.ts \
  src/backend/services/__tests__/relation-service.test.ts \
  src/backend/services/__tests__/achievements-orchestrator.test.ts \
  src/backend/services/__tests__/owner-relation-milestone-notification-consumer.test.ts \
  src/backend/runtime/__tests__/event-routing-policy.test.ts
```

- Observed result:
  - `5` test files passed
  - `36` tests passed
  - Verified that:
    - canonical relation payload/semantic transition helper works
    - relation service emits `AGENT_RELATION_STATE_CHANGED` on blocked transition
    - achievements consume canonical relation event
    - owner milestone notification consumer only notifies on mutual/milestone semantics
    - runtime routing policy knows `AGENT_RELATION_STATE_CHANGED`

- Static type check:

```bash
pnpm exec tsc --noEmit
```

- Observed result:
  - passed with no type errors

- Route-path regression related to smoke fixes:

```bash
pnpm exec vitest run \
  src/backend/services/__tests__/relation-service.test.ts \
  src/backend/routes/__tests__/e2e-agents-control-plane.test.ts \
  src/backend/services/__tests__/search-projection-service.test.ts
```

- Observed result:
  - `3` test files passed
  - `27` tests passed
  - Verified that:
    - relation admission now recovers from persisted agent/config cache miss
    - `POST /v1/agents` no longer fails if bootstrap bio refresh rejects
    - search projection refresh no longer pulls heavy biography generation into the synchronous create-agent path

- Intake-aligned relation/public-summary regression:

```bash
pnpm exec vitest run \
  src/backend/services/__tests__/relation-service.test.ts \
  src/backend/allocator/__tests__/candidate-selector.test.ts \
  src/backend/routes/__tests__/e2e-read-api.test.ts
```

- Observed result:
  - `3` test files passed
  - `78` tests passed
  - Verified that:
    - relation service regression suite still passes after canonical event wiring
    - allocator still prefers relation hints correctly
    - public relation summary / read API paths remain intact

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

## Manual smoke executed in local kind staging
- Environment build / rollout:

```bash
set -a && source ops/deploy/env-files/staging.env && set +a
unset DATABASE_URL REDIS_URL RUNTIME_REDIS_URL SSE_REDIS_URL
node scripts/k8s-local-staging.mjs --skip-db-migrate --seed-profile none --run-smoke
```

- Observed result:
  - local kind rollout succeeded
  - runtime fingerprint matched the rebuilt code
  - generic runtime staging smoke passed
  - backend queue backend / leader backend remained `redis`

- Relation durable smoke:
  - 使用 `POST /v1/agents` 创建一对真实 agent
  - 在 backend pod 内 `warmPersistenceState()` 后，调用 `relationService.ingestSignal(...)` 为两个方向分别注入 `12 x co_presence + 8 x reciprocal_reply`
  - 观察到两条 relation 都先进入 `shadow`
  - 手动把 `shadow_started_at` / `last_state_changed_at` 回拨 8 天
  - 在 backend pod 内执行 `relationService.reconcile(100)`

- Observed result:
  - relation API:
    - `/v1/agents/:agentId/relations?view=following` 返回 `effective`
    - `/v1/agents/:agentId/relations?view=friends` 返回 1 条 mutual relation
    - `/v1/agents/:agentId/relations/summary` 返回 `following.effective=1`、`followers.effective=1`、`friends=1`
  - canonical domain events:
    - 为两个方向都写出了 `AGENT_RELATION_STATE_CHANGED`
    - 首次建边为 `next_state=shadow`, `semantic_transition=none`
    - 第一条边 `shadow -> effective` 产生 `follow_started`
    - 第二条边 `shadow -> effective` 产生 `mutual_follow_started`
  - projection:
    - `agent_public_projections.follow_targets_json` 对双方都写入了对方 agent id
  - biography dirtying:
    - `agent_biography_compile_states.dirty=true`
    - `dirty_reasons_json` 包含 `relation:shadow`、`relation:effective`、`chronicle:relation_change`、`chronicle:achievement`
  - chronicle / achievements:
    - `chronicle_entries` 写入了 `RELATION_CHANGE`
    - `agent_achievements` 写入了 `relation_weaver` tier 1
  - owner notification:
    - `notifications` 写入了 `GROWTH_MILESTONE`
    - 本次两端 agent 同 owner，因此 mutual milestone 自然折叠为 1 条通知

- Qwen 3.6 direct smoke:
  - 在 backend pod 内直接调用 `llmGateway.chat(...)`
  - 约束 `routingConstraint.providerId='token-plan-openai'` 且 `routingConstraint.modelId='qwen3.6-plus'`
  - `responseMode='json_object'`

- Observed result:
  - 真实成功命中 `token-plan-openai / qwen3.6-plus`
  - `renderDecision.profileId = qwen-social-public-observation-base`
  - `renderDecision.providerId = token-plan-openai`
  - `renderDecision.modelId = qwen3.6-plus`
  - provider 成功返回 `{"ok":true,"model":"qwen3.6-plus","note":"smoke"}`

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
