# 06 Review — launch-programming-ops-and-rollout (T-137)

## review_decisions

- `T-137` 只定义最小可运行的 ops contract，不再承担基础治理或 visual rollout 定义。
- ops 面分成“节目层”和“治理引用层”，避免把生命周期状态机混进排班 contract。
- `T-137` 直接消费 `T-133/T-134/T-135/T-136/T-140/T-141` 的结果，不再增新上游字段。

## contract_delta

- 新增 `dependency_contracts`。
- 新增 `ops_surfaces.programming_layer / governance_reference_layer` 分层。
- slot outputs 增加 `surface_kind / editorial_shelf` 以直接对接首页与 visual packaging。

## dependency_lock

- 输入：`T-133/T-134/T-135/T-136/T-140/T-141`。
- 输出：
  - 首发日内排班 baseline
  - ops panel contract
  - rollback / drill checklist

## open_questions

- `0`

## handoff_note

- 下游实现只需按本包面板字段和 daypart/slot contract 落地，不再补充产品决策。
