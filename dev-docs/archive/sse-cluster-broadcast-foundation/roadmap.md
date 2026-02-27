# Sse Cluster Broadcast Foundation — Roadmap

## Goal
- 在保持 SSE 协议与前端交互不变的前提下，建立跨实例实时广播能力，并为后续 WebSocket 迁移保留统一抽象层。

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed
- Host plan artifact path(s): (none)
- Requirements baseline: (none)
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/sse-cluster-broadcast-foundation/roadmap.md`
- Mode fallback used: non-Plan default applied: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | 本轮会话（2026-02-25） | 任务目标 | highest | 明确要求将 SSE 升级记入 future-work + 生成任务包 |
| Code evidence | `src/backend/sse/hub.ts`, `src/backend/routes/sse.ts`, `src/frontend/api/use-sse.ts` | 现状与改造面 | high | 当前广播为单实例内存 hub |
| Existing roadmap | `dev-docs/active/future-platform-evolution/00-overview.md` | 演进对齐 | medium | E-09/E-12 |
| Model inference | N/A | 阶段划分 | lowest | 仅补齐执行路径 |

## Non-goals
- 不在本任务中将前端整体切换到 WebSocket。
- 不在本任务中重写业务路由协议。
- 不覆盖 Runtime 队列和仓储一致性改造（依赖 T-023/T-024）。

## Open questions and assumptions
### Open questions (answer before execution)
- Q1: 广播中间件采用 Redis Pub/Sub 还是 NATS？
- Q2: 是否需要在 `SseHub` 之上引入 `RealtimeHub` 接口并提供双实现（local/cluster）？
- Q3: SSE 连接指标是否要按 room/channel 维度打点？

### Assumptions (if unanswered)
- A1: 默认采用 Redis Pub/Sub，优先最小改造路径（risk: low）。
- A2: 前端 `use-sse.ts` 接口保持不变，仅内部增强重连与诊断（risk: low）。

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | 实时协议选择 | 立即 WebSocket vs 保留 SSE | 先做 SSE 集群广播 | 用户已确认“围绕建议改造” | 后续以指标触发 E-09 |

## Scope and impact
- Affected areas/modules:
  - `src/backend/sse/`
  - `src/backend/container.ts`
  - `src/backend/routes/sse.ts`
  - `src/frontend/api/use-sse.ts`
  - `ops/deploy/`, `env/`
- External interfaces/APIs:
  - `/v1/events/stream` 保持兼容。
- Data/storage impact:
  - 新增广播中间件频道命名与消息 envelope 约定。
- Backward compatibility:
  - SSE 客户端无感升级。

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with host plan artifact
- [x] Boundaries/non-goals are aligned
- [x] Constraints are aligned
- [x] Milestones/phases ordering is aligned
- [x] Acceptance criteria are aligned
- Intentional divergences:
  - 将 E-09 的前置工作拆分为独立执行任务。

## Project structure change preview (may be empty)
### Existing areas likely to change (may be empty)
- Modify:
  - `src/backend/sse/`
  - `src/backend/container.ts`
  - `src/backend/routes/sse.ts`
  - `src/frontend/api/use-sse.ts`
  - `ops/deploy/`
  - `env/`
- Delete:
  - (none)
- Move/Rename:
  - `SseHub` 可选抽象为 `RealtimeHub`（不强制）

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/sse/adapters/`
  - `src/backend/sse/contracts/`
- New interface(s)/API(s) (when relevant):
  - `RealtimePublisher`
  - `RealtimeSubscriber`
- New file(s) (optional):
  - `<TBD>` discovery 阶段确认

## Phases
1. **Phase 1**: Realtime Abstraction Design
   - Deliverable: SSE cluster adapter 设计与消息协议
   - Acceptance criteria: 设计可支撑 local 与 cluster 两模式
2. **Phase 2**: Cluster Broadcast Implementation
   - Deliverable: 后端跨实例广播链路可用
   - Acceptance criteria: 任意实例触发事件，所有实例连接都可收到
3. **Phase 3**: Frontend Resilience and Telemetry
   - Deliverable: SSE 客户端重连与状态观测增强
   - Acceptance criteria: 断连恢复可观测，可配置告警阈值
4. **Phase 4**: Rollout and WS Readiness Gate
   - Deliverable: 运行指标与是否触发 WebSocket 迁移评估
   - Acceptance criteria: 形成可执行 go/no-go 决策记录

## Step-by-step plan (phased)
### Phase 0 — Discovery
- Objective: 明确广播中间件、消息协议、观测指标
- Deliverables:
  - Pub/Sub 频道规范
  - 消息 envelope（type/payload/timestamp/source）
  - 指标方案（client count, fanout lag, reconnect）
- Verification:
  - 评审通过并冻结接口
- Rollback:
  - N/A

### Phase 1 — Backend Cluster Broadcast
- Objective:
  - 让 `SseHub` 支持 cluster 模式广播
- Deliverables:
  - local adapter + cluster adapter
  - 广播发布与订阅生命周期管理
- Verification:
  - 2+ 实例端到端广播测试通过
- Rollback:
  - 切回 local adapter

### Phase 2 — Frontend and Ops Hardening
- Objective:
  - 增强客户端容错和运维可观测性
- Deliverables:
  - 重连策略与诊断日志
  - 部署参数（超时、连接上限）文档化
- Verification:
  - 人工断网/实例滚动升级测试通过
- Rollback:
  - 恢复当前 `use-sse.ts` 最小策略

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - `pnpm test`
  - 新增 sse cluster 集成测试
- Manual checks:
  - 双实例 + LB 环境下验证跨实例广播
  - 验证断线重连后增量消息可恢复接收
- Acceptance criteria:
  - SSE 在多实例下可稳定广播
  - 客户端重连行为稳定可观测
  - 形成 WebSocket 迁移门槛指标文档

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 广播风暴放大 | med | med | 房间级过滤 + payload 限流 | fanout lag 告警 | 关闭 cluster adapter |
| Pub/Sub 依赖抖动 | med | high | 重试 + 降级 local mode | broker error rate | 切 local mode |
| 客户端重连过于频繁 | med | med | 指数退避 + 上限控制 | reconnect 指标 | 回滚前端改动 |

## Optional detailed documentation layout (convention)
```
dev-docs/active/sse-cluster-broadcast-foundation/
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
