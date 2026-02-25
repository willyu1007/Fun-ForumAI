# Runtime Queue And Lock Externalization — Roadmap

## Goal
- 将运行时关键可变状态（事件队列、幂等去重、分配锁、调度主节点）从单进程内存迁移到共享基础设施，支撑多实例一致执行。

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed
- Host plan artifact path(s): (none)
- Requirements baseline: (none)
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/runtime-queue-and-lock-externalization/roadmap.md`
- Mode fallback used: non-Plan default applied: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | 本轮会话（2026-02-25） | 目标与范围 | highest | 明确要求使用 plan-maker 产出任务包 |
| Existing roadmap | `dev-docs/active/future-platform-evolution/00-overview.md` | 未来演进对齐 | medium | 对齐 E-09/E-12 |
| Code evidence | `src/backend/allocator/event-queue.ts`, `src/backend/container.ts`, `src/backend/runtime/runtime-loop.ts` | 现状与风险 | high | 当前为 in-memory 队列/锁 |
| Model inference | N/A | 缺口补全 | lowest | 仅用于步骤编排 |

## Non-goals
- 不改动业务产品能力（论坛/聊天室功能边界不变）。
- 不在本任务内升级 WebSocket。
- 不在本任务内完成 Pg 仓储一致性重构（由 T-024 负责）。

## Open questions and assumptions
### Open questions (resolved, 2026-02-25)
- Q1: 队列与锁基础设施选型优先 Redis（BullMQ + Redlock）还是 pg-boss（纯 Postgres）？
  - Answer: 采用 Redis Streams + Redis lease（先落地共享状态能力，保留 in-memory fallback）。
- Q2: RuntimeLoop / PostScheduler / PrivateChannelScheduler 的领导者选举策略采用同一套租约吗？
  - Answer: 采用同一实现策略（Redis lease），但按组件拆分 lock key（降低 stop/release 耦合风险）。
- Q3: 失败重试与死信队列的保留天数和清理策略是多少？
  - Answer: 当前落地 `maxRetries=3` + DLQ 流；保留时长与清理任务由后续 ops/runbook 阶段补齐（follow-up）。

### Assumptions (if unanswered)
- A1: 默认采用 Redis 方案，优先实现共享队列与分布式锁（risk: medium）。`(resolved)`
- A2: 采用单一 leader lock 保护周期任务，worker 无状态横向扩容（risk: low）。`(updated: per-scope lock key)`

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | 实时改造优先级 | WebSocket 升级 vs 一致性基建 | 先做一致性基建，再评估 WS | 用户确认目标是“围绕建议改造” | 在 T-025 中复核指标门槛 |

## Scope and impact
- Affected areas/modules:
  - `src/backend/allocator/`
  - `src/backend/runtime/`
  - `src/backend/container.ts`
  - `src/backend/lib/config.ts`
  - `ops/deploy/`, `env/`
- External interfaces/APIs:
  - 内部执行链路变化，对外 REST/SSE API 保持兼容。
- Data/storage impact:
  - 新增队列/锁存储命名空间（Redis key 或 PG job table）。
- Backward compatibility:
  - 保持单实例模式可运行，提供开关回退到 in-memory。

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with host plan artifact
- [x] Boundaries/non-goals are aligned
- [x] Constraints are aligned
- [x] Milestones/phases ordering is aligned
- [x] Acceptance criteria are aligned
- Intentional divergences:
  - 从“泛化未来项”细化为可执行工程任务。

## Project structure change preview (may be empty)
### Existing areas likely to change (may be empty)
- Modify:
  - `src/backend/allocator/`
  - `src/backend/runtime/`
  - `src/backend/container.ts`
  - `src/backend/lib/config.ts`
  - `src/backend/routes/control-plane.ts`（可选：暴露队列/锁状态）
  - `env/`
  - `ops/deploy/`
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/runtime/queue/`
  - `src/backend/runtime/lock/`
- New interface(s)/API(s) (when relevant):
  - `RuntimeQueue` shared adapter interface
  - `LeaderElector` interface
- New file(s) (optional):
  - `<TBD>` 由 discovery 确认

## Phases
1. **Phase 1**: Discovery and ADR
   - Deliverable: 队列/锁技术选型、失败策略、回退策略文档化
   - Acceptance criteria: ADR 得到确认，影响范围与迁移路径明确
2. **Phase 2**: Shared Queue + Lock Adapters
   - Deliverable: 可切换的 queue/lock 抽象层与实现
   - Acceptance criteria: 本地与测试环境可同时验证 in-memory 和 shared 两模式
3. **Phase 3**: Runtime Integration
   - Deliverable: RuntimeLoop/调度器接入 shared 状态管理
   - Acceptance criteria: 多实例无重复消费、无重复定时任务执行
4. **Phase 4**: Verification and Rollout
   - Deliverable: 压测与回退演练记录
   - Acceptance criteria: 发布门禁通过、回退路径可执行

## Step-by-step plan (phased)
### Phase 0 — Discovery
- Objective: 补齐队列/锁选型与容量参数
- Deliverables:
  - 选型对比（Redis vs pg-boss）
  - key/job 命名约定
  - 失败重试/死信策略
- Verification:
  - 团队评审通过，关键 open questions 收敛
- Rollback:
  - N/A

### Phase 1 — Adapter Layer
- Objective:
  - 抽象 `EventQueue` 和分布式锁接口，保留 in-memory fallback
- Deliverables:
  - 新增 shared queue adapter
  - 新增 leader lock/election adapter
- Verification:
  - 单元测试覆盖 enqueue/dequeue/lock acquire/release
- Rollback:
  - 保留旧实现，feature flag 切回 in-memory

### Phase 2 — Runtime Wiring
- Objective:
  - RuntimeLoop 与调度器全面使用外部状态
- Deliverables:
  - `container.ts` 注入 shared adapters
  - 控制面状态接口（可选）展示队列与 leader 状态
- Verification:
  - 双实例集成测试：无重复执行，无事件丢失
- Rollback:
  - 关闭 shared 模式开关，回到单实例

### Phase 3 — Rollout
- Objective:
  - 以 staging 为主完成灰度发布和演练
- Deliverables:
  - 运行指标基线
  - 回退演练记录
- Verification:
  - 队列积压可控，调度任务单活稳定
- Rollback:
  - 逐级降回单实例 + in-memory

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - `pnpm test`
  - 新增 runtime/queue/lock 集成测试
- Manual checks:
  - 双实例启动，验证 event 仅消费一次
  - 人工触发 runtime，验证 scheduler 单活
- Acceptance criteria:
  - 多实例下无重复消费、无明显事件丢失
  - 定时任务单活执行且可观测
  - feature flag 可在 5 分钟内回退

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 锁误配导致重复执行 | med | high | 统一 lock key 与 TTL 策略，增加 fencing token | 重复 run_id 指标异常 | 切回单实例 |
| 队列积压增长 | med | high | 配置重试上限/死信，扩 worker | queue lag 告警 | 降级 batch + 回退 |
| Redis/队列服务故障 | low | high | 健康检查 + fallback 策略 | 连接错误率告警 | 切 in-memory 单实例 |

## Optional detailed documentation layout (convention)
```
dev-docs/active/runtime-queue-and-lock-externalization/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

## To-dos
- [x] Confirm planning-mode signal handling and fallback record
- [x] Confirm input sources and trust levels
- [x] Confirm merge decisions and conflict log entries
- [x] Confirm open questions
- [x] Confirm phase ordering and DoD
- [x] Confirm verification/acceptance criteria
- [x] Confirm rollout/rollback strategy
