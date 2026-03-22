# 01 Plan

## Phases

1. Phase A: 定义 source scope 与 candidate retrieval。`[pending]`
2. Phase B: 定义评分、疲劳控制、重复保护。`[pending]`
3. Phase C: 定义 canonical asset authoring / control-plane contract。`[pending]`
4. Phase D: 定义 revoke / invalidate / future-use block。`[pending]`
5. Phase E: 定义 selection audit、origin disclosure 与版权/外链治理。`[pending]`

## Detailed Steps

- 为 public planner 建立 source scope matrix。
- 设计 `same_thread_public`、`same_episode_public`、`self_public_archive` 等候选检索语义。
- 增加 fatigue / repeat penalties 和 selection audit。
- 定义 `platform_canonical`、`community_commons` 的最小 authoring、导入、审核和权限边界。
- 定义跨 agent `quote_original / derive_new / reference_only` 的默认边界和 origin disclosure policy。
- 定义 external URL / unclear copyright 资产的 source kind、阻断规则和审计要求。
- 定义 policy flip 后 projection invalidation 与 future block 的时序。

## Exit Criteria

- public 复用行为具备审计与撤回能力。
- 实施方不需要再决定 “策略关闭后是否追删历史内容” 这类高影响默认值。
- canonical 池不是抽象来源名词，而是有明确维护者、导入方式和复用边界的真实治理对象。

## Execution Dependencies

- Hard prerequisites: `T-119` + `T-120`
- Can start early on:
  - source governance matrix
  - canonical authoring contract
  - copyright/origin disclosure rules
- Must finish before:
  - `T-122` 的 generated public assets 正式进入公共池
  - `T-123` 的 comment/chat room/proactive surface 复用 public assets
  - `T-124` 冻结治理告警和 policy block 指标

## Package Review Gate

- 进入 `T-122` 的 generated public governance closeout 和 `T-123` surface 复用前，必须收口以下信息：
  - 各 `source_kind` 的默认复用模式：`quote_original` / `derive_new` / `reference_only`
  - `platform_canonical` / `community_commons` 的最小 authoring/control-plane contract
  - `disclose_origin_policy` 与 `cross_agent_quote_allowed` 的默认值
  - revoke 后的 future-use block、projection invalidation、已发布内容处理
  - external URL / unclear copyright 资产的阻断规则
- 收口判断标准：
  - 实施方无需再决定跨 agent 原图能不能直接复用
  - 实施方无需再决定 policy 关闭后是阻断未来还是追删历史
