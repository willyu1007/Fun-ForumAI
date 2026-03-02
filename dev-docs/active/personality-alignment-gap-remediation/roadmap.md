# Personality Alignment Gap Remediation — Roadmap

## Goal
- 系统性修复《Fun-ForumAI_Gaps_and_Risks_Alignment_Report》提到的全部问题，并补齐已确认的高风险落地缺口，使 Agent Personality V1 从“框架可用”提升到“语义正确、可灰度、可解释”。

## Planning-mode context and merge policy
- Runtime mode signal: Default
- User confirmation when signal is unknown: not-needed
- Host plan artifact path(s): (none)
- Requirements baseline: (none)
- Merge method: set-union
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/personality-alignment-gap-remediation/roadmap.md`
- Mode fallback used: non-Plan default applied: yes

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | 本轮会话（2026-03-02） | 任务目标与范围 | highest | 明确要求“新生成完整任务包，覆盖审查报告全部问题” |
| Review report | `/Users/phoenix/Downloads/Fun-ForumAI_Gaps_and_Risks_Alignment_Report.md` | 问题清单与分期建议 | high | 覆盖 PPR、导演层、社区文化层、chronicle 风险、flag 一致性、proactive 覆盖 |
| Code evidence | `src/backend/**`, `src/frontend/**`, `prisma/schema.prisma` | 验证问题真实性与改动面 | high | 已完成逐条独立核查 |
| Existing personality tasks | `dev-docs/active/*T-045~T-047*` | 对齐已有决策与边界 | medium | 避免重复建设与语义冲突 |
| Model inference | N/A | 拆解执行顺序与回滚策略 | lowest | 仅用于填补未明示细节 |

## Non-goals
- 不在本任务中替换 LLM provider/model 或引入新大模型能力。
- 不重写 forum/chat 核心业务协议（REST/SSE 合约保持兼容）。
- 不将该任务扩展成“全平台重构”；仅修复报告相关缺口与其直接依赖。

## Frozen decisions (2026-03-02)
- PPR 固定为异步离线预计算（非 request-time 计算），刷新周期固定每 5 分钟。
- PPR 存储固定为 Postgres `ppr_snapshots`，并回填最近 30 天。
- Director 默认配比固定 `core/contrast/wildcard = 2/1/1`，社区可通过 `director_v1` 覆盖。
- Director 配置固定落点：`community.rules_json.personality.director_v1`。
- Chronicle 首版固定“读时聚合 + 缓存”，阈值超标后再升级聚合表。
- 独立核查项（`model=default` 404、T-047 文档状态漂移）纳入 Phase 0 一并闭环。

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | 任务组织方式 | 继续拆到 T-045/046/047 vs 新建总修复任务 | 新建 T-048 总修复任务，保留 T-045~047 作为已完成基座 | 用户明确要求“新生成完整任务包” | T-048 完成后回写 T-045~047 关联说明 |
| C2 | 依赖顺序 | 先做 PPR/导演 vs 先修现有噪音/风险 | 先修 Phase 0 稳定性，再上分配与文化层 | 线上风险优先级更高 | Phase 0 作为上线前门槛 |
| C3 | 修复范围 | 仅报告原文 vs 报告+独立核查补充 | 以报告为强约束，并纳入独立核查出的阻断项 | 用户要求“逐条检查并独立思考” | 补充项单独标记为“independent” |

## Scope and impact
- Affected areas/modules:
  - `src/backend/allocator/`
  - `src/backend/runtime/`
  - `src/backend/services/` (achievements/proactive/private channel)
  - `src/backend/routes/` (read-api/control-plane)
  - `src/backend/lib/config.ts`, `env/contract.yaml`, `env/.env.example`
  - `src/frontend/features/agents/`, `src/frontend/api/`
  - `prisma/schema.prisma`（如引入增量聚合表）
- External interfaces/APIs:
  - 保持现有公开路由兼容；必要时仅新增可选调试字段或内部治理接口。
- Data/storage impact:
  - 可能新增图相关缓存键、chronicle 聚合存储、指标预聚合结构。
- Backward compatibility:
  - `FF_*` 默认关闭且逐步灰度，保证可回退到当前稳定行为。

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with host plan artifact
- [x] Boundaries/non-goals are aligned
- [x] Constraints are aligned
- [x] Milestones/phases ordering is aligned
- [x] Acceptance criteria are aligned
- Intentional divergences:
  - 无 host artifact，以上项以本任务包为唯一规划基线。

## Project structure change preview (may be empty)
This section is a non-binding, early hypothesis to help humans confirm expected project-structure impact.

### Existing areas likely to change (may be empty)
- Modify:
  - `src/backend/allocator/`
  - `src/backend/runtime/`
  - `src/backend/services/`
  - `src/backend/routes/`
  - `src/frontend/features/agents/`
  - `src/frontend/api/`
  - `env/`
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/allocator/ppr/`
  - `src/backend/allocator/director/`
  - `src/backend/runtime/community-profile/`
- New interface(s)/API(s) (when relevant):
  - `GraphRelevanceProvider`
  - `CastingDirectorPolicy`
  - `ChronicleSignalPolicy`
- New file(s) (optional):
  - `<TBD>` in Phase 0 discovery

## Phases
1. **Phase 0**: 现有链路去噪与可控化（报告 Section 4/5/6）
   - Deliverable: chronicle/public/proactive/flag 风险闭环，消除“可运行但不可控”状态。
   - Acceptance criteria: signal 不再默认 PUBLIC；metrics 不再 O(n*m) 扫描；COMMENT 点赞可触发 proactive；flag 上线有一致性清单。
2. **Phase 1**: PPR 异构相关性层（报告 Section 1）
   - Deliverable: A-C-T 图相关性与多跳传播进入候选评分。
   - Acceptance criteria: 候选稳定性、可解释性指标达标，且支持探索阀门。
3. **Phase 2**: Casting Director 分层编排（报告 Section 2）
   - Deliverable: core/contrast/wildcard 的舞台导演层接入 allocator。
   - Acceptance criteria: 回应分布符合配比策略，场景冲突减少。
4. **Phase 3**: Community Prompt Profile 文化层增强（报告 Section 3）
   - Deliverable: 社区文化模板结构化并进入 prompt-layer-service。
   - Acceptance criteria: 跨社区语气/边界差异可回放、可审计。
5. **Phase 4**: 成就语义升级与剧情锚点化（报告 Section 4）
   - Deliverable: 成就定义从 KPI 偏向转为“剧情节点+关系事件+长期弧线”。
   - Acceptance criteria: high-signal 条目占比提升，噪声条目受控。

## Step-by-step plan (phased)
### Phase 0 — Discovery and safety hardening
- Objective: 先把当前系统中“高噪音/高风险/高成本”点收敛到可上线状态。
- Deliverables:
  - Chronicle signal visibility policy（public/owner/admin）
  - Importance scorer 对 signal 的语义化评分输入
  - Metrics 增量聚合方案（替换全量扫描）
  - Proactive COMMENT 点赞 target 解析补齐
  - Feature flag 发布核对清单（env + deploy + smoke）
- Verification:
  - 单元测试 + 集成 smoke 覆盖上述 5 类风险
  - 关键路径日志审计可复现
- Rollback:
  - 通过 `FF_ACHIEVEMENT_CHRONICLE_V1` 与 `FF_PROMPT_ORCHESTRATOR_ENABLED` 回退到旧路径

### Phase 1 — PPR relevance layer
- Objective: 为候选选择提供“稳定 + 多跳 + 话题偏好”的图相关性。
- Deliverables:
  - `GraphRelevanceProvider` 抽象
  - 离线 `ppr-backfill` + `ppr-refresh` 作业（5 分钟刷新）
  - `ppr_snapshots` 仓储与 allocator 快照读取
- allocator score 组合公式接入（含探索项）
- Verification:
  - 回放样本下 top-k 稳定性与多样性指标
  - 无 PPR 时可回退到 legacy score
- Rollback:
  - 新增 `FF_ALLOCATOR_PPR_ENABLED`（默认 false）

### Phase 2 — casting director
- Objective: 将“谁上场”从纯分数排序升级为“导演策略 + 角色配比”。
- Deliverables:
  - core/contrast/wildcard 三类候选池
  - director policy 与预算分配
  - allocator 最终选人链路改造
- Verification:
  - 场景回放下角色结构符合策略
  - wildcard 比例可控，不破坏稳定常驻
- Rollback:
  - `FF_CASTING_DIRECTOR_ENABLED` 关闭即回退 legacy allocator

### Phase 3 — community prompt profile
- Objective: 让社区文化规则成为结构化 prompt 组件，而非简化文本拼接。
- Deliverables:
  - community profile schema（tone/taboo/rhythm/moderation/lexicon）
  - profile compile pipeline（rules_json -> normalized profile）
  - prompt-layer-service 与 audit 输出增强
- Verification:
  - 相同 agent 在不同社区输出差异可观测
  - prompt audit 包含 profile provenance
- Rollback:
  - `FF_COMMUNITY_PROMPT_PROFILE_V1` 关闭回退到旧 community layer

### Phase 4 — achievement semantics upgrade
- Objective: 保留框架，重做语义与数据流，让 chronicle 成为剧情锚点。
- Deliverables:
  - 30 成就池重分层（剧情/关系/成长/治理）
  - signal 压缩与摘要策略
  - highlights 质量阈值与展示策略
- Verification:
  - Public highlights 噪音显著下降
  - owner/admin 视角保留完整可追溯性
- Rollback:
  - 关闭 `FF_ACHIEVEMENT_PUBLIC_HIGHLIGHTS` 立即停止 public 透出

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - `pnpm vitest run src/backend/runtime/__tests__/event-bridge.test.ts`
  - `pnpm vitest run src/backend/runtime/__tests__/prompt-orchestrator.test.ts`
  - `pnpm vitest run src/backend/services/__tests__/achievements-orchestrator.test.ts`
  - `pnpm vitest run src/backend/services/__tests__/achievement-chronicle-service.test.ts`
  - `pnpm vitest run src/backend/services/__tests__/proactive-interaction-service.test.ts`
  - 新增：allocator/ppr/director/community-profile 相关测试套件
- Manual checks:
  - 回放固定事件集，对比修复前后候选稳定性/多样性
  - 验证 COMMENT 点赞触发 proactive 成功
  - 验证 public highlights 无 owner-only 信号泄露
- Acceptance criteria:
  - 报告 Section 1-6 所有问题均有对应代码修复与验证记录
  - 每项修复均有开关/回退路径
  - staging 灰度验证通过后再考虑全量

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| PPR 计算开销过高 | med | high | 缓存+限深+降采样 | allocator latency 指标 | 关 `FF_ALLOCATOR_PPR_ENABLED` |
| 导演层导致参与者失真 | med | med | 固定配比 + 场景回放调参 | 候选分布监控 | 关 `FF_CASTING_DIRECTOR_ENABLED` |
| 社区文化层过拟合 | low | med | schema 校验 + 回放评估 | prompt audit diff | 关 `FF_COMMUNITY_PROMPT_PROFILE_V1` |
| 成就语义调整引发历史不一致 | med | med | 新旧定义版本化 | highlights 对比看板 | 关 public flag |
| Flag 配置漂移导致线上失控 | med | high | 发布前 contract 校验 + smoke checklist | startup config audit | 回退环境变量并重启 |

## Optional detailed documentation layout (convention)
```
dev-docs/active/personality-alignment-gap-remediation/
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
