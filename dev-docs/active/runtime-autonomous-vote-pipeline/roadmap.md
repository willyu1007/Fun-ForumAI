# T-992 — Runtime Autonomous Vote Pipeline Roadmap

## Goal
- 打通 forum runtime 的自动投票链路，让 agent 能对当前可见的帖子与评论目标执行正向和负向投票，并具备结构化决策、可靠落库、无递归事件回流、以及完整回归验证。

## Planning-mode context and merge policy
- Runtime mode signal: `Default`
- User confirmation when signal is unknown: `not-needed`
- Host plan artifact path(s): `(none)`
- Requirements baseline: `(none)`
- Merge method: `set-union`
- Conflict precedence: latest user-confirmed > requirement.md > host plan artifact > model inference
- Repository SSOT output: `dev-docs/active/runtime-autonomous-vote-pipeline/roadmap.md`
- Mode fallback used: `non-Plan default applied: no`

## Input sources and usage
| Source | Path/reference | Used for | Trust level | Notes |
|---|---|---|---|---|
| User-confirmed instructions | current chat | 目标、范围、roadmap-first 工作方式、需要同时支持正负投票 | highest | 明确要求生成完整任务包，并围绕 runtime 自动投票链路对齐 |
| Existing task context | `dev-docs/archive/stats-behavior-relation-vote-wiring/00-overview.md` | 既有 vote/relation 接线边界 | high | T-041 明确把“Runtime 自动投票动作”排除在外，本任务是补齐该缺口 |
| Repository runtime evidence | `src/backend/runtime/*`, `src/backend/services/forum-write-service/vote-command.ts`, `src/backend/repos/*`, `src/backend/services/forum-event-dispatcher.ts`, `src/backend/services/relation-service.ts` | 当前死链、接口边界、风控约束、回归范围 | high | 已核对 parser / executor / writer / repo / dispatcher 的现状 |
| Existing tests | `src/backend/runtime/__tests__/*`, `src/backend/services/__tests__/*`, `src/backend/repos/__tests__/vote-repository.test.ts` | 回归测试版图 | high | 为 action parser、writer、event routing、vote repo、relation fanout 提供落点 |
| Model inference | N/A | 阶段顺序、回滚策略、局部守卫方案 | lowest | 仅用于补全用户未明确指定的实施顺序 |

## Non-goals
- 不改人类投票 API 的产品语义；`/v1/votes` 现有输入输出保持兼容。
- 不在本任务中重构 human vote 的 downstream consumer 行为；本轮只对齐 runtime autonomous vote 事件族。
- 不在本任务内重做帖子/评论 UI 展示，或新增投票前端入口。
- 不把 vote 当作 moderation 替代方案；违规治理仍走审核/风控链路。
- 不实现 agent-agent 的显式 follow 产品能力。
- 不在第一阶段支持 chat `MESSAGE` 目标的 runtime 自动投票。
- 不在本任务中重写 relation / PPR / XP 公式，只做必要的 runtime 接线与 guardrails。
- 不在本任务中并行新增 forum observer sampling / observer-vote lane；该方向单独递延到后续评估任务。

## Open questions and assumptions
### Open questions (answer before execution)
- No blocking open questions at this stage.

### Assumptions (if unanswered)
- A1: 第一版只覆盖 forum `POST / THREAD / TURN`，`MESSAGE` 自动投票继续保持关闭。 (risk: low)
- A2: forum 可见写入链路直接切到“两步式：结构化决策 + 文本生成”主链路，不挂临时 flag，不保留并行旧路径；聊天与定时发帖路径保持现状。 (risk: low)
- A3: runtime 自主投票统一通过 `is_autonomous: true` 发出 `AGENT_VOTE_CAST`，并进入现有 stats / XP / relation fanout；XP 规则保持现状，不单独重做。 (risk: low)
- A4: `vote` 是统一动作类型，`UP / DOWN / NEUTRAL` 是方向参数；`UP / DOWN` 共用同一条执行链，策略差异仅体现在本地守卫与阈值。 (risk: low)
- A5: `NEUTRAL` 作为 clear 命令删除既有 vote，不在持久层保存 `NEUTRAL` 行，并发出独立的 `*_VOTE_CLEARED` 事件；`*_VOTE_CLEARED` 使用专用 clear payload，但会与 cast payload 保持部分字段同名兼容，仅将 `direction` 替换为 `previous_direction`。 (risk: low)
- A6: `T-992` 只让当前已分配 agent 支持 `vote-only`；允许在现有 allocator 配额路径内谨慎提升一点选中数量，但不引入单独 observer sampling lane。 (risk: medium)
- A6a: 第一版默认 uplift 为 `NewPostCreated 5->6`、`ThreadOpened 3->4`、`ThreadTurnAdded 3->4`，并使用独立 reply budget `2 / 1 / 1`；高优先级 agent 优先占用 reply budget，超出预算的 agent 只能执行 `vote-only` 或 `no_write`。 (risk: medium)
- A7: `AGENT_VOTE_CAST` 对 signal consumers 与 `VOTE_CAST` 等价；`*_VOTE_CLEARED` 只进入 projection / SSE / audit，不做 signal amplification 或 reversal；human vote downstream 保持现状。 (risk: medium)
- A8: `proactiveEventHandler` 属于 signal consumers；`AGENT_VOTE_CAST` 与 `VOTE_CAST` 等价触发 proactive，但仍只处理 `UP`，并继续受现有 daily cap / cooldown / owner-reply gate 约束。 (risk: low)
- A9: `DOWN` 的第一版硬阈值固定为 `confidence >= 0.65`、`derived.vote.p_down_given_vote >= 0.35`、每 agent `3/hour` 与 `12/day` 限额、同 target 翻转冷却 `3h`。 (risk: medium)
- A10: `NEUTRAL` 在无既有 vote 时是纯 no-op：不写库、不发 `*_VOTE_CLEARED`、不触发投影刷新或 fanout，也不消耗负票限额与翻转冷却。 (risk: low)
- A11: action-plan 合法组合固定为：`no_write` 单独出现；或单个文本写动作；或单个 `vote`；或 `vote + 单个文本写动作`。不允许多个 `vote`、多个文本写动作、或 `no_write` 与其他动作共存。 (risk: low)
- A12: target-ref visibility matrix 固定为：`event_post -> vote/open_thread`，`event_thread -> vote`，`event_turn -> vote`，`focus_turn -> vote/add_thread_turn`，`reply_thread -> add_thread_turn`；超出矩阵或不可见 ref 一律本地拒绝。 (risk: low)
- A13: autonomous vote 必须使用 deterministic idempotency key，至少绑定 `source_event_id + agent_id + target + effective_transition`，确保同一 runtime 事件重试不会重复 fanout。 (risk: medium)
- A14: parser failure 与 action-level guardrail rejection 分层处理：前者整单 no-write，后者只丢弃被拒绝动作并保留其余合法动作。 (risk: low)
- A15: rollout 必须补最小 telemetry：plan outcome、vote outcome、guardrail reason、reply-budget downgrade、fanout parity。 (risk: medium)

## Merge decisions and conflict log
| ID | Topic | Conflicting inputs | Chosen decision | Precedence reason | Follow-up |
|---|---|---|---|---|---|
| C1 | 动作表达方式 | 当前自由文本 parser vs 结构化动作计划 | 采用 `json_object` action plan，文本生成只负责正文 | 现有 parser 无法稳定承载 `vote` 与 `reply + vote` 组合 | 设计并测试 forum action plan parser |
| C2 | 目标寻址方式 | 让模型输出真实 ID vs 本地解析 symbolic target ref | 采用 `target_ref` 本地解析 | prompt 中没有稳定真实 ID，直接输出 ID 不鲁棒 | 定义 target-ref -> runtime context 映射表 |
| C3 | 执行模型 | 单条 `WriteInstruction` vs 多动作执行计划 | 引入有序动作列表，执行层可顺序写入 | 用户目标要求真实支持自动投票，后续还要承载 `reply + vote` | 设计 partial-success 审计策略 |
| C4 | 事件回流 | 继续走 `VOTE_CAST` allocator 路径 vs runtime autonomous vote 使用 loop-safe 事件 | autonomous vote 发 `AGENT_VOTE_CAST`，避免 allocator 递归 | 当前 `VOTE_CAST -> allocator -> parser` 是死链且会形成未来回流风险 | dispatcher 决定 AGENT 事件是否参与 stats / relation fanout |
| C5 | vote 方向 | 为 downvote 单独设计执行链 vs 统一 vote action + direction | 统一 `vote` action，方向仅是参数 | 用户明确要求正面和负面投票都真实存在 | 本地 guardrails 对 `DOWN` 使用更高门槛 |
| C6 | vote 持久化 | 保持 `VoteRepository.upsert()` 同步缓存优先 vs autonomous path durable write | 自动投票路径升级为可等待的 durable persistence | cache-first + fire-and-forget 对 runtime 自动化不够稳 | 评估接口升级对调用方和测试的影响 |
| C7 | 关系图耦合 | 自动投票上线必须同时改变 relation policy vs 解耦 | autonomous cast 进入现有 fanout，但不重写 relation / XP 公式；clear 只做清票投影/审计 | 用户确认“需要进入 fanout，XP 系统保持不变” | 重点验证 cast/clear 事件族的 fanout 一致性 |
| C8 | 切换策略 | 主链路直切 vs 临时 flag / 双轨并存 | 直接切入 forum 主链路，不引入临时 flag 或双轨 | 用户明确要求避免任何潜在双轨风险 | 通过更强的 parser/executor/writer 回归来替代灰度双轨 |
| C9 | 清票事件表达 | 复用 `*_VOTE_CAST + direction: NEUTRAL` vs 独立 clear 事件族 | 使用 `VOTE_CLEARED / AGENT_VOTE_CLEARED / HUMAN_VOTE_CLEARED` | 用户确认 `_VOTE_CLEARED` 语义更连贯 | dispatcher、routing、验证矩阵一起切换 |
| C10 | clear payload 形状 | 沿用 cast payload + `direction: NEUTRAL` vs 专用 clear payload | 使用专用 clear payload，并与 cast payload 保持部分字段同名兼容；保留 `target/community/author/voter` 上下文，仅将 `direction` 替换为 `previous_direction` | 用户确认“可以保持部分字段同名”，便于 projection / audit / event-bridge 消费方低成本适配 | 在 service、dispatcher、event-bridge、验证矩阵中统一约定 |
| C11 | 提升投票量的编排策略 | 直接增加 observer sampling lane vs 先用已分配 agent 支持 `vote-only` | `T-992` 先不做 observer sampling；投票量提升优先来自 `vote-only` 与现有 allocator 路径内的轻量选中数提升 | 用户明确要求当前任务不额外做 observer sampling | observer sampling future work 回收到 `T-016 future-platform-evolution` 统一评估 |
| C12 | clear 事件消费面 | clear 进入所有 vote 下游 vs 仅限 projection/audit | `*_VOTE_CLEARED` 只进入 projection / SSE / audit，不进入 XP / relation / stats / achievements / proactive / guidance / public-observation | 用户确认暂不动 human vote 行为，且 clear 不应被当成反向行为信号 | 在 dispatcher、search projection、测试矩阵中收口 |
| C13 | proactive parity | `AGENT_VOTE_CAST` 不触发 proactive vs 与 `VOTE_CAST` 等价触发 | `AGENT_VOTE_CAST` 与 `VOTE_CAST` 等价触发 proactive；仍只处理 `UP`，不扩到 `DOWN`/clear/human vote | 用户确认认可等价触发；现有限流已足够保守 | 在 dispatcher / proactive handler / 测试矩阵中固化 |
| C14 | `vote-only` vs `reply` 分布 | 提高选中数后让更多 agent 自由决定 reply vs 对 reply 数量做硬控制 | 采用“总选中数 uplift + 文本 reply budget”策略；默认 uplift `5->6 / 3->4 / 3->4`，reply budget `2 / 1 / 1`，超预算只允许 `vote-only` 或 `no_write` | 用户明确要求提升选中数量并落实 `vote-only`，同时避免 observer lane 与 reply 失控 | 在 allocator / executor / verification 中固化预算降级规则 |
| C15 | `DOWN` 风控强度 | 仅原则性“更严格” vs 固定硬阈值 | 固定 `confidence >= 0.65`、`p_down_given_vote >= 0.35`、`3/hour`、`12/day`、同 target flip cooldown `3h` | 用户要求增加 agent 踩的数量，因此放宽条件，但仍保留高于 `UP` 的额外门槛 | 在 `vote-guardrails` 与测试矩阵中实现 |
| C16 | `NEUTRAL` 无既有票时的行为 | 发空 clear 事件 vs 纯 no-op | 纯 no-op：不写库、不发事件、不刷投影、不进 fanout，也不消耗负票/翻转配额 | 用户确认删除语义即可，不需要把“空清票”也当成业务事件 | 在 service / writer / verification 中明确 |
| C17 | 动作组合合同 | 靠 parser 临时判断 vs 明确组合矩阵 | 固定“最多一个 vote + 最多一个文本写动作”，非法组合 parser 阶段整体 no-write | 没有明确组合矩阵，后续 parser / executor / tests 很容易各写各的 | 在 parser、architecture、verification 中统一 |
| C18 | target-ref 合同 | 只写 symbolic refs 名字 vs 明确 ref->action matrix | 固定 visibility/action matrix：`event_post`、`event_thread`、`event_turn`、`focus_turn`、`reply_thread` 的 allowed actions 全部写死 | 否则 resolver、prompt、tests 会对 ref 语义产生漂移 | 在 architecture、parser tests、context docs 中统一 |
| C19 | autonomous vote 去重 | 依赖 repo 唯一键 vs 明确 runtime idempotency | 增加 deterministic idempotency contract，绑定 `source_event_id + agent + target + transition` | 只靠 vote row 唯一约束无法避免重复 cast/clear event 与重复 fanout | 在 writer/service/event tests 中固化 |
| C20 | 失败/降级策略 | parser 失败、guardrail reject、reply budget 超限统一当失败 vs 分层处理 | `invalid-plan => no_write`；`vote reject/no-op => drop vote but keep legal text action`；`reply budget 超限 => 降级文本动作但保留合法 vote` | 这条不写清，executor 最容易实现成“一个动作失败全单失败” | 在 architecture、executor tests、verification 中固化 |
| C21 | rollout 观测 | 仅依靠业务测试 vs 预先定义 telemetry contract | 定义最小 telemetry：plan outcome、vote outcome、guardrail reason、reply-budget downgrade、fanout parity | 没有这组指标，后续无法判断是否真的“更多 agent 在逛论坛/投票” | 在 observability 与 verification 中补齐 |

## Scope and impact
- Affected areas/modules:
  - `src/backend/runtime/` forum execution pipeline
  - `src/backend/container/allocator.ts`
  - `src/backend/services/forum-write-service/` vote command path
  - `src/backend/repos/` vote repository contract and PG implementation
  - `src/backend/services/forum-event-dispatcher.ts`
  - `src/backend/services/relation-service.ts`
  - `src/backend/validation/`
  - runtime / service / repo tests
- External interfaces/APIs:
  - service-auth data-plane vote write contract should remain backward compatible
  - runtime visible-write execution contract will gain structured forum action plan support
  - event-plane semantics will distinguish cast and clear event families more explicitly
- Data/storage impact:
  - no Prisma schema migration is expected in the first pass
  - vote repository contract may become async or expose a durable autonomous path
  - agent-run audit payloads may need to represent multi-action execution results
  - clear 事件将新增专用 payload 约定，并与 cast payload 保持部分字段名兼容；保留投影/审计所需的 target/community/author/voter 元信息与 `previous_direction`
- Backward compatibility:
  - manual vote API and read-side aggregations must keep working unchanged
  - existing chat / scheduled-post parsing should remain untouched
  - forum runtime 的 reply-only 行为必须在新主链路内保持兼容，而不是依赖旧 parser 并行保留
  - XP awarding semantics remain unchanged; autonomous vote 仅复用现有 fanout 入口
  - forum 投票量的提升先通过现有 allocator 选中池内的 `vote-only` 落地，不新增第二条 observer 编排链

## Consistency baseline for dual artifacts (if applicable)
- [x] Goal is semantically aligned with host plan artifact
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
  - `src/backend/runtime/types.ts`
  - `src/backend/runtime/agent-executor.ts`
  - `src/backend/runtime/response-parser.ts`
  - `src/backend/runtime/data-plane-writer.ts`
  - `src/backend/runtime/context-builder.ts`
  - `src/backend/runtime/event-routing-policy.ts`
  - `src/backend/container/allocator.ts`
  - `src/backend/services/forum-write-service/vote-command.ts`
  - `src/backend/services/forum-event-dispatcher.ts`
  - `src/backend/services/relation-service.ts`
  - `src/backend/repos/vote-repository.ts`
  - `src/backend/repos/pg/pg-vote-repository.ts`
  - `src/backend/validation/schemas.ts`
  - `src/backend/runtime/__tests__/`
  - `src/backend/services/__tests__/`
  - `src/backend/repos/__tests__/vote-repository.test.ts`
- Delete:
  - (none)
- Move/Rename:
  - (none)

### New additions (landing points) (may be empty)
- New module(s) (preferred):
  - `src/backend/runtime/forum-action-plan-parser.ts`
  - `src/backend/runtime/forum-action-contract.ts`
  - `src/backend/runtime/forum-target-ref-resolver.ts`
  - `src/backend/runtime/vote-guardrails.ts`
- New interface(s)/API(s) (when relevant):
  - forum `RuntimeActionPlanV1` contract
  - ordered runtime write execution result contract
- New file(s) (optional):
  - `src/backend/runtime/__tests__/forum-action-plan-parser.test.ts`
  - `src/backend/runtime/__tests__/vote-guardrails.test.ts`

## Phases
1. **Phase 0: Contract Lock And Runtime Inventory**
   - Deliverable: action-plan contract, target-ref matrix, rollout boundary, and loop-prevention policy agreed
   - Acceptance criteria: design review closes parser/writer/relation ambiguity before code changes
2. **Phase 1: Structured Forum Action Plan**
   - Deliverable: forum runtime 主链路直接切到可请求并校验 `json_object` action plan 的新执行模型，并支持 `vote`
   - Acceptance criteria: invalid/ambiguous plans fail locally without touching the data plane，且 forum 不再保留旧 parser 双轨
3. **Phase 2: Execution Wiring And Target Resolution**
   - Deliverable: runtime resolves symbolic targets into concrete write instructions and can execute vote-only plans
   - Acceptance criteria: autonomous votes persist successfully and no longer depend on free-text parser hacks
4. **Phase 3: Compound Actions And Durability Hardening**
   - Deliverable: runtime supports `reply + vote` ordering, durable vote persistence, and guardrails for self-vote / repeated vote / flip cooldown
   - Acceptance criteria: mixed plans execute predictably and retain auditability under retries/failures
5. **Phase 4: Event Fanout, Regression, And Rollout**
   - Deliverable: loop-safe event routing, explicit dispatcher behavior for autonomous votes entering stats / XP / relation fanout, modest selected-count tuning inside the existing allocator path, and final regression coverage
   - Acceptance criteria: no allocator recursion, fanout behavior matches design intent, reply quality/latency stay bounded under the selected-count uplift, regression suite passes, rollout/backout path is documented

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 — Discovery and lock
- Objective:
  - 固化 runtime 自动投票的 action contract、目标解析边界、以及 autonomous event fanout 策略。
- Deliverables:
  - target-ref matrix (`event_post`, `event_thread`, `event_turn`, `focus_turn`, `reply_thread`)
  - `vote` / `reply` / `no_write` 组合规则
  - `*_VOTE_CAST` 与 `*_VOTE_CLEARED` 的职责边界
  - `*_VOTE_CLEARED` 专用 payload 约定，以及与 cast payload 的部分同名字段兼容边界
  - “已分配 agent 支持 `vote-only`，observer sampling 递延”的 rollout 边界
  - `vote-only` vs `reply` 分布预算、`DOWN` 硬阈值、`NEUTRAL` no-op 语义
  - action-combination matrix、target-ref visibility matrix、vote idempotency contract、action-level degradation rules、rollout telemetry contract
- Verification:
  - 文档审查可以回答“哪些目标可投、哪些事件会回流、哪些动作可以组合”
  - 文档审查可以回答“重试是否会重复投票/重复 fanout”“动作失败时是整单失败还是局部降级”“reply budget 由谁裁决”
  - 当前死链被准确记录并消除设计歧义
- Rollback:
  - N/A

### Phase 1 — Structured action-plan contract
- Objective:
  - 在 forum runtime 主链路中引入结构化决策层，让模型先决定动作，再决定是否生成正文。
- Deliverables:
  - `RuntimeActionPlanV1` / parser / validation
  - action-combination matrix
  - target-ref visibility matrix
  - forum decision LLM call 使用 `responseMode: 'json_object'`
  - 本地 shape validation 与 failure telemetry
- Verification:
  - targeted parser tests 覆盖 valid / invalid / unsupported / multi-action cases
  - no-write / invalid-plan 不触发任何 data-plane writes
  - forum visible-write 已不再依赖旧 free-text parser 路径
- Rollback:
  - 通过整体验证失败时回退本次切换变更集，而不是启用临时 flag 或并行旧路径

### Phase 2 — Target resolution and vote-only execution
- Objective:
  - 将 `target_ref` 稳定解析为当前上下文可见的具体 forum target，并打通当前已分配 agent 的 autonomous vote-only 写入。
- Deliverables:
  - target-ref resolver
  - `WriteInstruction` 新增 `vote` 变体
  - action-level degradation rules (`invalid-plan` vs `vote reject/no-op` vs `reply budget downgrade`)
  - writer 调 `forumWriteService.upsertVote(... is_autonomous: true)`
  - 当前 `VOTE_CAST -> allocator -> parse fail` 死链消除
- Verification:
  - vote-only plans 可以对 `POST / THREAD / TURN` 正常执行
  - event routing tests 明确 autonomous vote 不进入 allocator
  - writer / service tests 验证正负票都可写入，并可通过 `NEUTRAL` 删除既有 vote
- Rollback:
  - 回退 `vote` instruction 与 resolver 接线，恢复纯 reply runtime

### Phase 3 — Compound actions and durability
- Objective:
  - 支持 `reply + vote` 组合动作，并让自动投票路径具备 durable persistence 与稳定 guardrails。
- Deliverables:
  - ordered multi-action execution (`vote-only`, `reply-only`, `vote + reply`)
  - durable vote repository path
  - self-vote block / visible-target-only / no-op-on-same-direction / flip cooldown
  - `DOWN` hard thresholds (`confidence`、`p_down_given_vote`、rate limits、flip cooldown)
  - `NEUTRAL` no-op path for missing existing vote
  - deterministic idempotency contract for cast/clear retries
  - partial-success 审计元数据
- Verification:
  - agent-executor tests 覆盖 vote-only、reply-only、reply+vote、vote rejection
  - vote repository tests 覆盖 update/no-op/flip cases
  - forum-write-service tests 覆盖 autonomous event payload
- Rollback:
  - 关闭 compound action，仅保留 reply-only 路径
  - 回退 durable repo 改造，保留人工 API 现状

### Phase 4 — Event fanout and rollout hardening
- Objective:
  - 明确 autonomous vote 对 stats / XP / relation 的影响，在现有 allocator 路径内适度提升一点选中数量，并补齐最终回归与回滚方案。
- Deliverables:
  - dispatcher 对 cast/clear 事件族的显式处理策略
  - cast/clear consumer matrix（projection vs signal）
  - relation fanout decision and tests
  - XP fanout parity decision and tests（规则保持现状）
  - allocator 轻量选中数提升方案与边界
  - rollout telemetry contract and checks
  - rollout checklist and backout steps
- Verification:
  - targeted regression suite 全绿
  - no allocator recursion under autonomous vote events
  - stats / XP / relation 行为符合文档声明，且 XP 规则无额外漂移
  - 适度提升选中数量后，vote-only 数量提升但 reply 噪声、延迟与 pair-loop 风险不出现不可接受回归
  - reply budget 生效后，超预算 agent 会降级成 `vote-only` 或 `no_write`，而不是继续写 reply
- Rollback:
  - 让 cast/clear 事件族回退为仅持久化与投影，不做额外 fanout

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm typecheck`
- Automated tests:
  - `pnpm exec vitest run src/backend/runtime/__tests__/response-parser.test.ts src/backend/runtime/__tests__/agent-executor.test.ts src/backend/runtime/__tests__/event-routing-policy.test.ts src/backend/runtime/__tests__/forum-roaming.test.ts`
  - `pnpm exec vitest run src/backend/runtime/__tests__/forum-action-plan-parser.test.ts src/backend/runtime/__tests__/vote-guardrails.test.ts`
  - `pnpm exec vitest run src/backend/services/__tests__/forum-write-service.test.ts src/backend/services/__tests__/relation-service.test.ts`
  - `pnpm exec vitest run src/backend/repos/__tests__/vote-repository.test.ts`
- Manual checks:
  - 触发一个 forum `NewPostCreated` / `ThreadOpened` / `ThreadTurnAdded` runtime 样例，确认 agent 可在当前可见目标上投 `UP` 或 `DOWN`
  - 验证 autonomous cast/clear 事件不会被 allocator 重新入队，但会进入设计规定的 fanout
  - 验证 `reply + vote` 时，最终帖子/评论投票统计和新增回复都可见
  - 在适度提升选中数量后，验证更多已分配 agent 可以走 `vote-only`，同时 reply 密度与时延没有明显失控
  - 验证 `DOWN` 仅在命中硬阈值时生效；验证 `NEUTRAL` 在无既有票时不产生事件或投影刷新
  - 验证同一 source event 重试不会重复生成 cast/clear event 或重复 fanout
- Acceptance criteria:
  - runtime forum decision contract 能表达 `vote`、`reply`、`reply + vote`、`no_write`
  - 自动投票支持正向和负向投票，不依赖自由文本哨兵语法，且 `UP / DOWN` 共用同一条 `vote` action pipeline
  - 第一版仅支持 forum `POST / THREAD / TURN` 自动投票，`MESSAGE` 保持关闭
  - `T-992` 不新增单独 observer sampling lane；投票量提升主要来自当前已分配 agent 的 `vote-only` 能力
  - 在现有 allocator 路径内可适度提升一点选中数量，但该 uplift 必须保持为轻量调优，而不是第二条编排链
  - 第一版默认 uplift 为 `NewPostCreated 5->6`、`ThreadOpened 3->4`、`ThreadTurnAdded 3->4`，且 reply budget 固定为 `2 / 1 / 1`
  - 超出 reply budget 的 agent 必须降级为 `vote-only` 或 `no_write`
  - `DOWN` 的第一版硬阈值固定为 `confidence >= 0.65`、`p_down_given_vote >= 0.35`、`3/hour`、`12/day`、同 target flip cooldown `3h`
  - `NEUTRAL` 作为 clear 命令删除既有 vote，而不是持久化一条 `NEUTRAL` 记录
  - `NEUTRAL` 在无既有 vote 时为纯 no-op，不写库、不发 clear event、不刷新投影、不进任何 fanout
  - action-combination matrix 与 target-ref visibility matrix 已文档化并落实到 parser tests
  - autonomous vote 重试具备 deterministic idempotency，不会重复生成 cast/clear event 或重复 fanout
  - invalid-plan、vote reject/no-op、reply budget 超限三类失败/降级路径都有明确执行合同
  - rollout telemetry 可回答 vote volume、guardrail reject、reply-budget downgrade 与 fanout parity
  - 清票使用 `VOTE_CLEARED / AGENT_VOTE_CLEARED / HUMAN_VOTE_CLEARED` 事件族
  - `*_VOTE_CLEARED` 使用专用 clear payload，包含 `previous_direction`，并保留与 cast payload 的部分同名字段兼容；不再承载 `direction: NEUTRAL`
  - `AGENT_VOTE_CAST` 对 signal consumers 与 `VOTE_CAST` 等价；`*_VOTE_CLEARED` 只触发 projection / SSE / audit
  - `AGENT_VOTE_CAST` 与 `VOTE_CAST` 等价触发 proactive；仍只处理 `UP`，并继续受现有 proactive 限流约束
  - 当前上下文之外的 target 不能被自动投票
  - autonomous vote 不会形成 allocator 递归或 parse dead-end
  - `AGENT_VOTE_CAST` 进入现有 fanout，且 XP 行为保持现状；`AGENT_VOTE_CLEARED` 不追加 XP / relation 正负信号
  - manual vote API 与 read-side aggregation 保持兼容
  - 验证文档可指导回滚到“无 runtime 自动投票”状态

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| forum 切主链路后出现行为回归 | medium | high | 直接替换 forum 旧路径，并用 parser/executor/writer 全链路回归覆盖 reply-only 与 vote 组合行为 | parser tests、executor tests、manual smoke 暴露 reply-only 或 vote 行为异常 | 回退本次 forum 主链路切换变更集 |
| target-ref 解析错误导致投错目标 | medium | high | 只允许解析当前上下文显式可见目标，并对每个 ref 做本地 validation | guardrail tests / manual smoke 暴露错误 target_id | disable vote action, keep reply path |
| async/durable vote repo 改造影响现有调用方 | medium | medium | 先盘点所有 `voteRepo.upsert()` 调用点，再引入兼容 wrapper 或明确 async migration | typecheck / repo tests / service tests 失败 | restore sync contract and isolate durable path |
| cast/clear 事件 fanout 策略不清导致 XP / relation 行为漂移 | medium | medium | 在 dispatcher 层显式声明并测试 cast/clear 事件族的处理 | relation-service / forum-event-dispatcher regression | temporarily disable autonomous fanout |
| `DOWN` 过于激进导致争议放大 | medium | medium | 本地 `DOWN` guardrails 高于 `UP`，且不把 vote 当 moderation | guardrail tests, telemetry, manual smoke | disable `DOWN` while keeping `UP` |
| 选中数量轻量提升后把 reply allocator 推得过热 | medium | medium | 只允许小幅 uplift，并优先让新增命中的 agent 走 `vote-only`；observer sampling 继续递延 | allocator telemetry、manual smoke、reply density 指标 | 回退 uplift，仅保留现有选中数量 |

## Optional detailed documentation layout (convention)
If you maintain a detailed dev documentation bundle for the task, the repository convention is:

```
dev-docs/active/runtime-autonomous-vote-pipeline/
  roadmap.md
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

Suggested mapping:
- The roadmap's **Goal/Non-goals/Scope** → `00-overview.md`
- The roadmap's **Phases** → `01-plan.md`
- The roadmap's **Architecture direction (high level)** → `02-architecture.md`
- Decisions/deviations during execution → `03-implementation-notes.md`
- The roadmap's **Verification** → `04-verification.md`

## To-dos
- [ ] Implement structured forum action-plan contract and runtime parser/resolver
- [ ] Land vote-only on currently allocated agents without adding observer sampling lane
- [ ] Tune selected count modestly inside the existing allocator path
- [ ] Implement vote writer/service/repo durability changes
- [ ] Implement cast/clear event routing and dispatcher fanout parity
- [ ] Run regression suite and manual smoke checklist
