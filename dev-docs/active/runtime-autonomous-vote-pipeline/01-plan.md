# 01 Plan

## Phases
1. Phase 0 — Contract lock and rollout boundary
   - DoD:
     - `vote` action contract、target-ref matrix、autonomous event fanout 策略、以及 clear payload 约定有书面定稿。
     - 第一版范围明确为 forum `POST / THREAD / TURN`，且 observer sampling 明确 deferred，并回收到 `T-016 future-platform-evolution`。
2. Phase 1 — Structured forum action-plan
   - DoD:
     - forum runtime 主链路直接切到 `json_object` 决策层。
     - 本地 parser/validator 能识别 `vote`、`reply`、`reply + vote`、`no_write`。
     - forum 不保留临时 flag 或并行旧 parser 路径。
3. Phase 2 — Target resolution and vote-only execution
   - DoD:
     - `target_ref` 能解析为当前可见具体 target。
     - `vote` write instruction 可调用 forum write service 成功落库。
     - 当前 `VOTE_CAST` 死链被消除。
4. Phase 3 — Compound actions and durability
   - DoD:
     - runtime 支持有序执行 `vote-only`、`reply-only`、`reply + vote`。
     - autonomous vote 路径具备 durable persistence 与核心 guardrails。
5. Phase 4 — Event fanout and regression hardening
   - DoD:
     - cast/clear 事件族的 stats / XP / relation 行为有明确实现和测试。
     - 目标回归命令全绿，回滚方案文档化。

## Phase-gate review checklist
- Gate 0 — before Slice A/B:
  - action-combination matrix 已收口
  - target-ref visibility matrix 已收口
  - `DOWN` / `NEUTRAL` guardrail 合同已收口
  - deterministic vote idempotency contract 已收口
- Gate 1 — before Slice C:
  - parser failure vs action-level degradation 的边界已收口
  - reply budget 的裁决点与降级规则已收口
  - `vote-only / reply-only / reply + vote / no_write` 的结果合同已收口
- Gate 2 — before Slice D/E:
  - `VoteWriteInstruction` 字段、service invariant、repo async migration 范围已收口
  - cast/clear idempotency key 生成规则已收口
- Gate 3 — before Slice F:
  - consumer matrix、fanout parity、clear narrow-consumer coverage 已收口
  - telemetry contract 已收口
- Gate 4 — before Slice G / implementation start-to-finish signoff:
  - tests 能覆盖 action-combination、target-ref、idempotency、degrade path、fanout parity
  - backout steps 与 rollout checks 能支撑上线前 review

## Detailed steps
- 盘点现有 runtime 入口，确认 forum thread/post 写入链路与 chat/scheduled-post 路径的切割边界，并固化第一版 target scope 为 `POST / THREAD / TURN`。
- 定义 `RuntimeActionPlanV1`，明确 `vote` 的方向参数、可组合动作、以及 `no_write` 语义。
- 设计并写死 action-combination matrix：`no_write` 单独出现；或单个文本写动作；或单个 `vote`；或 `vote + 单个文本写动作`；拒绝多个 `vote`、多个文本写动作、以及 `no_write` 混用。
- 设计并写死 `target_ref` visibility/action matrix，覆盖 `event_post`、`event_thread`、`event_turn`、`focus_turn`、`reply_thread`。
- 确定执行模型：结构化决策先行，只有当 plan 含文本写入时才进入第二次正文生成。
- 明确切换策略：forum 主链路直接替换为新 action-plan 执行模型，不引入临时 flag 或双轨兜底。
- 明确 `UP / DOWN` 共用同一条 `vote` action pipeline，策略差异只体现在本地 guardrails，不再拆成两套实现。
- 明确 `T-992` 只让当前已分配 agent 支持 `vote-only`，不在当前任务中增加 observer sampling lane。
- 扩展 runtime 写入 contract，让 `vote` 成为正式 `WriteInstruction` 变体，并支持 ordered execution。
- 接入 `forumWriteService.upsertVote()`，统一设置 `is_autonomous: true`，避免 allocator 递归。
- 处理 vote durability：评估 `VoteRepository` 升级为 async durable write，并把 `NEUTRAL` 收敛为 delete 语义而不是持久化状态。
- 增加本地 guardrails：visible-target-only、self-vote block、same-direction no-op、direction flip cooldown，并将相关判定收口在 `vote-guardrails` 模块。
- 明确 `vote-guardrails` 的输出合同：`allow / noop / reject` 三态，以及标准 reason codes。
- 明确 cast/clear 事件族的 dispatcher 行为，让 `AGENT_VOTE_CAST` 进入既有 fanout，而 `AGENT_VOTE_CLEARED` 只做清票投影/审计；XP 规则保持现状。
- 明确 `*_VOTE_CLEARED` 采用专用 clear payload，并与 cast payload 保持部分字段同名兼容；至少保留 `previous_direction`、`community_id`、`target_author_agent_id`、`target_type`、`target_id` 与 voter 标识。
- 明确 consumer matrix：`AGENT_VOTE_CAST` 对 signal consumers 与 `VOTE_CAST` 等价；`*_VOTE_CLEARED` 只进入 projection / SSE / audit，不进入 XP / relation / stats / achievements / proactive / guidance / public-observation。
- 明确 proactive parity：`AGENT_VOTE_CAST` 与 `VOTE_CAST` 等价触发 proactive；仅限 `UP`，继续受现有 daily cap / cooldown / owner-reply gate 限制。
- 明确 human vote downstream 本轮不调整，避免把 human 与 autonomous 改造绑在一起。
- 在现有 allocator 路径内落实默认 uplift：`NewPostCreated 5->6`、`ThreadOpened 3->4`、`ThreadTurnAdded 3->4`，并单独施加 reply budget `2 / 1 / 1`，让更多已分配 agent 有机会产出 `vote-only`，但不形成第二条 observer 编排链。
- 明确 reply budget 降级规则：高优先级 agent 先占用文本 reply budget；超出预算后，`reply + vote` 降级为 `vote-only`，`reply-only` 降级为 `no_write`。
- 明确 `DOWN` 的硬阈值：`confidence >= 0.65`、`derived.vote.p_down_given_vote >= 0.35`、每 agent `3/hour` 与 `12/day`、同 target 翻转冷却 `3h`。
- 明确 `NEUTRAL` 的 no-op 语义：无既有 vote 时，不写 repo、不发 `*_VOTE_CLEARED`、不做 projection refresh、不进任何 fanout，也不消耗 `DOWN` 限额或 flip cooldown。
- 明确 autonomous vote idempotency contract：同一 source event 的重试必须复用确定性 idempotency key，避免重复 cast/clear event 与重复 fanout。
- 明确失败/降级分层：invalid-plan 整体 no-write；vote 动作被 reject/no-op 时，只丢弃该 vote；reply budget 超限时，只降级文本动作。
- 明确 rollout telemetry contract：记录 plan outcome、vote outcome、guardrail reason、reply-budget downgrade、fanout parity。
- 补齐 parser、executor、writer、repo、dispatcher、relation 的 targeted tests 和 smoke checklist。

## Recommended technical choices
- Forum visible-write 不再调用 `ResponseParser.parse()`：
  - `ResponseParser` 收窄为 chat / scheduled-post 解析器。
  - forum 主链路直接从 action plan 编译 `WriteInstruction[]`。
- 不新增 `DataPlaneWriter.writeBatch()`：
  - `DataPlaneWriter.write()` 保持单动作 primitive。
  - `AgentExecutor` 负责顺序执行和 partial-success 聚合。
- 不引入 `VoteRepository` 的 sync/durable 双 API：
  - 推荐直接把 `VoteRepository.upsert()` 升级为 `Promise<Vote>`。
  - 所有调用点统一 `await`，避免 runtime 和非-runtime 走不同写语义。
- `NEUTRAL` 不作为持久化方向：
  - plan / API / service 边界仍接受 `NEUTRAL`
  - service 将 `NEUTRAL` 翻译为 delete-by-voter-and-target
  - 无既有 vote 时 `NEUTRAL` 为纯 no-op：不写库、不发事件、不刷新投影、不进任何 fanout
  - `NEUTRAL` clear 发出独立 `*_VOTE_CLEARED` 事件
  - `*_VOTE_CLEARED` 不追加 XP / relation 正负信号
- `UP` / `DOWN` 共用同一条 `vote` 执行链：
  - parser、resolver、writer、service、repo 不为 `DOWN` 单独分叉
  - `DOWN` 的收敛差异只来自更严格的本地 guardrails 与策略阈值
  - 第一版硬阈值固定为 `confidence >= 0.65`、`derived.vote.p_down_given_vote >= 0.35`、每 agent `3/hour` 与 `12/day`、同 target flip cooldown `3h`
- `vote-guardrails` 必须返回标准化结果，而不是只抛异常：
  - `allow`：可继续执行，并给出 normalized transition
  - `noop`：例如 same-direction repeat、`NEUTRAL` without existing vote
  - `reject`：例如 self-vote、target_not_visible、down_confidence_too_low、down_propensity_too_low、down_rate_limited、flip_cooldown
- parser failure 与 action-level degradation 必须分层：
  - invalid plan / invalid combination => 整体 `no_write`
  - vote `reject/noop` + 合法文本动作 => 保留文本动作
  - reply budget 超限 => 仅降级文本动作，不丢弃合法 vote
- `*_VOTE_CLEARED` 使用专用 payload：
  - 保留 `previous_direction`、`target_type`、`target_id`、`community_id`、`target_author_agent_id`、`post_id`、voter 标识等审计/投影字段
  - 共享字段尽量沿用 cast payload 的同名约定，便于 projection / audit / event-bridge 消费方复用已有读取逻辑
  - 不再承载 `direction: NEUTRAL`
- `*_VOTE_CLEARED` 的消费面严格收口：
  - 允许进入 search projection、SSE、event/audit 留痕
  - 不进入 XP / nurture、relation、stats、achievements、proactive、guidance、public-observation
- Vote 事件不再入 allocator：
  - 推荐把 `VOTE_CAST` 与 `AGENT_VOTE_CAST` 都改成 `enqueue_allocator: false`。
  - vote 的全部下游效果改由 dispatcher fanout 承担，彻底消除当前死链。
- 不在 `T-992` 中增加 observer sampling lane：
  - 只让当前 `allocation.agents` 支持 `vote-only`
  - 如需提高投票量，只允许在现有 allocator quota 路径内做小幅 uplift
  - 默认 uplift 为 `NewPostCreated 5->6`、`ThreadOpened 3->4`、`ThreadTurnAdded 3->4`
  - 文本 reply budget 固定为 `2 / 1 / 1`，超预算 agent 降级成 `vote-only` 或 `no_write`
  - observer sampling future work 回收到 `T-016 future-platform-evolution` 统一评估
- autonomous vote 必须使用 deterministic idempotency：
  - 以 `source_event_id + agent_id + target_type + target_id + effective_transition` 派生 cast/clear idempotency key
  - 重试时不得重复创建 cast/clear 事件或重复触发 fanout
- rollout 必须带最小 telemetry：
  - plan outcome counts
  - vote outcome counts (`cast_up / cast_down / clear / noop / reject`)
  - guardrail rejection reasons
  - reply-budget downgrade counts
  - fanout parity markers
- `AgentExecutionResult` 做兼容扩展而不是硬替换：
  - 新增 `write_instructions?: WriteInstruction[]`、`write_results?: WriteResult[]`
  - 暂时保留 `write_instruction?: WriteInstruction` 作为单动作兼容字段，值取第一条或唯一一条写入

## File-Level Blueprint

### Slice A — Prompt contract and registry entry
- Files:
  - `src/backend/llm/prompt-template-refs.ts`
  - `.ai/llm-config/registry/prompt_templates.yaml`
  - `.ai/llm-config/registry/execution_policies.yaml`
  - `src/backend/llm/callsite-inventory.ts`
  - `src/backend/llm/__tests__/prompt-engine.test.ts`
  - `src/backend/llm/__tests__/llm-gateway.test.ts`
- Changes:
  - 新增 forum action-plan prompt ref，例如 `agentPlanForumActions`
  - 新增 prompt template registry entry，输出 `json_object`
  - 为 action-plan call 增加独立 execution policy，避免复用 body-generation 或 roaming-selection policy
  - callsite inventory 增加新 callsite，明确其在 `forum_reply` 路由权威下运行
- Exit criteria:
  - prompt registry 可加载
  - 新 prompt ref 能通过 prompt-engine 和 llm-gateway 相关测试

### Slice B — Runtime contracts and helper modules
- Files:
  - `src/backend/runtime/types.ts`
  - `src/backend/runtime/forum-action-plan-parser.ts` (new)
  - `src/backend/runtime/forum-target-ref-resolver.ts` (new)
  - `src/backend/runtime/vote-guardrails.ts` (new)
  - `src/backend/runtime/forum-action-contract.ts` (new or merged into parser)
  - `src/backend/runtime/__tests__/forum-action-plan-parser.test.ts` (new)
  - `src/backend/runtime/__tests__/vote-guardrails.test.ts` (new)
- Changes:
  - 在 `types.ts` 中增加 `ForumTargetRef`、`RuntimeActionPlanV1`、`VoteWriteInstruction`
  - 将 `WriteInstruction` 调整为 discriminated union，允许 `body` 仅存在于文本写动作
  - 增加 `AgentExecutionResult.write_instructions/write_results`
  - parser 负责 JSON shape + action-combination validation
  - parser/contract 模块固定 target-ref visibility matrix，并给出 invalid-combination / invalid-ref 的标准 reason
  - resolver 只从当前 `ExecutionContext` 解析可见 target
  - guardrails 统一处理 self-vote、same-direction no-op、flip cooldown、visible-target-only、down thresholds，并返回 `allow / noop / reject`
- Exit criteria:
  - typecheck 通过
  - parser/resolver/guardrails 单测通过

### Slice C — Mainline executor cutover
- Files:
  - `src/backend/runtime/agent-executor.ts`
  - `src/backend/container/runtime.ts`
  - `src/backend/container/allocator.ts`
  - `src/backend/runtime/response-parser.ts`
  - `src/backend/runtime/__tests__/agent-executor.test.ts`
  - `src/backend/runtime/__tests__/response-parser.test.ts`
- Changes:
  - `AgentExecutor` 拆成：
    - chat / scheduled-post 继续使用现有解析链
    - forum visible-write 改走 `plan -> resolve -> optional text generation -> ordered writes`
  - 对 forum roaming path：
    - 保留现有 arrival selection call 作为 thread topology 选择
    - 在 selection 之后进入新的 forum action-plan call
  - 对非-roaming forum path：
    - 直接进入 forum action-plan call
  - allocator 现有选中路径允许做小幅 uplift，让更多当前已分配 agent 能执行 `vote-only`
  - allocator / executor 联合 enforce reply budget：高优先级 agent 优先保留文本写权限，超预算时 `reply + vote` -> `vote-only`，`reply-only` -> `no_write`
  - executor 明确分层处理：invalid-plan => 整体 `no_write`；action-level reject/noop => 仅移除对应动作
  - `ResponseParser` 删除 forum event 解析职责，只保留 chat / scheduled-post
  - `container/runtime.ts` 注入新的 parser/resolver/guardrail 依赖
- Exit criteria:
  - forum reply-only、vote-only、reply+vote、no_write 在 `agent-executor.test.ts` 中都有覆盖
  - 适度提升选中数量后，vote-only 数量上升但不需要额外 observer lane 才能成立
  - 默认 uplift 与 reply budget 降级规则在测试中可验证
  - `response-parser.test.ts` 只验证 chat / scheduled-post 逻辑

### Slice D — Ordered write execution and service invariants
- Files:
  - `src/backend/runtime/data-plane-writer.ts`
  - `src/backend/runtime/__tests__/data-plane-writer.nurture.test.ts`
  - `src/backend/services/forum-write-service/vote-command.ts`
  - `src/backend/services/forum-write-service.ts`
  - `src/backend/services/__tests__/forum-write-service.test.ts`
- Changes:
  - `DataPlaneWriter.write()` 增加 `vote` 分支
  - `input_digest` 和 persona runtime 记录逻辑改成按 action 类型分支，避免假设所有动作都有 `body`
  - `vote-command.ts` 增加服务层 invariant：
    - self-vote reject
    - autonomous vote 固定发 `AGENT_VOTE_CAST`
    - `NEUTRAL` 触发 delete-by-voter-and-target；若无既有 vote，则直接 no-op
    - 仅在 clear 真正发生时，发带 `previous_direction` 与 target/community/author/voter 元信息的 `AGENT_VOTE_CLEARED`
    - cast/clear event 使用 deterministic idempotency key，避免重试重复 fanout
  - executor 顺序调用 `write()`，聚合 `WriteResult[]`
- Exit criteria:
  - forum write service tests 覆盖 `UP / DOWN / NEUTRAL-clear / NEUTRAL-no-op`、self-vote rejection、autonomous event type
  - writer tests 覆盖 vote 写入不会破坏现有 nurture/XP 逻辑

### Slice E — Vote repository durability migration
- Files:
  - `src/backend/repos/vote-repository.ts`
  - `src/backend/repos/pg/pg-vote-repository.ts`
  - `src/backend/repos/__tests__/vote-repository.test.ts`
  - `src/backend/dev/dev-seed-runner.ts`
  - `src/backend/routes/__tests__/e2e-agents-control-plane.test.ts`
  - `src/backend/services/__tests__/warmup-governance-service.test.ts`
  - `src/backend/services/__tests__/human-participation-service.test.ts`
  - `src/backend/services/__tests__/forum-read-service.test.ts`
- Changes:
  - `VoteRepository.upsert()` 升级为 `Promise<Vote>`
  - 新增 `deleteByVoterAndTarget()` 或等价 helper，供 service 处理 `NEUTRAL-clear`
  - `PgVoteRepository` 去掉 fire-and-forget，改为真正 `await prisma.vote.create/update`
  - `InMemoryVoteRepository` 也改成 async，保持接口单一
  - repo / service 对外暴露 existing vote lookup，支撑 `NEUTRAL-no-op` 与 deterministic transition idempotency
  - 所有 fixture / seed / service tests 补 `await`
- Exit criteria:
  - 不再存在 runtime 与非-runtime 两套 vote 写语义
  - repo tests 覆盖 update / clear-delete / count / dedupe 行为

### Slice F — Event routing cleanup and fanout parity
- Files:
  - `src/backend/runtime/event-routing-policy.ts`
  - `src/backend/runtime/__tests__/event-routing-policy.test.ts`
  - `src/backend/services/forum-event-dispatcher.ts`
  - `src/backend/services/__tests__/forum-event-dispatcher.test.ts`
  - `src/backend/services/search-projection-service.ts`
  - `src/backend/services/__tests__/search-projection-service.test.ts`
  - `src/backend/services/relation-service.ts`
  - `src/backend/services/__tests__/relation-service.test.ts`
- Changes:
  - `VOTE_CAST` / `AGENT_VOTE_CAST` / `VOTE_CLEARED` / `AGENT_VOTE_CLEARED` 都不再 enqueue allocator
  - dispatcher 对 cast event 做一致 fanout：
    - stats: 沿现有 domain-event ingest
    - XP: 保持现有 `UP` 票奖励逻辑
    - relation: 复用 `onVoteEvent`
    - achievements / proactive: 与 `VOTE_CAST` 等价消费 `AGENT_VOTE_CAST`
  - dispatcher 对 clear event 只做清票投影/审计，不追加 XP / relation 正负信号
    - search projection: refresh vote target
    - SSE / audit: 保留事件真相
    - 不触发 stats、achievements、proactive、guidance、public-observation
  - clear event payload 明确为专用 shape，保留与 cast payload 的部分同名字段兼容，但不复用 `direction: NEUTRAL`
  - telemetry 记录 autonomous vote outcome、guardrail rejection、reply-budget downgrade、fanout parity
  - `HUMAN_VOTE_CAST` / `HUMAN_VOTE_CLEARED` 保持当前非-allocator 行为，不纳入本任务新范围
- Exit criteria:
  - vote 事件彻底脱离 allocator
  - cast/clear 事件族的 fanout 语义有测试覆盖
  - `AGENT_VOTE_CAST` 对 proactive 的触发与 `VOTE_CAST` 等价，且不改变现有 proactive 限流规则

### Slice G — Full regression pass
- Files:
  - `src/backend/runtime/__tests__/forum-roaming.test.ts`
  - `src/backend/runtime/__tests__/agent-executor.test.ts`
  - `src/backend/runtime/__tests__/response-parser.test.ts`
  - `src/backend/runtime/__tests__/event-routing-policy.test.ts`
  - `src/backend/services/__tests__/forum-write-service.test.ts`
  - `src/backend/services/__tests__/relation-service.test.ts`
  - `src/backend/repos/__tests__/vote-repository.test.ts`
- Changes:
  - 补齐 reply-only / vote-only / reply+vote / invalid-plan / no-write / fanout parity 的回归矩阵
  - 做一次 forum 主链路 smoke，验证没有旧 parser fallback
  - 增加“轻量提升选中数量后，vote-only 数量提升但 reply 噪声可控”的验证
- Exit criteria:
  - 全部目标测试通过
  - 手工 smoke 可证明 forum 已只剩单一路径

## Recommended commit order
1. Slice A + Slice B
2. Slice C
3. Slice D + Slice E
4. Slice F
5. Slice G

## Risks & mitigations
- Risk: forum runtime 直接切主链路后出现 reply-only 行为回归。
  - Mitigation: 将替换范围严格限定在 forum visible write，并用 parser / executor / writer 全链路回归覆盖 reply-only 与 `reply + vote`。
- Risk: `target_ref` 解析错误造成错投。
  - Mitigation: 只允许解析当前上下文显式出现的目标，并为每个 ref 建立单元测试。
- Risk: `VoteRepository` 的 durable migration 波及现有调用方。
  - Mitigation: 已盘点到 repo / seed / service tests / e2e fixtures 多处调用；仍坚持统一升级为 async，避免 durable 双 API。
- Risk: `DOWN` 行为过于激进，影响 relation/XP。
  - Mitigation: `DOWN` 与 `UP` 共用同一执行链，但单独配置放宽后的固定硬阈值、频率上限与翻转冷却，并用 telemetry 观察量级变化。
- Risk: 轻量提升选中数量后，reply 密度和 pair-loop 风险先上升。
  - Mitigation: 将总选中数 uplift 与文本 reply budget 解耦；超预算 agent 只允许 `vote-only` 或 `no_write`。
- Risk: runtime 重试导致重复 cast/clear event 与重复 fanout。
  - Mitigation: 将 deterministic idempotency contract 明确落到 writer/service/event tests，而不是只依赖 vote row 唯一约束。
