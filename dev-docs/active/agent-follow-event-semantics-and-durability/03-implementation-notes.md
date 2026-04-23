# 03 Implementation Notes

## Status
- Current status: `planned`
- Last updated: 2026-04-23

## What changed
- 新建 T-993 任务包，聚焦“稳定产出 agent-follow-agent 事件”，而不是继续扩展显式 social action。
- 固定了 roadmap、plan、architecture、verification、pitfalls 的基线，后续方案对齐和实现都应以本目录为 SSOT。

## Decisions & tradeoffs
- Decision: follow 不是新的动作，而是 relation state 的稳定语义投影。
  - Rationale: 当前 repo 已有可工作的 relation graph、allocator integration、public teaser 和 projection；新增 action 只会制造第二套真相源。
  - Alternatives considered: 让 agent 明确发起 `follow` 行为或增加新的 writer/action plan。
- Decision: canonical 合同固定为单事件 `AGENT_RELATION_STATE_CHANGED`。
  - Rationale: relation state 才是 durable source-of-truth；单事件更利于幂等、重放、审计和下游二次投影。
  - Alternatives considered: 为 `follow_started`、`mutual_follow_started`、`relation_blocked` 分别定义独立 durable event。
- Decision: durable emission 固定为 transaction-bound domain event，直接写现有 `events` 表。
  - Rationale: 当前仓库已经有通用 `Event` 模型和事务内写 event 的模式；真正缺的是 relation 写链里的事务化接缝，而不是另一套 outbox 基础设施。
  - Alternatives considered: 沿用异步 `eventRepo.create()`；先引入通用 outbox 再产出 follow event。
- Decision: 第一批核心 consumer 固定为 achievements、projection、biography dirtying。
  - Rationale: 这三条链都已存在 relation-change 接缝，接入成本低，且能同时覆盖 chronicle、runtime projection 和 owner story/bio 的间接受益。
  - Alternatives considered: 只落事件不接 consumer；优先改 teaser 或 attention broker。
- Decision: 通知只作为 owner milestone consumer，且不逐条通知单边 follow。
  - Rationale: 现有通知系统是 user-facing，不是 agent-facing；若按每次 `follow_started` 提醒，会放大推断性噪声并造成刷屏。
  - Alternatives considered: 对每个 `follow_started` 发 owner 通知；新增 relation-specific notification type。
- Decision: `shadow` 不产生产品级 follow 事件。
  - Rationale: `shadow` 本身就是观察期；直接暴露会导致事件抖动和 UI 噪声。
  - Alternatives considered: `shadow_started` 也对外广播为“弱关注”。
- Decision: canonical follow event 必须 durable，不依赖 best-effort hook。
  - Rationale: 这次任务的核心是“鲁棒性产出事件”；hook 只能做 consumer fanout，不能做 source-of-truth。
  - Alternatives considered: 继续沿用 `setStateChangeHook()`，在 hook 里发 follow event。
- Decision: `effective -> inactive` 默认不视为产品级 unfollow。
  - Rationale: 实际上可以内部推断“follow 已失活/冷却”，但对外不解释成产品级 unfollow，避免语义抖动。
  - Alternatives considered: 一旦离开 effective 就立即发 `unfollow_started`。

## Files/modules likely to matter during implementation
- `src/backend/services/relation-service.ts`
- `src/backend/services/relation-engine.ts`
- `src/backend/repos/relation-repository.ts`
- `src/backend/repos/pg/pg-relation-repository.ts`
- `src/backend/runtime/relation-scheduler.ts`
- `src/backend/container/nurture.ts`
- `src/backend/services/public-agent-relation-summary-service.ts`
- `src/backend/services/agent-public-projection-service.ts`
- `src/backend/services/attention-opportunity-broker.ts`
- `src/backend/services/room-program-scorer.ts`

## Proposed tx interface
推荐把 relation 写链的事务接口统一成一个 relation-repo 专用方法，替代继续堆特例 tx：

```ts
export interface PersistRelationDomainEventTemplate {
  event_type: 'AGENT_RELATION_STATE_CHANGED'
  plane?: EventPlane
  schema_version?: 'v1'
  actor_type?: EventActorType
  actor_id?: string | null
  cause_event_id?: string | null
  idempotency_key: string
  payload_base: Omit<
    RelationStateChangedPayload,
    'relation_id' | 'relation_version' | 'emitted_at'
  >
}

export interface PersistRelationStateChangeTxInput {
  relation_input: UpsertAgentRelationInput
  domain_event_template: PersistRelationDomainEventTemplate
}

export interface PersistRelationStateChangeTxResult {
  applied: boolean
  relation: AgentRelation
  domain_event: DomainEvent | null
  domain_event_status: 'created' | 'deduped' | 'skipped'
}
```

### Why this shape
- `relation_input` 直接复用现有 `UpsertAgentRelationInput`，避免再发明一套近似 DTO。
- `domain_event_template` 不要求 caller 在事务前就知道完整 `CreateEventInput`。
- 这是必要的，因为首次建边时 `relation_id` / `relation.version` 只能在 relation row 持久化后拿到。
- repo 在 tx 内用 `relation` 的最终值把 template enrich 成真正的 `CreateEventInput`，再写入现有 `events` 表。
- `applied` 用来区分“这次 tx 真的推进了 relation 持久化”与“版本冲突 / no-op 后返回了最新 relation”。
- `domain_event` 只在 tx 内确实拿到了 canonical event 行时返回；否则为 `null`。
- `domain_event_status` 明确区分三类情况：
  - `created`: 本次 tx 新写入 canonical event，post-commit fanout 应执行
  - `deduped`: 事件按 idempotency key 已存在，本次不应再次 fanout
  - `skipped`: relation 写未应用，因此本次没有 event append

### Caller contract
- `RelationService.evaluateAndPersist()` 在 `existing?.state !== evaluated.next_state` 时调用该 tx 接口。
- 若 `result.domain_event_status === 'created'`，则在 commit 后执行：
  - `refreshPairHints(...)`
  - achievements / projection / biography fanout
- 若 `result.domain_event_status !== 'created'`，则跳过 immediate fanout；后续如需 crash-recovery fanout，交给单独 replay / backfill 处理。

### Repository-side enrichment rules
- `correlation_id` 推荐在 tx 内绑定为 `relation.id`，而不是由 caller 预先填写。
- `payload_json` 推荐由 tx 内统一补齐：
  - `relation_id`
  - `relation_version`
  - `emitted_at`
- `plane` 默认 `'CONTROL'`
- `actor_type` 默认 `'system'`

### Prisma strategy recommendation
- update path:
  - `updateMany(where: from/to/version=expected_version)`
  - `count === 0` 时视为 optimistic concurrency miss，返回 `applied=false`
  - `count === 1` 后再 `findUnique` 取最新 relation row
- create path:
  - 不用 `upsert`
  - 直接 `create`
  - 若撞到 pair unique constraint，则取最新 row 并返回 `applied=false`
- event append:
  - 在拿到最终 relation row 后，用 enriched event input 执行 `tx.event.create(...)`
  - 若撞到 `idempotencyKey` unique，则回读已有 event 并返回 `domain_event_status='deduped'`

### Why not relation upsert on create path
- 如果 caller 读到 `existing=null`，但并发请求已经先一步创建了 relation，`upsert(...update...)` 会把“本应视为并发 miss”的情况误变成第二次状态推进。
- 这会污染 `version` 递增，并可能制造错误的 semantic event。
- 因此 create path 应显式 `create + unique catch`，而不是无条件 `upsert`。

### Edge-case semantics
- optimistic concurrency 冲突：
  - 返回 `applied=false`
  - `relation` 为数据库里最新状态
  - `domain_event=null`
  - `domain_event_status='skipped'`
- event idempotency 命中：
  - 返回 `applied=true`
  - `relation` 为本次 tx 的目标状态
  - `domain_event` 为已存在 event
  - `domain_event_status='deduped'`
- 正常首次写入：
  - 返回 `applied=true`
  - `relation` 为新状态
  - `domain_event` 为新建 canonical event
  - `domain_event_status='created'`

## Known issues / follow-ups
- 当前 repo 的 follow 语义分散在 `pair_hint`、projection、teaser 和 owner-only panel 中，没有 canonical event。
- 当前 public teaser 会组合 human follow 和 pair hint，后续如要做稳定 activity surface，必须先理清 source attribution。
- 当前默认非 Prisma 模式下 `relationRepo=null`，不能把“本地 dev 没看到 follow 事件”误判为逻辑失败。
- 当前通用 `PgEventRepository.create()` 不是事务型 durable source；follow canonical event 不能直接复用这条异步写链。
- 当前通知系统没有 relation 专用类型；若接入 follow 里程碑，优先复用 `GROWTH_MILESTONE`，并把去重/节流放进 consumer 设计。

## Deviations from plan
- Change: 暂无。
  - Why: 当前处于任务包创建与语义锁定阶段。
  - Impact: 待进入实现阶段后逐项补记。

## Pitfalls / dead ends (do not repeat)
- Keep detailed historical lessons in `05-pitfalls.md`.
