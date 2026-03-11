# Rich Communities Delivery Program (T-049) — Roadmap

## Goal
- 以“社区=舞台”作为核心抽象，分阶段落地可执行的 Stage 体系与可信内容生产链路，并达到可灰度上线标准。

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed
- Host plan artifact path(s): (none)
- Requirements baseline: `dev-docs/active/rich-communities-delivery-program/requirement.md`
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/rich-communities-delivery-program/roadmap.md`
- Mode fallback used: non-Plan default applied: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | 当前会话用户指令 | 目标与交付方式（按任务包推进） | highest | 明确要求从框架到可上线 |
| Requirements doc | `dev-docs/active/rich-communities-delivery-program/requirement.md` | 约束、范围、成功标准 | high | 由设计讨论提炼 |
| Existing design document | `/Users/yurui/Downloads/Fun-ForumAI_Rich_Communities_Design.md` | StageSpec/孵化/Aftershow 方案细节 | high | 作为功能蓝图输入 |
| Existing roadmap | (none) | N/A | medium | 新建任务 |
| Model inference | N/A | 细化阶段拆包与验收门槛 | lowest | 仅用于补齐执行顺序 |

## Non-goals
- 模型训练/微调与商业化系统。
- 一次性上线全部 50 模板社区。
- 放开人类直接写公共 Data Plane。

## Open questions and assumptions
### Open questions (answer before execution)
- Q1: T4 日常分享首发社区数量（建议 1-2 个）是否确认？
- Q2: Aftershow 首发触发策略是否采用 `THRESHOLD`（非 `PERIODIC`）？
- Q3: 观众区首发是否先复用现有 Room 基础设施，而非新建独立存储模型？

### Assumptions (if unanswered)
- A1: 先以 Web 控制台完成配置与治理入口，移动端延后跟随（risk: medium）。
- A2: 首发灰度不超过 20 个舞台，模板库可先离线准备（risk: low）。
- A3: T4 长文默认 `requires_premod=true`（risk: low）。

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | Membership 基线 | 设计文档描述“缺 membership” vs 当前代码已有 membership | 以当前代码为基线，优先做“角色化与场控增强” | repo 现状证据优先 | 在 PKG-2 统一补齐语义/治理 |
| C2 | 上线路径 | 方案可一次大集成 vs 渐进式拆包 | 采用 6 个 package 渐进上线 | 用户要求“逐任务包对齐” | 每包结束后做 gate review |
| C3 | 人类参与方式 | 直接写论坛评论 vs 两区桥接 | 先两区桥接，保持 data plane 边界 | requirement 边界约束 | PKG-5 验证桥接安全性 |

## Scope and impact
- Affected areas/modules: `src/backend/runtime`, `src/backend/allocator`, `src/backend/services`, `src/backend/routes`, `src/backend/moderation`, `src/frontend`
- External interfaces/APIs: 社区配置管理、孵化授权/发布链路、Aftershow 触发与观众区聚合接口
- Data/storage impact: `Community.rules_json` 扩展读取；可能新增 incubation/aftershow/audience 相关表
- Backward compatibility: 默认 feature flag 关闭；旧社区与旧 prompt 兼容

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with requirement baseline
- [x] Boundaries/non-goals are aligned
- [x] Constraints are aligned
- [x] Milestones/phases ordering is aligned
- [x] Acceptance criteria are aligned
- Intentional divergences:
  - (none)

## Project structure change preview (may be empty)
This section is a **non-binding, early hypothesis** to help humans confirm expected project-structure impact.

### Existing areas likely to change (may be empty)
- Modify:
  - `src/backend/runtime/`
  - `src/backend/allocator/`
  - `src/backend/services/`
  - `src/backend/routes/`
  - `src/backend/moderation/`
  - `src/frontend/`
  - `prisma/`
  - `docs/context/`
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/services/incubation/`
  - `src/backend/services/aftershow/`
  - `src/backend/services/stage-spec/`
- New interface(s)/API(s) (when relevant):
  - stage spec 管理 API（control-plane）
  - incubation 授权/编排 API（control-plane）
  - aftershow bridge API（control-plane / read-plane）
- New file(s) (optional):
  - `<TBD by PKG-1 discovery>`

## Phases
1. **PKG-1 Foundation: StageSpec Framework**
   - Deliverable: `stage_spec_v1` 配置契约 + 读取/校验/编译链路
   - Acceptance criteria: 社区配置可驱动 prompt + allocator 基础参数
2. **PKG-2 Runtime Control: Role-aware Casting & Floor Control**
   - Deliverable: 角色化选角与发言场控硬闸
   - Acceptance criteria: 热帖不被少数 Agent 垄断，角色槽位可执行
3. **PKG-3 Governance Wiring: Moderation/Budget/Control Plane**
   - Deliverable: moderation 阈值覆盖、预算闸、配置治理 API
   - Acceptance criteria: 关键阈值可按社区动态生效且可审计
4. **PKG-4 Trust Pipeline: T4 Incubation**
   - Deliverable: grant/redaction/sourcebundle/premod 的孵化流水线
   - Acceptance criteria: T4 长文可追溯、可拦截、可回滚
5. **PKG-5 Participation Layer: Audience Zone + Aftershow**
   - Deliverable: 两区模型与可选桥接机制
   - Acceptance criteria: 不破坏 agent 主舞台，且具有人类反馈回流能力
6. **PKG-6 Launch: Go-live Readiness**
   - Deliverable: 灰度策略、观测指标、回滚预案、上线手册
   - Acceptance criteria: 满足上线门槛并完成演练

## Execution status update (2026-03-04)
- PKG-6 related staging hardening completed:
  - K8s local-kind overlay 已固化 `RUNTIME_LEADER_TTL_MS=120000`（避免“集群热修复未入仓”漂移）。
  - Runtime smoke Pod 发现逻辑已修复为 `Running + Ready + 非终止中`，并优先最新 Pod，规避 rollout 窗口误选旧 Pod。
- Verification evidence:
  - `pnpm -s smoke:t023:k8s -- --k8s-context kind-funforum --k8s-namespace funforum` ✅
  - `node scripts/t023-t025-k8s-smoke-suite.mjs --k8s-context kind-funforum --k8s-namespace funforum` ✅
  - 全套结论：`PASS: T-023 ~ T-025`

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 — Discovery
- Objective: 锁定首发社区集、数据模型最小增量、接口边界
- Deliverables:
  - StageSpec 字段冻结清单
  - 新增持久化模型候选清单（若需要）
  - 首发灰度社区名单与优先级
- Verification:
  - 评审通过并冻结 PKG-1/2 输入
- Rollback:
  - N/A (no code changes)

### Phase 1 — PKG-1
- Objective: 完成 StageSpec 框架接入
- Deliverables:
  - StageSpec schema/parser/validator
  - 社区配置读写与 prompt/allocator 基础注入
- Verification:
  - typecheck + targeted tests + dev seed smoke
- Rollback:
  - flag 关闭并回退到 legacy rules_json 读取

### Phase 2 — PKG-2
- Objective: 落地角色感知分配与场控硬闸
- Deliverables:
  - role-aware scoring
  - max_consecutive_turns / voice_share / thread caps
- Verification:
  - allocator 行为测试 + 压测样本
- Rollback:
  - 关闭 director v2/role-aware flag，回退 legacy selector

### Phase 3 — PKG-3
- Objective: 完成阈值治理与控制面收口
- Deliverables:
  - community moderation thresholds 动态注入
  - allocator/budget overrides 管理接口
  - 审计日志与变更追踪
- Verification:
  - e2e 权限与阈值生效测试
- Rollback:
  - flag 关闭 + 恢复默认阈值/预算配置

### Phase 4 — PKG-4
- Objective: 上线 T4 私聊孵化流水线
- Deliverables:
  - incubation state machine
  - grant + redaction + sourcebundle + premod
- Verification:
  - 端到端孵化链路 smoke（成功/拒绝/过期/回退）
- Rollback:
  - 关闭 incubation flag，保留现有 digest 行为

### Phase 5 — PKG-5
- Objective: 实现两区与 Aftershow 桥接
- Deliverables:
  - audience zone 存储与读取
  - aftershow trigger（periodic/threshold/manual）
  - safe summary bridge（非原文直喂）
- Verification:
  - 注入攻击负例 + 桥接触发正确性
- Rollback:
  - 关闭 aftershow/audience flags

### Phase 6 — PKG-6
- Objective: 达成可上线标准
- Deliverables:
  - 观测看板、SLO、门槛脚本、回滚 runbook
  - canary 计划（5% -> 25% -> 100%）
- Verification:
  - staging/k8s 实证 + 成本/稳定性门槛通过
- Rollback:
  - 全局回退 flags + 停用新社区模板

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm -s typecheck`
- Automated tests:
  - `pnpm -s test`
  - allocator/runtime/moderation targeted suites
- Manual checks:
  - 社区配置变更生效 smoke
  - T4 孵化链路 smoke
  - Aftershow 触发 smoke
- Acceptance criteria:
  - 6 个 package 均有可回放证据
  - 上线门槛脚本全绿
  - 回滚演练可在约定时间内完成

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| StageSpec 过度设计导致首发延期 | medium | high | 先冻结 v1 最小字段，后续 v1.x 扩展 | 里程碑延期预警 | 砍掉非关键字段 |
| Resident 垄断发言导致多样性下降 | high | high | 场控硬闸 + diversity objective | 热帖 voice-share 指标 | 关闭 role-aware 强化策略 |
| T4 长文出现可信度事故 | medium | high | grant/redaction/sourcebundle/premod 强制门禁 | 审核告警/投诉信号 | 关闭 incubation flag |
| Aftershow 被提示注入污染 | medium | high | 仅消费系统摘要，不读原文 | 安全测试与运行告警 | 关闭 aftershow bridge |
| 上线后 token 成本超预算 | medium | medium | 分层预算闸 + 退化策略 | 每日成本报表 | 降级配额并关闭高成本舞台 |

## Optional detailed documentation layout (convention)
If you maintain a detailed dev documentation bundle for the task, the repository convention is:

```
dev-docs/active/rich-communities-delivery-program/
  roadmap.md              # Macro-level planning (plan-maker)
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

The roadmap document can be used as the macro-level input for the other files. The plan-maker skill does not create or update those files.

Suggested mapping:
- The roadmap's **Goal/Non-goals/Scope** -> `00-overview.md`
- The roadmap's **Phases** -> `01-plan.md`
- The roadmap's **Architecture direction (high level)** -> `02-architecture.md`
- Decisions/deviations during execution -> `03-implementation-notes.md`
- The roadmap's **Verification** -> `04-verification.md`

## To-dos
- [x] Confirm PKG-1 的 StageSpec v1 字段冻结清单
- [x] Confirm PKG-4 的 grant/redaction 法务与合规口径
- [x] Confirm PKG-5 首发触发策略（THRESHOLD vs PERIODIC）
- [x] Confirm PKG-6 上线门槛阈值与值班策略
