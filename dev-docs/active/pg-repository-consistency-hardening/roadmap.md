# Pg Repository Consistency Hardening — Roadmap

## Goal
- 将当前 Pg 仓储从“进程内缓存主导 + 异步落库”收敛为“数据库主导一致性”，保证多实例下读写结果一致、可预测。

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed
- Host plan artifact path(s): (none)
- Requirements baseline: (none)
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/pg-repository-consistency-hardening/roadmap.md`
- Mode fallback used: non-Plan default applied: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | 本轮会话（2026-02-25） | 任务目标 | highest | 需围绕一致性改造落任务包 |
| Code evidence | `src/backend/repos/pg/*.ts` | 现状与改造面 | high | 多个仓储使用 Map/Array cache 作为主读源 |
| Existing roadmap | `dev-docs/active/future-platform-evolution/00-overview.md` | 演进对齐 | medium | 对齐多实例基建顺序 |
| Model inference | N/A | 组织执行阶段 | lowest | 补齐实现步骤 |

## Non-goals
- 不引入业务功能新接口。
- 不在本任务内完成 WebSocket 协议迁移。
- 不替代 Runtime 队列改造（T-023 负责）。

## Open questions and assumptions
### Open questions (answer before execution)
- Q1: 仓储改造采用“直接 Prisma 查询”还是“读缓存 + DB 回源 + 失效机制”？
- Q2: 高读取路径（Feed/Rooms/Messages）是否需要引入只读缓存层（Redis）以补偿性能？
- Q3: 是否需要补充 DB 索引以支撑 DB-first 查询模式？

### Assumptions (if unanswered)
- A1: 默认先实现 DB-first，必要时再加受控缓存层（risk: medium）。
- A2: 先保障一致性正确，再优化热点性能（risk: low）。

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | 一致性 vs 吞吐 | 内存缓存高吞吐 vs 多实例一致性 | 一致性优先，性能后置优化 | 用户目标聚焦云上可扩展运行 | 增加压测与索引评估 |

## Scope and impact
- Affected areas/modules:
  - `src/backend/repos/pg/`
  - `src/backend/services/`（依赖仓储行为）
  - `src/backend/container.ts`
  - `prisma/schema.prisma`（可能索引增强）
- External interfaces/APIs:
  - 对外 REST/SSE 合约保持兼容。
- Data/storage impact:
  - 查询模式变化，可能新增索引/分页策略。
- Backward compatibility:
  - 返回字段与业务语义保持不变。

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with host plan artifact
- [x] Boundaries/non-goals are aligned
- [x] Constraints are aligned
- [x] Milestones/phases ordering is aligned
- [x] Acceptance criteria are aligned
- Intentional divergences:
  - 将“消息持久化/一致性”拆为独立执行任务，降低风险。

## Project structure change preview (may be empty)
### Existing areas likely to change (may be empty)
- Modify:
  - `src/backend/repos/pg/`
  - `src/backend/services/`
  - `src/backend/routes/`（可选：分页或一致性观测字段）
  - `prisma/schema.prisma`（可选索引）
  - `src/backend/repos/types.ts`
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/repos/pg/internal/`（查询组装与映射工具，可选）
- New interface(s)/API(s) (when relevant):
  - `RepositoryConsistencyMode`（feature flag）
- New file(s) (optional):
  - `<TBD>` 在 discovery 阶段确认

## Phases
1. **Phase 1**: Repository Audit and Contract Freeze
   - Deliverable: 仓储行为清单与一致性目标
   - Acceptance criteria: 关键读写路径行为可测试
2. **Phase 2**: DB-first Refactor
   - Deliverable: Pg 仓储主读源切到 DB
   - Acceptance criteria: 多实例读取一致，现有回归通过
3. **Phase 3**: Performance Stabilization
   - Deliverable: 索引/缓存策略补强
   - Acceptance criteria: 性能达标且无一致性回退
4. **Phase 4**: Rollout and Guardrails
   - Deliverable: feature flag + runbook + 监控
   - Acceptance criteria: 可灰度可回退

## Step-by-step plan (phased)
### Phase 0 — Discovery
- Objective: 明确所有 Pg 仓储的缓存行为和一致性缺口
- Deliverables:
  - 仓储行为矩阵（create/read/update/hydrate）
  - 风险优先级排序（帖子、评论、房间、消息）
- Verification:
  - 行为矩阵经评审确认
- Rollback:
  - N/A

### Phase 1 — Refactor Core Repositories
- Objective:
  - 优先改造 Post/Comment/Room/Message 仓储
- Deliverables:
  - DB-first 查询与分页实现
  - 映射与 DTO 保持兼容
- Verification:
  - 现有测试通过 + 新增多实例一致性测试
- Rollback:
  - feature flag 恢复 legacy repo mode（短期保留）

### Phase 2 — Stabilize and Tune
- Objective:
  - 修复性能回归并补充观测
- Deliverables:
  - 必要索引与 query 优化
  - 慢查询监控面板
- Verification:
  - 关键接口 P95 达标
- Rollback:
  - 回滚到前一版本镜像，保留 schema 兼容

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - `pnpm test`
  - 新增仓储一致性/并发测试
- Manual checks:
  - 双实例环境对同一资源读写结果一致
  - 重启任一实例后数据视图不分叉
- Acceptance criteria:
  - 不再依赖进程内 Map 作为 Pg 仓储主读源
  - API 返回契约保持兼容
  - 性能在目标范围内（以 NFR 为参考）

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| 查询性能下降 | med | med | 增量改造 + 索引优化 + 压测 | P95/P99 告警 | 回滚镜像 |
| 分页语义改变引发回归 | med | high | 统一游标协议，增加回归测试 | API diff 监控 | 切回 legacy mode |
| 数据映射不一致 | low | high | 强类型映射层 + snapshot tests | E2E 失败 | 回滚到前版本 |

## Optional detailed documentation layout (convention)
```
dev-docs/active/pg-repository-consistency-hardening/
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
