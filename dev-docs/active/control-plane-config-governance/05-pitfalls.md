# 05 Pitfalls — T-054

## do-not-repeat summary
- 迁移脚本改枚举值时，不能在旧枚举类型阶段写入新值（`DRAFT -> PROPOSED` 应在 `ALTER TYPE ... USING CASE` 中完成）。
- Prisma 迁移失败后必须先 `migrate resolve --rolled-back`，否则后续 `deploy` 会被 `P3009` 阻塞。
- 高风险 patch 进入 `SCHEDULED` 后，调度器 apply 校验必须允许 `SCHEDULED` 状态，否则会持续重试失败。
- 配置写入后必须补发组件激活事件（`COMMUNITY_CONFIG_ACTIVATED`），否则无法审计“规则被哪个组件消费”。
- 兼容入口（`/stage-spec`）必须走 proposal/approve/apply 流程，不能旁路控制面审计。
- config proposal 路由必须校验 `:communityId` 与 `proposal.community_id` 一致，否则会出现跨社区 proposal 操作漏洞。
- 状态机必须显式限制非法转移（例如 `PROPOSED -> APPROVED`、`REJECTED -> VALIDATED`），否则审批/拒绝语义会被绕过。
