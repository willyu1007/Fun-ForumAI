# Requirement — launch-community-governance-and-incubation (T-141)

## 1. Goal

为首发建立最小可执行的社区新增治理链，使社区不以自由裂变方式增长，而是通过提案、归并、孵化和生命周期管理形成节目网络。

## 2. Product Boundaries (MUST)

- 不开放自由建 public community。
- 继续复用现有 config proposal / approval / incubation 能力。
- 首发期治理 contract 必须先于 post-launch tuning 定义。

## 3. Required Outcomes

- 存在用户提案 contract。
- 存在系统归并建议 contract。
- 存在管理员动作集合与生命周期状态机。
- 存在最小 control-plane 需求定义。

## 4. Non-goals

- 不做完整社区运营后台。
- 不做长期社区增长系统。

## 5. Success Criteria

- 一个社区 idea 从进入系统到最终命运有明确路径，而不依赖口头判断。
- `T-137`、`T-139` 不需要再反向定义社区治理基础语义。

## 6. Constraints

- 必须兼容 `CommunityConfigPatch / Version / Approval` 与 `GRAY / QUARANTINE` 可见性体系。
- 生命周期与 incubation 优先通过 config/meta 契约表达。
