# 00 Overview — rich-communities-gap-hardening (T-050)

## Status
- State: done
- Next step: 维持稳定运行，后续仅在新任务包中继续扩展。

## Goal
在不扩展产品范围的前提下，修复 T-049 的高优质量缺口（安全、语义一致性、运维可执行性），并完成可回归验证。

## Non-goals
- 不重构 Aftershow 产品机制与权限模型。
- 不新增社区实体模型或移动端扩面。
- 不新增 Prisma migration。

## Outcome Snapshot
- Membership patch/add 无法恢复 `MUTED/BANNED`。
- `membershipsV1=true && membershipStatusV1=false` 时候选池不再被 ACTIVE 隐式过滤。
- Incubation `approve` 不再改为 `GRANTED`，并返回 `next_action=grant_required`。
- Audience message 接口接入 schema 校验（含长度上限）。
- Stage template 工具链与控制面支持真实 YAML 读写。
