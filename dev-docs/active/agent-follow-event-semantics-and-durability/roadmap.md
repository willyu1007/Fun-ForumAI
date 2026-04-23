# T-993 — Agent Follow Event Semantics And Durability Roadmap

## Goal
- 让仓库基于现有 relation graph 主链，稳定产出 agent-follow-agent 的 canonical 事件，并保证这些事件具备明确语义、耐重放、可审计、可作为后续 runtime/UI/read-model 的统一输入。

## Planning-mode context and merge policy
- Runtime mode signal: `Default`
- User confirmation when signal is unknown: `not-needed`
- Host plan artifact path(s): `(none)`
- Requirements baseline: `(none)`
- Merge method: `set-union`
- Conflict precedence: latest user-confirmed > repository evidence > archived task history > model inference
- Repository SSOT output: `dev-docs/active/agent-follow-event-semantics-and-durability/roadmap.md`
- Mode fallback used: `non-Plan default applied: no`

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | current chat | 目标、约束、以及“不要新加一整套 social action 机制”的边界 | highest | 用户明确要完整任务包，后续据此做 roadmap 对齐 |
| Historical task context | `dev-docs/archive/agent-social-graph-core/00-overview.md`, `dev-docs/archive/agent-social-graph-behavior-integration/00-overview.md`, `dev-docs/archive/agent-social-graph-consistency-hardening/00-overview.md` | 关系图、行为接线与一致性基线 | high | 当前任务是在已有 social graph 基础上补 canonical follow event |
| Repository runtime evidence | `src/backend/services/relation-service.ts`, `src/backend/services/relation-engine.ts`, `src/backend/container/allocator.ts`, `src/backend/services/attention-opportunity-broker.ts`, `src/backend/services/agent-public-projection-service.ts`, `src/backend/services/public-agent-relation-summary-service.ts`, `src/backend/services/room-program-scorer.ts` | 当前关系图如何影响 runtime、projection 与 UI | high | 已确认 relation graph 不是死代码，而是被 allocator/runtime/read-side 实际消费 |
| Persistence/config evidence | `src/backend/lib/config.ts`, `src/backend/container/repos.ts`, `src/backend/container/nurture.ts` | 关系链的启动条件、durability 风险、hook 位置 | high | 已确认 non-Prisma 模式下 `relationRepo=null`，这影响验证策略 |
| Existing tests | `src/backend/services/__tests__/relation-service.test.ts`, `src/backend/allocator/__tests__/candidate-selector.test.ts`, `src/backend/routes/__tests__/e2e-read-api.test.ts`, `src/backend/services/__tests__/public-agent-relation-summary-service.test.ts` | regression baseline 和新增测试落点 | high | intake 阶段已运行部分测试验证主链存在 |
| Model inference | N/A | canonical 事件合同建议、阶段划分、rollback 顺序 | lowest | 仅补足用户尚未明确指定的任务结构与推荐路径 |

## Non-goals
- 不新增 agent follow/unfollow 的主动产品动作、writer、API 或 prompt schema。
- 不把 human-follow 产品链路改造为 agent relation event 的承载层。
- 不在第一版把整个“朋友圈 / 关系动态”产品化做完。
- 不要求所有现有 read surfaces 在本任务内全部切换为 follow event 驱动。
- 不在本任务里重做 complete relation recommendation / graph explorer。

## Locked assumptions and decisions
- A1: `effective` 是唯一对外 follow 成立状态；`shadow` 不对外广播 follow。 (risk: low)
- A2: 双向 `effective` 首次成立时产生 `mutual_follow_started` 语义。 (risk: low)
- A3: `inactive` 允许内部解释为关系降温或 follow 失活，但默认不翻译为产品级 `unfollow`。 (risk: low)
- A4: canonical follow event 应 durable，hook 仅做消费链 fanout。 (risk: low)
- A5: 持久化环境验证需要 Prisma；non-Prisma 模式仅用于逻辑级测试。 (risk: low)
- A6: 本轮 durable emission 采用 transaction-bound domain event，复用现有 `events` 表；outbox 留作后续增强。 (risk: low)
- A7: 第一批核心 consumer 固定为 `AchievementsOrchestrator`、`AgentPublicProjectionService`、`AgentBiographyService.markDirty`。 (risk: low)
- A8: owner-facing 通知作为 batch `1.5` 扩展 consumer，复用 `GROWTH_MILESTONE`，仅消费 `mutual_follow_started` 或关系里程碑。 (risk: low)

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | 关注语义来源 | 新建 social action vs 基于 relation state 投影 | 基于 relation state 投影 | 用户明确要求不新加一整套 social action 机制 | 在 architecture 中固定这一边界 |
| C2 | 对外 follow 起点 | `shadow` 也可算弱关注 vs 仅 `effective` 算关注 | 仅 `effective` 算 follow | 当前 runtime 已把 effective 当稳定关系，shadow 只是观察期 | 后续若要弱提示，可另做 UI 文案，不改 canonical 事件 |
| C3 | 事件形态 | 多个 follow-specific event vs 单 canonical event + semantic transition | 单 canonical event | 用户已确认先采用单事件；这也更利于 durability、对账、幂等和下游分流 | 实现前只需锁定 payload 与 dedup key |
| C4 | durable emission 位置 | hook fanout vs relation write path / outbox | transaction-bound domain event on relation write path | 用户已确认本轮采用事务内 domain event；这能满足稳定存在、审计和重放要求，同时避免 outbox 基础设施扩张 | 实现前只需锁定 tx 接口与 dedup key |
| C5 | `effective -> inactive` 语义 | 立即视为 unfollow vs 仅内部冷却 | 仅内部冷却/失活，不对外解释为产品级 unfollow | 用户已确认这类推断性行为可存在，但不需要对外解释；直接映射 unfollow 容易抖动 | 若产品确有强需求，再在后续任务中单独讨论 |
| C6 | validation baseline | 仅单测 vs 单测 + 持久化 smoke | 两者都要 | non-Prisma 模式会掩盖真实 durability 问题 | verification 中明确环境前提 |
| C7 | 第一批 consumer 范围 | 只落事件 vs 接若干核心 consumer | 接 achievements / projection / biography 三条核心链 | 用户已确认这三条是首批最小闭环 | 实现前只需锁定接线方式 |
| C8 | 通知消费策略 | 每次单边 follow 提醒 vs 只做 owner milestone | 只做 owner milestone，不提醒每次单边 follow | 用户已确认通知应为 owner-facing 的 milestone 提示，而不是推断性逐条播报 | 实现前只需锁定阈值、去重和节流 |

## Scope and impact
- Affected areas/modules:
  - `src/backend/services/relation-service.ts`
  - `src/backend/services/relation-engine.ts`
  - `src/backend/repos/relation-repository.ts`
  - `src/backend/repos/pg/pg-relation-repository.ts`
  - relation scheduler / replay path
  - achievements / projection / biography dirtying consumer paths
  - owner milestone notification consumer path
- External interfaces/APIs:
  - 可能新增 canonical relation event contract
  - 不要求新增对外 HTTP API
  - consumer 侧可能引入新的 explainability / activity source
  - 通知侧优先复用现有 `GROWTH_MILESTONE`，不新增 relation-specific notification API
- Data/storage impact:
  - 需要 relation state change 与 canonical event append 的 durable write path
  - 更可能需要 relation repo 的事务扩展，而不是新增 outbox 基础设施
- Backward compatibility:
  - allocator / pair hint / projection 应继续工作
  - human follow product链不变
  - UI 可以先不迁移，只要 canonical event 已存在

## Project structure change preview (may be empty)
This section is a non-binding hypothesis to make downstream implementation review easier.

### Existing areas likely to change
- Modify:
  - `src/backend/services/relation-service.ts`
  - `src/backend/repos/relation-repository.ts`
  - `src/backend/repos/pg/pg-relation-repository.ts`
  - `src/backend/runtime/relation-scheduler.ts`
  - `src/backend/container/nurture.ts`
  - `src/backend/services/agent-public-projection-service.ts`
  - `src/backend/services/achievements-orchestrator.ts`
  - `src/backend/services/agent-biography-service.ts`
  - `src/backend/services/notification-service.ts` or adjacent consumer module if owner milestone wiring lands in this task slice
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points)
- New module(s) (preferred):
  - `src/backend/services/relation-semantic-transition.ts`
  - `src/backend/services/relation-event-contract.ts`
  - `src/backend/services/__tests__/relation-event-emission.test.ts`
- Optional additions:
  - relation tx helper if current repo interface lacks a suitable transaction-bound emission point

## Phases
1. **Phase 0: Semantics Lock**
   - Deliverable: 明确 follow / mutual follow / blocked / cooled 的语义边界。
   - Acceptance criteria: 文档能回答“何时算关注成立、何时不发事件、human follow 与 agent follow 如何区分”。
2. **Phase 1: Canonical Event Contract**
   - Deliverable: 事件命名、payload、dedup key、consumer contract 定稿。
   - Acceptance criteria: 下游模块无需各自再推断 follow 语义。
3. **Phase 2: Durable Emission Path**
   - Deliverable: relation state change 与 canonical event durable 绑定。
   - Acceptance criteria: replay / restart / reconcile 不会重复产出同一 follow event。
4. **Phase 3: Consumer Alignment**
   - Deliverable: 至少一个 projection/telemetry/read-side 路径改为消费 canonical event 或显式记录后续迁移边界。
   - Acceptance criteria: 路径职责明确，cache 不再被误认为真相源。
5. **Phase 4: Verification And Rollout**
   - Deliverable: regression、manual smoke、rollback、env prerequisites 全部文档化并通过。
   - Acceptance criteria: 可以在持久化环境里证明 follow event 稳定存在。

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 — Semantics lock
- Objective:
  - 固定 follow 事件的业务语义，不让实现阶段在 `shadow/effective/inactive` 上反复摇摆。
- Deliverables:
  - state -> semantic transition matrix
  - human follow vs agent relation follow attribution table
  - non-goal list locked
- Verification:
  - 文档审查能回答所有 open questions 中的核心语义问题
- Rollback:
  - N/A

### Phase 1 — Canonical contract
- Objective:
  - 为 follow 语义建立单一 canonical contract。
- Deliverables:
  - 推荐事件结构
  - dedup strategy
  - reverse-edge mutualization rule
- Verification:
  - contract 文档可直接驱动测试设计与 consumer 接线
- Rollback:
  - 若团队不同意单事件策略，可降级回显式多个 follow events，但仍保持 durable source 单一

### Phase 2 — Durable emission
- Objective:
  - 让 follow semantic event 从 relation state 持久化边界稳定产出。
- Deliverables:
  - compare-and-persist 触发点
  - transaction-bound domain event write path
  - replay-safe emission design
- Verification:
  - duplicate input / retry / replay / reconcile 场景都不产生重复 semantic event
  - process restart 后可恢复继续对账
- Rollback:
  - 保留 relation state machine，本轮新增的 canonical emission 可独立回退

### Phase 3 — Consumer alignment
- Objective:
  - 让 downstream 至少知道 canonical event 是 follow 语义的单一来源。
- Deliverables:
  - core consumer inventory
  - achievements / projection / biography 的迁移策略
  - owner milestone notification 的接入边界
  - pairHintCache 与 durable source 的职责切分
- Verification:
  - 三条核心 consumer 至少有明确接线方案
  - owner notification 不对单边 follow 逐条提醒
- Rollback:
  - consumer 可先保持旧逻辑，只要 canonical event 产出不回退

### Phase 4 — Verification and rollout
- Objective:
  - 用测试和 smoke 证明 follow 事件真能稳定产出，而不是只在设计上成立。
- Deliverables:
  - targeted tests
  - Prisma-backed smoke checklist
  - rollout/backout notes
- Verification:
  - regression suite 通过
  - 持久化环境里 follow / mutual follow / block / replay 场景全部可观测
- Rollback:
  - 关闭 consumer，保留 relation state 与旧读面

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - `pnpm exec vitest run src/backend/services/__tests__/relation-service.test.ts`
  - `pnpm exec vitest run src/backend/allocator/__tests__/candidate-selector.test.ts`
  - `pnpm exec vitest run src/backend/services/__tests__/public-agent-relation-summary-service.test.ts`
  - `pnpm exec vitest run src/backend/routes/__tests__/e2e-read-api.test.ts`
  - new targeted tests for durable follow event emission / replay / mutual follow
- Manual checks:
  - Prisma-backed durable follow start
  - mutual follow establishment
  - replay / reconcile dedup
  - blocked transition
  - local non-Prisma downgrade expectations

## Dependencies and sequencing notes
- Logical dependency:
  - archived `T-037/T-038/T-039` provide the relation graph, behavior integration, and consistency baseline
- Sequencing recommendation:
  1. lock semantics
  2. lock canonical contract
  3. land durable emission
  4. migrate consumers selectively
- Parallelization notes:
  - consumer inventory can run in parallel with emission-path implementation
  - UI-facing activity/product work should remain out of scope until canonical event is landed

## Rollback strategy
- Primary rollback:
  - stop consuming canonical follow event downstream
  - preserve relation state machine and existing pair-hint behavior
- Secondary rollback:
  - if durable emission path proves too invasive, fall back to internal-only canonical event storage while keeping API/product surfaces unchanged
- Explicit non-rollback:
  - do not reintroduce a new prompt-level social action as a workaround
