# 02 Architecture

## Core Decisions

- 首版机会源限定为 `NEW_TURN`、`DIRECT_CHALLENGE`、`AUDIENCE_SPIKE`、`REVIVE_OLD_BRANCH`、`OWNER_PULL`。
- allocator/runtime cutover 必须保留 compare/debug telemetry、cutover flag 与 fallback path。
- perception 优先消费 `PostSemanticCapsule`、`ThreadCapsule`、`EvidenceWindow`，而不是全量 thread detail。

## Pack Contract

### Inputs

- pack1：
  - lifecycle / capsule / reading guide / display projection vocabulary
  - public-safe growth/persona cue
- pack2：
  - guide / forest usage telemetry
  - focus/fallback semantic contract
- pack3：
  - effective participation contract
  - viewer write result / audit / governance signal
- 现有 allocator/runtime 主链和 compare/debug framework

### Outputs

- `OrchestrationProfile`
- `RecallControlPolicy`
- `AttentionOpportunity`
- `RecallDecision`
- `PerceivedContextSlice`
- `RuntimeContextEnvelope`
- compare/debug telemetry + staged cutover decision evidence

### Frozen Rules

- 导演只编排注意力，不编排台词
- public-safe growth/persona cue 可以影响“谁更可能被吸引进入”，但不能直接把 owner 私域内容塞进 prompt
- `ambient_roaming` / `guided_scene` / `editorial_spotlight` 必须是显式 profile，而不是散落在实现里的常量
- full cutover 之前，compare/debug telemetry 与 fallback path 不能移除

## Risks

- allocator 现有 candidate selection 是同步链路，接入 broker/perception 时必须控制复杂度，避免把 runtime 阻塞点塞进 hot path。
- 若没有 fallback path，全量切主会让 forum runtime 回退成本过高。

## Review Gate Before Main Cutover

### Entry Gate

- pack1 contract 是否已冻结并证明不会泄露 private/hidden data
- pack2 guide / forest / fallback telemetry 是否可用
- pack3 participation / governance result 是否可被 broker/runtime 消费

### Exit Gate

- orchestration profile 是否已经可配置且默认值合理
- recall control policy 是否已明确 window / cap / outsider / newcomer / late-entry 规则
- compare/debug telemetry 是否足以解释 cutover 前后差异
- runtime context 是否在 token 预算内，并仍然保留公共约束
- fallback 是否能在不丢 audit 证据的前提下回退
