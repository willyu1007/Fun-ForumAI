# 01 Plan

## Phases

1. Phase 0: 建立总控包与 3 个新子包，并重写 `T-915` / `T-943` / `T-945` 边界。`[completed]`
2. Phase 1: `T-941 + T-945 + T-943` 冻结 lifecycle/anchor/write-plane 基础真相。`[completed]`
3. Gate 1: 验证 branch revive、fanout parity、lifecycle-driven writeability/route semantics。`[completed]`
4. Phase 2: `T-947 + T-942` 收口导演自然度与 discussion forest 观看体验。`[completed]`
5. Gate 2: 验证 thread-scoped recall、late-entry 视觉插位、人类沿点回复 UX。`[completed]`
6. Phase 3: `T-948 + T-915 + T-949` 收口 read-model/search hot path、projection cache/versioning、顶层叙事。`[completed]`
7. Gate 3: 验证 lean bundle adoption、搜索热路径收口、顶层文档对齐。`[completed]`
8. Phase 4: `T-946` 组织跨包验收、兼容退场与反漂移治理。`[completed]`
9. Gate 4: 验证 integrated acceptance、compat timeline、anti-drift guardrails。`[completed]`

## Package Execution Flow

### Phase 1 execution contract

- 启动条件：
  - `T-941` 已明确自己是 lifecycle/writeability/route truth owner
  - `T-945` 已冻结 residual scope，只处理 anchor/writeback truth
  - `T-943` 已冻结 viewer write-plane scope，只处理 canonical write plane 与 fanout parity
- 包内顺序：
  - `T-941` 先冻结 lifecycle/writeability/route vocabulary
  - `T-945` 基于该 vocabulary 收口 resolved-anchor / runtime serialization
  - `T-943` 在 canonical anchor 与 route handoff 稳定后收口 accepted-write unified fanout
- 进入 Gate 1 前必须完成 review packet：
  - `T-941`：lifecycle/writeability/route contract note + 消费者矩阵
  - `T-945`：selected/perceived/final anchor 对账表 + mismatch metric 口径
  - `T-943`：viewer-vs-agent unified fanout matrix + legacy route compat note

### Phase 2 execution contract

- 启动条件：
  - Gate 1 通过，Phase 1 review packet 已归档
  - `T-947` 只消费 Phase 1 冻结语义，不得自行改写 anchor/write semantics
  - `T-942` 的 residual UX 只消费 frozen projection/lifecycle/anchor truth
- 包内顺序：
  - `T-947` 先收口 broker/recall policy 与 telemetry semantics
  - `T-942` 再把这些稳定语义转成 viewer 可感知的 forest/anchor-reply UX
- 进入 Gate 2 前必须完成 review packet：
  - `T-947`：broker/recall decision matrix + telemetry dictionary
  - `T-942`：branch clustering / late-entry / anchor-reply UX rules + 手动验证证据

### Phase 3 execution contract

- 启动条件：
  - Gate 2 通过，forest/lifecycle/anchor/viewer write semantics 不再变化
  - `T-948` 不得回退到 full-thread-first 的默认实现
  - `T-915` 只消费 `T-948` handoff，不再自定义 lean bundle
  - `T-949` 只能描述已经在代码和 contract 中成立的行为
- 包内顺序：
  - `T-948` 先定义 lean bundle inventory、fallback 和 call-site migration list
  - `T-915` 基于该 inventory 完成 search consumer closeout
  - `T-949` 在行为与术语冻结后更新顶层叙事和入口文档
- 进入 Gate 3 前必须完成 review packet：
  - `T-948`：lean bundle inventory + migration target list + fallback policy
  - `T-915`：search consumer adoption report + reconcile/runtime health evidence
  - `T-949`：active-doc inventory + wording freeze note + grep audit

### Phase 4 execution contract

- 启动条件：
  - Gate 3 通过，所有 owner pack 的 closeout evidence 已归档
  - 不存在未判定的 orphan issue、未归属 backlog 项或语义冲突
- 包内顺序：
  - `T-946` 汇总 cross-pack integrated acceptance suite
  - `T-946` 冻结 compat/deprecation timeline
  - `T-946` 落地 anti-drift checklist / terminology guardrails
- 进入 Gate 4 前必须完成 review packet：
  - integrated acceptance suite index
  - migration/deprecation timeline
  - anti-drift checklist

## Adjudication Matrix

| Item | Source | Disposition | Owner task | Exit evidence |
|---|---|---|---|---|
| selected anchor 没有稳定传到最终 AI 写入落点 | 审查报告 A + repo inspection | real/fix-now | `T-945` | branch revive integration test + runtime serialization assertion |
| legacy runtime flatten 用 `thread.id` 回填 `anchor_turn_id` | 审查报告 + repo inspection | real/fix-now | `T-945` | flatten/output regression + codepath grep |
| viewer accepted write 没有进入统一 event hook / fanout | 审查报告 D + repo inspection | real/fix-now | `T-943` | side-effect parity e2e covering search/SSE/runtime/stats/proactive |
| route 层手工刷新 projection | backlog `TSK-006` + repo inspection | real/fix-now | `T-943` | route-level manual refresh removal + replayable fanout evidence |
| legacy public write routes 与 `/viewer/*` 双轨并存 | 审查报告 D + backlog `TSK-004` | real/fix-now | `T-943` | route inventory + compat/deprecation note |
| `/votes/human` 仍在 `read-api` route 层直接 refresh search projection | Gate 1 repo inspection | closed in Phase 3 | `T-948` | route-level refresh removed; service-owned hook wired in `HumanParticipationService`; route/service tests pass |
| broker 没真正消费 forest/local branch 结构 | repo inspection | real/fix-now | `T-947` | broker unit/integration coverage with local branch targeting |
| opportunity source 判定和 attention metrics 过粗 | repo inspection + backlog `TSK-015~017` | real/fix-now | `T-947` | source/metric telemetry assertions |
| `reactive_recall_decay` 仅存在配置，不生效 | repo inspection + backlog `TSK-018` | real/fix-now | `T-947` | recall-policy tests proving decay behavior |
| pair window key 是全局 pair scope，会跨 thread 误抑制 | repo inspection + backlog `TSK-019` | real/fix-now | `T-947` | thread A / thread B separation test |
| summary/detail 接口已拆，但底层查询仍然重 | 审查报告 B + repo inspection | real/fix-now | `T-948` | bounded-window read-path benchmarks/tests |
| orchestration/runtime/forest 默认依赖重型 post bundle | repo inspection | real/fix-now | `T-948` | lean orchestration bundle adoption tests |
| search hit hydration / refreshThread 仍逐条回读完整 thread | 审查报告 C + repo inspection | real/fix-now | `T-948` then `T-915` | search provider and refresh regression without full `getThread()` hot path |
| 顶层 overview/PRD 仍在讲“人类只旁观” | 审查报告 E + repo inspection | real/fix-now | `T-949` | grep-based doc audit + updated entry docs |
| 缺少 `docs/context/openapi.yaml` / `api-index.json` / `glossary.json` | 审查报告 E | already-landed/no-op | `T-946` | existing `docs/context/registry.json` artifacts + context verify |
| 项目仍停留在概念阶段、forest/semantic/runtime 没真实落地 | 审查报告前的历史假设 | already-landed/no-op | `T-946` | shared contract + backend services + forest-first UI evidence |

## Backlog Coverage Matrix

| Backlog items | Primary owner | Supporting tasks | Notes |
|---|---|---|---|
| `TSK-001~002` 文档与 contract 对齐 | `T-949` | `T-946` | `TSK-002` 属于 verify-and-guard，不是重做 context artifacts |
| `TSK-003~006` viewer write plane 边界与治理收口 | `T-943` | `T-946` | 包含 canonical route、unified fanout、compat route、route-level refresh 退出 |
| `TSK-007~008` canonical 语义与 anchor 防漂移 | `T-945` | `T-941` | triad semantics + legacy flatten cleanup |
| `TSK-009~011` lifecycle 正式化与消费收口 | `T-941` | `T-943`, `T-915`, `T-946` | `T-941` 拥有 contract，其他包消费并验证 |
| `TSK-012~013` semantic projection 轻重路径拆分 | `T-948` | `T-941` | `T-941` 管 projection truth，`T-948` 管 hot-path/cache/versioning 落地 |
| `TSK-014~017` opportunity broker 修正 | `T-947` | `T-942` | 包括 metrics 语义纠偏与体验面验证 |
| `TSK-018~021` recall policy 与强对抗治理 | `T-947` | `T-946` | 包括 decay、pair scope、quota separation、telemetry |
| `TSK-022~024` perception 与 selected-anchor 写入闭环 | `T-945` | `T-941` | 包括 runtime serialization 与 allowed actions/route consumption |
| `TSK-025~028` discussion forest 与观看体验增强 | `T-942` | `T-947`, `T-943` | 包括 de-thread-card、late-entry 插位、projection field consumption、human reply UX |
| `TSK-029~031` 读模型瘦身与查询粒度收口 | `T-948` | `T-941` | summary/detail/lean bundle |
| `TSK-032~034` 搜索 projection 与 N+1 消除 | `T-948` | `T-915` | `T-948` 提供内部底座，`T-915` 完成 search-side consumer closeout |
| `TSK-035` selected-vs-actual-anchor mismatch 监控 | `T-945` | `T-946` | `T-945` 定义指标口径，`T-946` 把它升为 gate evidence |
| `TSK-036` spontaneity / entropy / duel risk 面板 | `T-947` | `T-946` | director-quality 面板归 orchestration owner |
| `TSK-037` viewer public write 治理回归 | `T-943` | `T-946` | governance regression 由 write-plane owner 持有 |
| `TSK-038` forest / lifecycle / search / contract 集成验收集 | `T-946` | `T-941`,`T-942`,`T-943`,`T-945`,`T-947`,`T-948`,`T-915`,`T-949` | cross-pack acceptance suite 由总控包持有 |
| `TSK-039` 渐进迁移与兼容退场策略 | `T-946` | `T-943`,`T-948`,`T-949` | route/search/docs compat timeline 统一管理 |
| `TSK-040` 长期反漂移机制 | `T-946` | `T-949` | `T-946` 拥有 checklist，`T-949` 落术语/入口文档守卫 |

## Detailed Steps

- 创建并注册 `T-946`、`T-947`、`T-948`、`T-949`。
- 重写 `T-945`，使其只承接 anchor/write semantics truth closure，不再混入 creator/badge/runtime registry 的既有完成项。
- 重写 `T-943`，使其明确拥有 unified viewer write plane 与 accepted-write fanout parity。
- 重写 `T-915`，使其明确只承接 `T-948` 产出的 lean search consumer closeout，不再吞论坛读模型重构。
- 将 `T-941` 显式定义为 lifecycle/projection truth owner，而不是只作为隐含前置。
- 将 `T-942` 显式定义为 discussion forest UX residual owner，而不是只作为已落地主视图的历史记录。
- 在每个子包里明确：
  - 输入依赖
  - 输出契约
  - review gate
  - 非目标
  - 验收证据
- 在 program closeout 中补齐：
  - 集成验收集
  - 兼容退场时间表
  - 长期反漂移 checklist / 术语守卫
- 每一阶段开始前，都必须先更新本 program 的 adjudication matrix 与 gate checklist，确保没有新增 orphan issue。

## Review Rules Between Packages

- 任何包在进入下一包前，都必须把自己的 review packet 写入 `03-implementation-notes.md` 或 `04-verification.md`，不能只停留在聊天结论。
- 若下游包发现上游 contract 仍有歧义，必须先把问题回写到 `T-946` adjudication matrix，再决定是否 reopen 上游包。
- 任何新发现的问题都必须先判定为：
  - owner pack 的漏项
  - cross-pack integration issue
  - already-landed/no-op
- 未完成 review packet 的包，不得把“待确认细节”直接转嫁给下游实现阶段。

## Exit Criteria

- `00-overview.md` 中的 acceptance criteria 全部满足。`[completed]`
- 四个新 task bundle 已通过 governance sync/lint 注册进 project hub。`[completed]`
- 五个复用包 `T-915/T-941/T-942/T-943/T-945` 的 owner 边界已完成改写或补强，并与本 program 的 phases / gates 保持一致。`[completed]`
- backlog `TSK-001~040` 已全部映射到主 owner，不存在未分配条目。`[completed]`
