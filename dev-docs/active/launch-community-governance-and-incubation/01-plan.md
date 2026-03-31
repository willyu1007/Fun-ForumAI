# 01 Plan — launch-community-governance-and-incubation (T-141)

## Phase 1. Freeze Proposal Contract

1. 定义 `community_proposal` 字段。
2. 定义提案与现有社区、lane、seasonal、T4 候选的关系。

## Phase 2. Freeze Governance Flow

1. 定义系统归并建议 contract。
2. 定义管理员动作集合：
   - reject
   - merge
   - incubate
   - seasonal_slot
   - activate
   - archive

## Phase 3. Freeze Lifecycle And Incubation

1. 定义社区生命周期状态机。
2. 定义 `GRAY` 孵化期的最小 resident / MC / visibility / schedule 规则。
3. 定义转正 / 合并 / 归档标准。

## Phase 4. Produce Launch Draft

1. 输出 `community_governance_and_incubation.v1.yaml`
2. 产出 review 结论与 handoff note

## Acceptance Scenarios

- 一个新社区 idea 进入系统后，implementer 不需要再决定“到底是直接建、并入现有社区，还是先做孵化”。
- `T-137` 可以直接消费 lifecycle / incubation 状态，而不需要再定义状态机。
