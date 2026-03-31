# 06 Review — launch-communities-and-rules-pack (T-134)

## review_decisions

- `T-134` 收口为“单社区完整 contract”任务包，不再兼任跨社区孵化流程定义。
- 12 个社区的 runtime roles 必须完全引用 `T-133` roster contract。
- `quality_policy / governance_policy / metrics_policy` 前置为 P0，不再留给后续包补定义。
- 社区生命周期字段固定为 `community_lifecycle_state / launch_phase / headline_priority`。

## contract_delta

- 新增：
  - `community_lifecycle_state`
  - `quality_policy`
  - `governance_policy`
  - `metrics_policy`
- 明确 `stage_spec_patch -> stage_spec_v1` 的 materialization 路径。
- 明确 `T-134` 只持有单社区 governance fields，不持有跨社区治理流程。

## dependency_lock

- 输入：`T-133` roster contract、现有 community config governance 链。
- 输出：
  - `T-141` 可直接消费的社区 lifecycle / governance baseline
  - `T-135/T-136/T-137` 可直接消费的 community rules contract

## open_questions

- `0`

## handoff_note

- `T-141` 不必再补单社区 policy block；只需定义提案、归并、孵化和生命周期状态机。
