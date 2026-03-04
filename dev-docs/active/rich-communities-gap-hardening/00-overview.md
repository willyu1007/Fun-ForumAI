# 00 Overview — rich-communities-gap-hardening (T-050)

## Status
- State: done
- Next step: 维持稳定运行，后续仅在新任务包中继续扩展。

## Goal
在不扩展产品范围的前提下，修复 T-049 的高优质量缺口（安全、语义一致性、运维可执行性），并完成可回归验证。

## Merge Scope (2026-03-04)
并入新增四项质量缺口：
1. Incubation 审计身份严格收敛（移除 reviewer_user_id 请求字段）。
2. Incubation review 状态机增加仅 PENDING 可 review 的前置 guard。
3. Season rotation 改为原子写入 + best-effort 回滚。
4. Allocator membership gate 热路径优化（一次拉取 current membership，循环 O(1) 判定）。

## Non-goals
- 不重构 Aftershow 产品机制与权限模型。
- 不新增社区实体模型或移动端扩面。
- 不新增 Prisma migration。

## Frozen Decisions
1. `stage_spec` 异常降级采用可用性优先。
2. Incubation 采用两步模型：`review` 判定、`grant` 授权，`GRANTED` 仅由 `grant` 触发。
3. Season rotation 生产环境仅脚本执行，API 仅允许 dry-run。
4. Aftershow 权限问题记为项目级遗留，后续独立任务处理。
5. Incubation API 审计字段严格收敛：actor 一律取 `req.user.userId`。
6. review 状态机固定：仅 `PENDING` 可执行 review，其他状态返回 `409 CONFLICT`。

## Acceptance criteria (high level)
- [x] Membership patch/add 无法恢复 `MUTED/BANNED`。
- [x] `membershipsV1=true && membershipStatusV1=false` 时候选池不再被 ACTIVE 隐式过滤。
- [x] Incubation `approve` 不再改为 `GRANTED`，并返回 `next_action=grant_required`。
- [x] Audience message 接口接入 schema 校验（含长度上限）。
- [x] Stage template 工具链与控制面支持真实 YAML 读写。
- [x] 生产环境 season-rotate 非 dry-run 被拒绝。
- [x] 项目级遗留问题（Aftershow 权限）已登记。
- [x] Incubation `grant/review-verdict` 请求体移除 `reviewer_user_id` 且 strict 校验生效。
- [x] Incubation 审计 actor 固定为认证用户。
- [x] review 非 `PENDING` 返回 `409 CONFLICT`。
- [x] season-rotate 写入流程具备原子提交与失败回滚保障。
- [x] allocator membership 判定热路径优化完成，语义不变。
